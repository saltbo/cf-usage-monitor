import {
  METRIC_NAMES,
  type MetricContributor,
  type MetricName,
  type UsageSnapshot,
  type UsageSeries,
  type UsageValue,
} from "./metrics";

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
  query: (includeTrends: boolean) => string;
  extract: (
    account: Record<string, unknown>,
    names: ResourceNames,
  ) => CollectorResult;
}

interface ResourceNames {
  d1: Record<string, string>;
}

interface InstanceMetricDefinition {
  dataset: string;
  resourceField: string;
  selection: string;
  valuePath: ReadonlyArray<string>;
  multiplier?: number;
  action?: string;
  actions?: ReadonlySet<string>;
}

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
    query: (includeTrends) => usageQuery(
      "workersInvocationsAdaptive",
      "dimensions { scriptName } sum { requests cpuTimeUs }",
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
    query: (includeTrends) => usageQuery(
      "d1AnalyticsAdaptiveGroups",
      "dimensions { databaseId } sum { rowsRead rowsWritten }",
      includeTrends,
    ),
    extract: (account, names) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "d1.rows_read",
          ["sum", "rowsRead"],
          ["dimensions", "databaseId"],
          names.d1,
        ),
        metricFromRows(
          rows,
          "d1.rows_written",
          ["sum", "rowsWritten"],
          ["dimensions", "databaseId"],
          names.d1,
        ),
      ]),
  },
  {
    name: "kv",
    query: (includeTrends) => usageQuery(
      "kvOperationsAdaptiveGroups",
      "dimensions { namespaceId actionType } sum { requests }",
      includeTrends,
    ),
    extract: (account) =>
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
          ),
        );
      }),
  },
  {
    name: "r2",
    query: (includeTrends) => usageQuery(
      "r2OperationsAdaptiveGroups",
      "dimensions { bucketName actionType } sum { requests }",
      includeTrends,
    ),
    extract: (account) =>
      extractDual(account, (rows) => [
        r2Metric(rows, "r2.class_a_operations", R2_CLASS_A),
        r2Metric(rows, "r2.class_b_operations", R2_CLASS_B),
      ]),
  },
  {
    name: "durable_objects",
    query: (includeTrends) => usageQuery(
      "durableObjectsInvocationsAdaptiveGroups",
      "dimensions { namespaceId } sum { requests }",
      includeTrends,
    ),
    extract: (account) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "durable_objects.requests",
          ["sum", "requests"],
          ["dimensions", "namespaceId"],
        ),
      ]),
  },
  {
    name: "queues",
    query: (includeTrends) => usageQuery(
      "queueMessageOperationsAdaptiveGroups",
      "dimensions { queueId } sum { billableOperations }",
      includeTrends,
    ),
    extract: (account) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "queues.operations",
          ["sum", "billableOperations"],
          ["dimensions", "queueId"],
        ),
      ]),
  },
  {
    name: "workers_ai",
    query: (includeTrends) => usageQuery(
      "aiInferenceAdaptiveGroups",
      "dimensions { modelId } sum { totalNeurons }",
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
    query: (includeTrends) => usageQuery(
      "containersUsageAdaptiveGroups",
      "dimensions { applicationId } sum { cpuTimeSec }",
      includeTrends,
    ),
    extract: (account) =>
      extractDual(account, (rows) => [
        metricFromRows(
          rows,
          "containers.cpu_seconds",
          ["sum", "cpuTimeSec"],
          ["dimensions", "applicationId"],
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

export interface InstanceUsageTrends {
  metric: MetricName;
  instanceId: string;
  measuredAt: string;
  hourly: UsageSeries["points"];
  daily: UsageSeries["points"];
}

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
  const data = await queryAnalytics(
    apiToken,
    instanceUsageQuery(definition),
    {
      accountId,
      instanceId,
      hourlyStart: new Date(
        Math.max(Date.parse(cycleStart), measuredAtMs - 48 * 60 * 60 * 1_000),
      ).toISOString(),
      trendStart: cycleStart,
      end: measuredAt,
    },
  );
  const account = getAccount(data);
  return {
    metric,
    instanceId,
    measuredAt,
    hourly: extractInstanceSeries(
      getArray(account, "hourly"),
      "datetimeHour",
      definition,
    ),
    daily: extractInstanceSeries(
      getArray(account, "daily"),
      "date",
      definition,
    ),
  };
}

export async function collectQuotaUsage(
  accountId: string,
  apiToken: string,
  cycle: { start: string; end: string },
  measuredAt: string,
  d1DatabaseNames: Record<string, string> = {},
  includeTrends = false,
): Promise<UsageSnapshot> {
  const measuredAtMs = Date.parse(measuredAt);
  const recentStart = new Date(measuredAtMs - 60 * 60 * 1_000).toISOString();
  const hourlyEndMs = Math.floor(measuredAtMs / (60 * 60 * 1_000)) *
    60 * 60 * 1_000;
  const variables = {
    accountId,
    cycleStart: cycle.start,
    trendStart: cycle.start,
    recentStart,
    hourlyStart: new Date(
      Math.max(Date.parse(cycle.start), hourlyEndMs - 48 * 60 * 60 * 1_000),
    ).toISOString(),
    hourlyEnd: measuredAt,
    end: measuredAt,
  };
  const names: ResourceNames = { d1: d1DatabaseNames };
  const settled = await Promise.allSettled(
    collectors.map(async (collector) => {
      const collectorVariables =
        collector.name === "workers_ai"
          ? {
              ...variables,
              cycleStart: startOfUtcDay(measuredAt),
            }
          : variables;
      const data = await queryAnalytics(
        apiToken,
        collector.query(includeTrends),
        collectorVariables,
      );
      return {
        name: collector.name,
        result: collector.extract(getAccount(data), names),
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
        collector: collectors[index].name,
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
        daily: ${definition.dataset}(
          limit: 10000
          filter: {
            datetime_geq: $trendStart
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

function usageQuery(
  dataset: string,
  selection: string,
  includeTrends: boolean,
): string {
  const trendVariables = includeTrends
    ? `
    $trendStart: Time!
    $hourlyStart: Time!
    $hourlyEnd: Time!`
    : "";
  const trends = includeTrends
    ? `
        hourly: ${dataset}(
          limit: 10000
          filter: { datetime_geq: $hourlyStart, datetime_lt: $hourlyEnd }
        ) { ${withTimeDimension(selection, "datetimeHour")} }
        daily: ${dataset}(
          limit: 10000
          filter: { datetime_geq: $trendStart, datetime_lt: $end }
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

function withTimeDimension(selection: string, dimension: string): string {
  return selection.replace("dimensions {", `dimensions { ${dimension}`);
}

function extractDual(
  account: Record<string, unknown>,
  extract: (rows: Record<string, unknown>[]) => UsageValue[],
): CollectorResult {
  return {
    cycle: extract(getArray(account, "cycle")),
    recent: extract(getArray(account, "recent")),
    hourly: extractSeries(getOptionalArray(account, "hourly"), "datetimeHour", extract),
    daily: extractSeries(getOptionalArray(account, "daily"), "date", extract),
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
    current = asRecord(current, path.join("."))[segment];
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
