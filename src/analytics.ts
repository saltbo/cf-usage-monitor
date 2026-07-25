import {
  METRIC_NAMES,
  type MetricContributor,
  type MetricName,
  type ProductName,
  type UsageSnapshot,
  type UsageSeries,
  type UsageValue,
} from "./metrics";
import { calculateForecastRates } from "./forecast";
import type { InstanceUsageTrends } from "./shared/dashboard";
import type { ResourceNames } from "./server/resource-catalog";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

interface CollectionWindow {
  cycleStart: string;
  recentStart: string;
  end: string;
}

interface CollectorResult {
  cycle: UsageValue[];
  recent: UsageValue[];
  hourly: UsageSeries[];
  daily: UsageSeries[];
}

interface Collector {
  name: string;
  product: ProductName;
  query: (includeTrends: boolean, includeContributors: boolean) => string;
  extract: (
    account: Record<string, unknown>,
    names: ResourceNames,
  ) => CollectorResult;
}

interface InstanceMetricDefinition {
  dataset: string;
  resourceField: string;
  selection: string;
  valuePath: ReadonlyArray<string>;
  multiplier?: number;
  action?: string;
  actions?: ReadonlySet<string>;
  storage?: true;
}

const BYTES_PER_GB = 1_000_000_000;
const DAYS_PER_GB_MONTH = 30;
const HOURS_PER_GB_MONTH = DAYS_PER_GB_MONTH * 24;
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const HOURLY_TREND_LOOKBACK_MS = 2 * DAY_MS;
const DAILY_TREND_LOOKBACK_MS = 6 * DAY_MS;
const DAILY_TREND_CHUNK_MS = 31 * DAY_MS;

const R2_CLASS_A = new Set([
  "ListBuckets",
  "PutBucket",
  "ListObjects",
  "PutObject",
  "CopyObject",
  "CompleteMultipartUpload",
  "CreateMultipartUpload",
  "LifecycleStorageTierTransition",
  "ListMultipartUploads",
  "UploadPart",
  "UploadPartCopy",
  "ListParts",
  "PutBucketEncryption",
  "PutBucketCors",
  "PutBucketLifecycleConfiguration",
]);
const R2_CLASS_B = new Set([
  "HeadBucket",
  "HeadObject",
  "GetObject",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);

const collectors: Collector[] = [
  {
    name: "workers",
    product: "workers",
    query: (includeTrends, includeContributors) => usageQuery(
      "workersInvocationsAdaptive",
      `${includeContributors ? "dimensions { scriptName } " : ""}sum { requests cpuTimeUs }`,
      includeTrends,
    ),
    extract: (account) =>
      extractDual(account, (rows) => [
        metricFromRows(rows, "workers.requests", ["sum", "requests"], [
          "dimensions",
          "scriptName",
        ]),
        scaleUsageValue(
          metricFromRows(
            rows,
            "workers.cpu_milliseconds",
            ["sum", "cpuTimeUs"],
            ["dimensions", "scriptName"],
          ),
          1 / 1_000,
        ),
      ]),
  },
  {
    name: "d1",
    product: "d1",
    query: (includeTrends, includeContributors) => usageQuery(
      "d1AnalyticsAdaptiveGroups",
      `${includeContributors ? "dimensions { databaseId } " : ""}sum { rowsRead rowsWritten }`,
      includeTrends,
    ),
    extract: (account, names) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "d1.rows_read",
          ["sum", "rowsRead"],
          ["dimensions", "databaseId"],
          names.d1 ?? {},
        ),
        metricFromRows(
          rows,
          "d1.rows_written",
          ["sum", "rowsWritten"],
          ["dimensions", "databaseId"],
          names.d1 ?? {},
        ),
      ]),
  },
  {
    name: "kv",
    product: "kv",
    query: (includeTrends, includeContributors) => usageQuery(
      "kvOperationsAdaptiveGroups",
      `dimensions { ${includeContributors ? "namespaceId " : ""}actionType } sum { requests }`,
      includeTrends,
    ),
    extract: (account, names) =>
      extractDual(account, (rows) => {
        const definitions = [
          ["kv.reads", "read"],
          ["kv.writes", "write"],
          ["kv.deletes", "delete"],
          ["kv.lists", "list"],
        ] as const;
        return definitions.map(([metric, action]) =>
          metricFromRows(
            rows.filter(
              (row) =>
                getStringAtPath(row, ["dimensions", "actionType"]).toLowerCase() ===
                action,
            ),
            metric,
            ["sum", "requests"],
            ["dimensions", "namespaceId"],
            names.kv ?? {},
          ),
        );
      }),
  },
  {
    name: "r2",
    product: "r2",
    query: (includeTrends, includeContributors) => usageQuery(
      "r2OperationsAdaptiveGroups",
      `dimensions { ${includeContributors ? "bucketName " : ""}actionType } sum { requests }`,
      includeTrends,
    ),
    extract: (account) =>
      extractDual(account, (rows) => [
        r2Metric(rows, "r2.class_a_operations", R2_CLASS_A),
        r2Metric(rows, "r2.class_b_operations", R2_CLASS_B),
      ]),
  },
  {
    name: "r2_storage",
    product: "r2",
    query: r2StorageQuery,
    extract: (account) => extractR2Storage(account),
  },
  {
    name: "durable_objects",
    product: "durable_objects",
    query: (includeTrends, includeContributors) => usageQuery(
      "durableObjectsInvocationsAdaptiveGroups",
      `${includeContributors ? "dimensions { namespaceId } " : ""}sum { requests }`,
      includeTrends,
    ),
    extract: (account, names) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "durable_objects.requests",
          ["sum", "requests"],
          ["dimensions", "namespaceId"],
          names.durable_objects ?? {},
        ),
      ]),
  },
  {
    name: "queues",
    product: "queues",
    query: (includeTrends, includeContributors) => usageQuery(
      "queueMessageOperationsAdaptiveGroups",
      `${includeContributors ? "dimensions { queueId } " : ""}sum { billableOperations }`,
      includeTrends,
    ),
    extract: (account, names) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "queues.operations",
          ["sum", "billableOperations"],
          ["dimensions", "queueId"],
          names.queues ?? {},
        ),
      ]),
  },
  {
    name: "workers_ai",
    product: "workers_ai",
    query: (includeTrends, includeContributors) => usageQuery(
      "aiInferenceAdaptiveGroups",
      `${includeContributors ? "dimensions { modelId } " : ""}sum { totalNeurons }`,
      includeTrends,
    ),
    extract: (account) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "workers_ai.neurons",
          ["sum", "totalNeurons"],
          ["dimensions", "modelId"],
        ),
      ]),
  },
  {
    name: "containers",
    product: "containers",
    query: (includeTrends, includeContributors) => usageQuery(
      "containersUsageAdaptiveGroups",
      `${includeContributors ? "dimensions { applicationId } " : ""}sum { cpuTimeSec }`,
      includeTrends,
    ),
    extract: (account, names) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "containers.cpu_seconds",
          ["sum", "cpuTimeSec"],
          ["dimensions", "applicationId"],
          names.containers ?? {},
        ),
      ]),
  },
];

const INSTANCE_METRICS = {
  "workers.requests": {
    dataset: "workersInvocationsAdaptive",
    resourceField: "scriptName",
    selection: "sum { requests }",
    valuePath: ["sum", "requests"],
  },
  "workers.cpu_milliseconds": {
    dataset: "workersInvocationsAdaptive",
    resourceField: "scriptName",
    selection: "sum { cpuTimeUs }",
    valuePath: ["sum", "cpuTimeUs"],
    multiplier: 1 / 1_000,
  },
  "d1.rows_read": {
    dataset: "d1AnalyticsAdaptiveGroups",
    resourceField: "databaseId",
    selection: "sum { rowsRead }",
    valuePath: ["sum", "rowsRead"],
  },
  "d1.rows_written": {
    dataset: "d1AnalyticsAdaptiveGroups",
    resourceField: "databaseId",
    selection: "sum { rowsWritten }",
    valuePath: ["sum", "rowsWritten"],
  },
  "kv.reads": {
    dataset: "kvOperationsAdaptiveGroups",
    resourceField: "namespaceId",
    selection: "dimensions { actionType } sum { requests }",
    valuePath: ["sum", "requests"],
    action: "read",
  },
  "kv.writes": {
    dataset: "kvOperationsAdaptiveGroups",
    resourceField: "namespaceId",
    selection: "dimensions { actionType } sum { requests }",
    valuePath: ["sum", "requests"],
    action: "write",
  },
  "kv.deletes": {
    dataset: "kvOperationsAdaptiveGroups",
    resourceField: "namespaceId",
    selection: "dimensions { actionType } sum { requests }",
    valuePath: ["sum", "requests"],
    action: "delete",
  },
  "kv.lists": {
    dataset: "kvOperationsAdaptiveGroups",
    resourceField: "namespaceId",
    selection: "dimensions { actionType } sum { requests }",
    valuePath: ["sum", "requests"],
    action: "list",
  },
  "r2.class_a_operations": {
    dataset: "r2OperationsAdaptiveGroups",
    resourceField: "bucketName",
    selection: "dimensions { actionType } sum { requests }",
    valuePath: ["sum", "requests"],
    actions: R2_CLASS_A,
  },
  "r2.class_b_operations": {
    dataset: "r2OperationsAdaptiveGroups",
    resourceField: "bucketName",
    selection: "dimensions { actionType } sum { requests }",
    valuePath: ["sum", "requests"],
    actions: R2_CLASS_B,
  },
  "r2.storage_gb_month": {
    dataset: "r2StorageAdaptiveGroups",
    resourceField: "bucketName",
    selection: "max { payloadSize metadataSize }",
    valuePath: ["max", "payloadSize"],
    storage: true,
  },
  "durable_objects.requests": {
    dataset: "durableObjectsInvocationsAdaptiveGroups",
    resourceField: "namespaceId",
    selection: "sum { requests }",
    valuePath: ["sum", "requests"],
  },
  "queues.operations": {
    dataset: "queueMessageOperationsAdaptiveGroups",
    resourceField: "queueId",
    selection: "sum { billableOperations }",
    valuePath: ["sum", "billableOperations"],
  },
  "workers_ai.neurons": {
    dataset: "aiInferenceAdaptiveGroups",
    resourceField: "modelId",
    selection: "sum { totalNeurons }",
    valuePath: ["sum", "totalNeurons"],
  },
  "containers.cpu_seconds": {
    dataset: "containersUsageAdaptiveGroups",
    resourceField: "applicationId",
    selection: "sum { cpuTimeSec }",
    valuePath: ["sum", "cpuTimeSec"],
  },
} as const satisfies Record<MetricName, InstanceMetricDefinition>;

export async function collectInstanceUsage(
  accountId: string,
  apiToken: string,
  metric: MetricName,
  instanceId: string,
  cycleStart: string,
  measuredAt: string,
): Promise<InstanceUsageTrends> {
  const definition = INSTANCE_METRICS[metric];
  const measuredAtMs = Date.parse(measuredAt);
  const dailyWindow = dailyTrendWindow(cycleStart, measuredAt);
  const data = await queryAnalytics(
    apiToken,
    instanceUsageQuery(definition),
    {
      accountId,
      instanceId,
      hourlyStart: new Date(
        measuredAtMs - HOURLY_TREND_LOOKBACK_MS,
      ).toISOString(),
      ...dailyWindow,
      end: measuredAt,
    },
  );
  const account = getAccount(data);
  const hourly = extractInstanceSeries(
    getArray(account, "hourly"),
    "datetimeHour",
    definition,
  );
  const daily = extractInstanceSeries(
    [
      ...getOptionalArray(account, "dailyOlder"),
      ...getArray(account, "daily"),
    ],
    "date",
    definition,
  );
  const currentHourStart =
    Math.floor(Date.parse(measuredAt) / (60 * 60 * 1_000)) *
    60 *
    60 *
    1_000;
  const recentHourlyUsage =
    hourly.find(
      (point) => Date.parse(point.timestamp) === currentHourStart,
    )?.value ?? 0;
  const rates = calculateForecastRates({
    dailyPoints: daily,
    hourlyPoints: hourly,
    measuredAt,
    periodStart: cycleStart,
    recentHourlyUsage,
  });
  return {
    metric,
    instanceId,
    measuredAt,
    cycleStart,
    forecastHourlyUsage: rates.hourlyUsage,
    forecastDailyUsage: rates.dailyUsage,
    hourly,
    daily,
  };
}

export async function collectQuotaUsage(
  accountId: string,
  apiToken: string,
  cycle: { start: string; end: string },
  measuredAt: string,
  resourceNames: ResourceNames = {},
  includeTrends = false,
  product?: ProductName,
  includeContributors = true,
): Promise<UsageSnapshot> {
  const measuredAtMs = Date.parse(measuredAt);
  const recentStart = new Date(measuredAtMs - HOUR_MS).toISOString();
  const hourlyEndMs = Math.floor(measuredAtMs / HOUR_MS) * HOUR_MS;
  const variables = {
    accountId,
    cycleStart: cycle.start,
    ...dailyTrendWindow(cycle.start, measuredAt),
    recentStart,
    storageStart: new Date(
      Math.max(Date.parse(cycle.start), measuredAtMs - 48 * 60 * 60 * 1_000),
    ).toISOString(),
    hourlyStart: new Date(
      hourlyEndMs - HOURLY_TREND_LOOKBACK_MS,
    ).toISOString(),
    hourlyEnd: measuredAt,
    end: measuredAt,
  };
  const activeCollectors = product
    ? collectors.filter((collector) => collector.product === product)
    : collectors;
  const settled = await Promise.allSettled(
    activeCollectors.map(async (collector) => {
      const collectorVariables =
        collector.name === "workers_ai"
          ? {
              ...variables,
              cycleStart: startOfUtcDay(measuredAt),
            }
          : variables;
      const data = await queryAnalytics(
        apiToken,
        collector.query(includeTrends, includeContributors),
        collectorVariables,
      );
      return {
        name: collector.name,
        result: collector.extract(getAccount(data), resourceNames),
      };
    }),
  );
  const cycleValues = emptyValues();
  const recentValues = emptyValues();
  const hourlySeries = new Map<MetricName, UsageSeries>();
  const dailySeries = new Map<MetricName, UsageSeries>();
  const failures: UsageSnapshot["failures"] = [];

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      failures.push({
        collector: activeCollectors[index].name,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
      return;
    }
    mergeValues(cycleValues, result.value.result.cycle);
    mergeValues(recentValues, result.value.result.recent);
    mergeSeries(hourlySeries, result.value.result.hourly);
    mergeSeries(dailySeries, result.value.result.daily);
  });

  return {
    measuredAt,
    cycle,
    values: METRIC_NAMES.map((name) => cycleValues.get(name) ?? emptyValue(name)),
    recentValues: METRIC_NAMES.map(
      (name) => recentValues.get(name) ?? emptyValue(name),
    ),
    hourlySeries: METRIC_NAMES.map(
      (name) => hourlySeries.get(name) ?? emptySeries(name),
    ),
    dailySeries: METRIC_NAMES.map(
      (name) => dailySeries.get(name) ?? emptySeries(name),
    ),
    failures,
  };
}

function instanceUsageQuery(definition: InstanceMetricDefinition): string {
  if (definition.storage) {
    return r2StorageInstanceQuery(definition);
  }
  const hourlySelection = withInstanceTimeDimension(
    definition.selection,
    "datetimeHour",
  );
  const dailySelection = withInstanceTimeDimension(
    definition.selection,
    "date",
  );
  return `query InstanceUsage(
    $accountId: string!
    $instanceId: string!
    $hourlyStart: Time!
    $trendStart: Time!
    $trendRecent: Time!
    $end: Time!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountId }) {
        hourly: ${definition.dataset}(
          limit: 10000
          filter: {
            datetime_geq: $hourlyStart
            datetime_lt: $end
            ${definition.resourceField}: $instanceId
          }
        ) { ${hourlySelection} }
        dailyOlder: ${definition.dataset}(
          limit: 10000
          filter: {
            datetime_geq: $trendStart
            datetime_lt: $trendRecent
            ${definition.resourceField}: $instanceId
          }
        ) { ${dailySelection} }
        daily: ${definition.dataset}(
          limit: 10000
          filter: {
            datetime_geq: $trendRecent
            datetime_lt: $end
            ${definition.resourceField}: $instanceId
          }
        ) { ${dailySelection} }
      }
    }
  }`;
}

function withInstanceTimeDimension(
  selection: string,
  dimension: "datetimeHour" | "date",
): string {
  return selection.includes("dimensions {")
    ? selection.replace("dimensions {", `dimensions { ${dimension}`)
    : `dimensions { ${dimension} } ${selection}`;
}

function extractInstanceSeries(
  rows: Record<string, unknown>[],
  dimension: "datetimeHour" | "date",
  definition: InstanceMetricDefinition,
): UsageSeries["points"] {
  if (definition.storage) {
    return extractR2StorageInstanceSeries(rows, dimension);
  }
  const byTimestamp = new Map<string, number>();
  for (const row of rows) {
    const action = getOptionalStringAtPath(row, ["dimensions", "actionType"]);
    if (
      definition.action &&
      action?.toLowerCase() !== definition.action
    ) {
      continue;
    }
    if (definition.actions && (!action || !definition.actions.has(action))) {
      continue;
    }
    const rawTimestamp = getStringAtPath(row, ["dimensions", dimension]);
    const timestamp =
      dimension === "date" ? `${rawTimestamp}T00:00:00.000Z` : rawTimestamp;
    const value =
      getNumberAtPath(row, definition.valuePath) *
      (definition.multiplier ?? 1);
    byTimestamp.set(timestamp, (byTimestamp.get(timestamp) ?? 0) + value);
  }
  return [...byTimestamp.entries()]
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function startOfUtcDay(value: string): string {
  const date = new Date(value);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  ).toISOString();
}

function dailyTrendWindow(
  cycleStart: string,
  measuredAt: string,
): {
  trendStart: string;
  trendRecent: string;
} {
  const start = Date.parse(cycleStart) - DAILY_TREND_LOOKBACK_MS;
  const end = Date.parse(measuredAt);
  return {
    trendStart: new Date(start).toISOString(),
    trendRecent: new Date(
      Math.min(start + DAILY_TREND_CHUNK_MS, end),
    ).toISOString(),
  };
}

function usageQuery(
  dataset: string,
  selection: string,
  includeTrends: boolean,
): string {
  const trendVariables = includeTrends
    ? `
    $trendStart: Time!
    $trendRecent: Time!
    $hourlyStart: Time!
    $hourlyEnd: Time!`
    : "";
  const trends = includeTrends
    ? `
        hourly: ${dataset}(
          limit: 10000
          filter: { datetime_geq: $hourlyStart, datetime_lt: $hourlyEnd }
        ) { ${withTimeDimension(selection, "datetimeHour")} }
        dailyOlder: ${dataset}(
          limit: 10000
          filter: { datetime_geq: $trendStart, datetime_lt: $trendRecent }
        ) { ${withTimeDimension(selection, "date")} }
        daily: ${dataset}(
          limit: 10000
          filter: { datetime_geq: $trendRecent, datetime_lt: $end }
        ) { ${withTimeDimension(selection, "date")} }`
    : "";
  return `query QuotaUsage(
    $accountId: string!
    $cycleStart: Time!
    $recentStart: Time!
    ${trendVariables}
    $end: Time!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountId }) {
        cycle: ${dataset}(
          limit: 10000
          filter: { datetime_geq: $cycleStart, datetime_lt: $end }
        ) { ${selection} }
        recent: ${dataset}(
          limit: 10000
          filter: { datetime_geq: $recentStart, datetime_lt: $end }
        ) { ${selection} }
        ${trends}
      }
    }
  }`;
}

function r2StorageQuery(
  includeTrends: boolean,
  includeContributors: boolean,
): string {
  const bucketDimension = includeContributors ? " bucketName" : "";
  const trendVariables = includeTrends
    ? `
    $trendStart: Time!
    $trendRecent: Time!
    $hourlyStart: Time!
    $hourlyEnd: Time!`
    : "";
  const trends = includeTrends
    ? `
        hourly: r2StorageAdaptiveGroups(
          limit: 10000
          filter: { datetime_geq: $hourlyStart, datetime_lt: $hourlyEnd }
        ) {
          dimensions { datetimeHour${bucketDimension} }
          max { payloadSize metadataSize }
        }
        dailyOlder: r2StorageAdaptiveGroups(
          limit: 10000
          filter: { datetime_geq: $trendStart, datetime_lt: $trendRecent }
        ) {
          dimensions { date${bucketDimension} }
          max { payloadSize metadataSize }
        }
        daily: r2StorageAdaptiveGroups(
          limit: 10000
          filter: { datetime_geq: $trendRecent, datetime_lt: $end }
        ) {
          dimensions { date${bucketDimension} }
          max { payloadSize metadataSize }
        }`
    : "";
  return `query R2StorageUsage(
    $accountId: string!
    $cycleStart: Time!
    $storageStart: Time!
    ${trendVariables}
    $end: Time!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountId }) {
        cycle: r2StorageAdaptiveGroups(
          limit: 10000
          filter: { datetime_geq: $cycleStart, datetime_lt: $end }
        ) {
          dimensions { date${bucketDimension} }
          max { payloadSize metadataSize }
        }
        recent: r2StorageAdaptiveGroups(
          limit: 10000
          orderBy: [datetime_DESC]
          filter: { datetime_geq: $storageStart, datetime_lt: $end }
        ) {
          dimensions { datetime${bucketDimension} }
          max { payloadSize metadataSize }
        }
        ${trends}
      }
    }
  }`;
}

function r2StorageInstanceQuery(
  definition: InstanceMetricDefinition,
): string {
  return `query R2StorageInstanceUsage(
    $accountId: string!
    $instanceId: string!
    $hourlyStart: Time!
    $trendStart: Time!
    $trendRecent: Time!
    $end: Time!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountId }) {
        hourly: ${definition.dataset}(
          limit: 10000
          filter: {
            datetime_geq: $hourlyStart
            datetime_lt: $end
            ${definition.resourceField}: $instanceId
          }
        ) {
          dimensions { datetimeHour }
          max { payloadSize metadataSize }
        }
        dailyOlder: ${definition.dataset}(
          limit: 10000
          filter: {
            datetime_geq: $trendStart
            datetime_lt: $trendRecent
            ${definition.resourceField}: $instanceId
          }
        ) {
          dimensions { date }
          max { payloadSize metadataSize }
        }
        daily: ${definition.dataset}(
          limit: 10000
          filter: {
            datetime_geq: $trendRecent
            datetime_lt: $end
            ${definition.resourceField}: $instanceId
          }
        ) {
          dimensions { date }
          max { payloadSize metadataSize }
        }
      }
    }
  }`;
}

function withTimeDimension(selection: string, dimension: string): string {
  return selection.replace("dimensions {", `dimensions { ${dimension}`);
}

function extractR2Storage(
  account: Record<string, unknown>,
): CollectorResult {
  const cycleRows = getArray(account, "cycle");
  const recentRows = getArray(account, "recent");
  const hourlyRows = getOptionalArray(account, "hourly");
  const dailyRows = [
    ...getOptionalArray(account, "dailyOlder"),
    ...getOptionalArray(account, "daily"),
  ];
  return {
    cycle: [
      storageValueFromRows(
        cycleRows,
        "date",
        1 / (BYTES_PER_GB * DAYS_PER_GB_MONTH),
      ),
    ],
    recent: [
      latestStorageValue(
        recentRows,
        1 / (BYTES_PER_GB * HOURS_PER_GB_MONTH),
      ),
    ],
    hourly: [
      storageSeriesFromRows(
        hourlyRows,
        "datetimeHour",
        1 / (BYTES_PER_GB * HOURS_PER_GB_MONTH),
      ),
    ],
    daily: [
      storageSeriesFromRows(
        dailyRows,
        "date",
        1 / (BYTES_PER_GB * DAYS_PER_GB_MONTH),
      ),
    ],
  };
}

function extractR2StorageInstanceSeries(
  rows: Record<string, unknown>[],
  dimension: "datetimeHour" | "date",
): UsageSeries["points"] {
  const multiplier =
    dimension === "date"
      ? 1 / (BYTES_PER_GB * DAYS_PER_GB_MONTH)
      : 1 / (BYTES_PER_GB * HOURS_PER_GB_MONTH);
  const byTimestamp = new Map<string, number>();
  for (const row of rows) {
    const timestamp = normalizeTimestamp(
      getStringAtPath(row, ["dimensions", dimension]),
      dimension,
    );
    const value = storageBytes(row) * multiplier;
    byTimestamp.set(timestamp, Math.max(byTimestamp.get(timestamp) ?? 0, value));
  }
  return [...byTimestamp.entries()]
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function storageValueFromRows(
  rows: Record<string, unknown>[],
  dimension: "date" | "datetimeHour",
  multiplier: number,
): UsageValue {
  const byBucketAndTime = storagePeaks(rows, dimension);
  const byBucket = new Map<string, number>();
  for (const [key, bytes] of byBucketAndTime) {
    const bucket = key.slice(key.indexOf("\n") + 1);
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + bytes * multiplier);
  }
  return usageValueFromContributors("r2.storage_gb_month", byBucket);
}

function latestStorageValue(
  rows: Record<string, unknown>[],
  multiplier: number,
): UsageValue {
  const latestByBucket = new Map<string, { timestamp: string; bytes: number }>();
  for (const row of rows) {
    const bucket =
      getOptionalStringAtPath(row, ["dimensions", "bucketName"]) ?? "account";
    const timestamp = getStringAtPath(row, ["dimensions", "datetime"]);
    const current = latestByBucket.get(bucket);
    if (!current || timestamp > current.timestamp) {
      latestByBucket.set(bucket, { timestamp, bytes: storageBytes(row) });
    }
  }
  return usageValueFromContributors(
    "r2.storage_gb_month",
    new Map(
      [...latestByBucket].map(([bucket, value]) => [
        bucket,
        value.bytes * multiplier,
      ]),
    ),
  );
}

function storageSeriesFromRows(
  rows: Record<string, unknown>[],
  dimension: "date" | "datetimeHour",
  multiplier: number,
): UsageSeries {
  const byTime = new Map<string, number>();
  for (const [key, bytes] of storagePeaks(rows, dimension)) {
    const timestamp = key.slice(0, key.indexOf("\n"));
    byTime.set(timestamp, (byTime.get(timestamp) ?? 0) + bytes * multiplier);
  }
  return {
    name: "r2.storage_gb_month",
    points: [...byTime.entries()]
      .map(([timestamp, value]) => ({ timestamp, value }))
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
  };
}

function storagePeaks(
  rows: Record<string, unknown>[],
  dimension: "date" | "datetimeHour",
): Map<string, number> {
  const peaks = new Map<string, number>();
  for (const row of rows) {
    const timestamp = normalizeTimestamp(
      getStringAtPath(row, ["dimensions", dimension]),
      dimension,
    );
    const bucket =
      getOptionalStringAtPath(row, ["dimensions", "bucketName"]) ?? "account";
    const key = `${timestamp}\n${bucket}`;
    peaks.set(key, Math.max(peaks.get(key) ?? 0, storageBytes(row)));
  }
  return peaks;
}

function normalizeTimestamp(
  value: string,
  dimension: "date" | "datetimeHour",
): string {
  return dimension === "date" ? `${value}T00:00:00.000Z` : value;
}

function storageBytes(row: Record<string, unknown>): number {
  return (
    getNumberAtPath(row, ["max", "payloadSize"]) +
    getNumberAtPath(row, ["max", "metadataSize"])
  );
}

function usageValueFromContributors(
  name: MetricName,
  byResource: ReadonlyMap<string, number>,
): UsageValue {
  const contributors = [...byResource.entries()]
    .map(([id, value]) => ({
      id,
      name: id === "account" ? "Account-level storage" : id,
      value,
    }))
    .filter((contributor) => contributor.value > 0)
    .sort((left, right) => right.value - left.value);
  return {
    name,
    value: contributors.reduce((sum, contributor) => sum + contributor.value, 0),
    contributors,
  };
}

function extractDual(
  account: Record<string, unknown>,
  extract: (rows: Record<string, unknown>[]) => UsageValue[],
): CollectorResult {
  return {
    cycle: extract(getArray(account, "cycle")),
    recent: extract(getArray(account, "recent")),
    hourly: extractSeries(getOptionalArray(account, "hourly"), "datetimeHour", extract),
    daily: extractSeries(
      [
        ...getOptionalArray(account, "dailyOlder"),
        ...getOptionalArray(account, "daily"),
      ],
      "date",
      extract,
    ),
  };
}

function extractSeries(
  rows: Record<string, unknown>[],
  dimension: "datetimeHour" | "date",
  extract: (rows: Record<string, unknown>[]) => UsageValue[],
): UsageSeries[] {
  const byTimestamp = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const timestamp = getStringAtPath(row, ["dimensions", dimension]);
    const normalized =
      dimension === "date" ? `${timestamp}T00:00:00.000Z` : timestamp;
    const bucket = byTimestamp.get(normalized) ?? [];
    bucket.push(row);
    byTimestamp.set(normalized, bucket);
  }
  const byMetric = new Map<MetricName, UsageSeries["points"]>();
  for (const [timestamp, bucket] of byTimestamp) {
    for (const value of extract(bucket)) {
      const points = byMetric.get(value.name) ?? [];
      points.push({ timestamp, value: value.value });
      byMetric.set(value.name, points);
    }
  }
  return [...byMetric.entries()].map(([name, points]) => ({
    name,
    points: points.sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp)
    ),
  }));
}

function r2Metric(
  rows: Record<string, unknown>[],
  name: "r2.class_a_operations" | "r2.class_b_operations",
  actions: ReadonlySet<string>,
): UsageValue {
  return metricFromRows(
    rows.filter((row) =>
      actions.has(getStringAtPath(row, ["dimensions", "actionType"])),
    ),
    name,
    ["sum", "requests"],
    ["dimensions", "bucketName"],
  );
}

function metricFromRows(
  rows: Record<string, unknown>[],
  name: MetricName,
  valuePath: ReadonlyArray<string>,
  resourcePath: ReadonlyArray<string>,
  names: Record<string, string> = {},
): UsageValue {
  const byResource = new Map<string, number>();
  for (const row of rows) {
    const id = getOptionalStringAtPath(row, resourcePath) ?? "account";
    byResource.set(
      id,
      (byResource.get(id) ?? 0) + getNumberAtPath(row, valuePath),
    );
  }
  const contributors = [...byResource.entries()]
    .map(([id, value]) => ({
      id,
      name: names[id] ?? (id === "account" ? "Account-level operations" : id),
      value,
    }))
    .filter((contributor) => contributor.value > 0)
    .sort((left, right) => right.value - left.value);
  return {
    name,
    value: contributors.reduce((sum, contributor) => sum + contributor.value, 0),
    contributors,
  };
}

function getOptionalStringAtPath(
  value: Record<string, unknown>,
  path: ReadonlyArray<string>,
): string | null {
  let current: unknown = value;
  for (const segment of path) {
    if (
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current)
    ) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" && current.length > 0 ? current : null;
}

function scaleUsageValue(value: UsageValue, multiplier: number): UsageValue {
  return {
    ...value,
    value: value.value * multiplier,
    contributors: value.contributors.map((contributor) => ({
      ...contributor,
      value: contributor.value * multiplier,
    })),
  };
}

function emptyValues(): Map<MetricName, UsageValue> {
  return new Map();
}

function emptyValue(name: MetricName): UsageValue {
  return { name, value: 0, contributors: [] };
}

function emptySeries(name: MetricName): UsageSeries {
  return { name, points: [] };
}

function mergeValues(
  target: Map<MetricName, UsageValue>,
  values: UsageValue[],
): void {
  for (const value of values) {
    target.set(value.name, value);
  }
}

function mergeSeries(
  target: Map<MetricName, UsageSeries>,
  values: UsageSeries[],
): void {
  for (const value of values) {
    target.set(value.name, value);
  }
}

async function queryAnalytics(
  apiToken: string,
  query: string,
  variables: Record<string, string>,
): Promise<unknown> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Cloudflare GraphQL returned HTTP ${response.status}: ${body}`);
  }
  const payload: unknown = JSON.parse(body);
  const root = asRecord(payload, "GraphQL response");
  if (Array.isArray(root.errors) && root.errors.length > 0) {
    throw new Error(`Cloudflare GraphQL errors: ${JSON.stringify(root.errors)}`);
  }
  return root.data;
}

function getAccount(data: unknown): Record<string, unknown> {
  const root = asRecord(data, "GraphQL data");
  const viewer = asRecord(root.viewer, "GraphQL viewer");
  const accounts = getArray(viewer, "accounts");
  if (accounts.length !== 1) {
    throw new Error(`Expected one Cloudflare account, received ${accounts.length}`);
  }
  return accounts[0];
}

function getArray(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    throw new Error(`Expected ${key} to be an array`);
  }
  return candidate.map((item) => asRecord(item, key));
}

function getOptionalArray(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  return key in value ? getArray(value, key) : [];
}

function getNumberAtPath(
  value: Record<string, unknown>,
  path: ReadonlyArray<string>,
): number {
  let current: unknown = value;
  for (const segment of path) {
    current = asRecord(current, path.join("."))[segment];
  }
  if (typeof current !== "number" || !Number.isFinite(current)) {
    throw new Error(`Expected ${path.join(".")} to be a finite number`);
  }
  return current;
}

function getStringAtPath(
  value: Record<string, unknown>,
  path: ReadonlyArray<string>,
): string {
  let current: unknown = value;
  for (const segment of path) {
    current = asRecord(current, path.join("."))[segment];
  }
  if (typeof current !== "string" || current.length === 0) {
    throw new Error(`Expected ${path.join(".")} to be a non-empty string`);
  }
  return current;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${name} to be an object`);
  }
  return value as Record<string, unknown>;
}
