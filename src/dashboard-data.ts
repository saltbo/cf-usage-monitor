import {
  METRICS,
  PRODUCTS,
  PRODUCT_NAMES,
  type MetricName,
  type ProductName,
  type UsageSnapshot,
} from "./metrics";
import type {
  DetectionConfig,
  MonitorState,
  QuotaEvaluation,
  RiskLevel,
} from "./detection";

export interface DashboardMetric extends QuotaEvaluation {
  label: string;
  unit: string;
  period: "billing_cycle" | "utc_day";
  incident: {
    active: boolean;
    startedAt: string;
    notificationCount: number;
    recoveryStreak: number;
    recoverySamples: number;
    worstProjectedRatio: number;
  } | null;
  hourly: Array<{ timestamp: string; value: number }>;
  daily: Array<{ timestamp: string; value: number }>;
}

export interface DashboardProduct {
  name: ProductName;
  label: string;
  description: string;
  risk: RiskLevel;
  topMetric: MetricName;
  metrics: DashboardMetric[];
}

export interface DashboardData {
  schemaVersion: 2;
  generatedAt: string;
  accountName: string;
  status: "healthy" | "warning" | "critical" | "degraded";
  lastUpdated: string;
  source: string;
  cycle: UsageSnapshot["cycle"];
  summary: {
    critical: number;
    warning: number;
    products: number;
  };
  failures: UsageSnapshot["failures"];
  products: DashboardProduct[];
}

const RISK_SCORE: Record<RiskLevel, number> = {
  normal: 0,
  warning: 1,
  critical: 2,
  exceeded: 3,
};

export function buildDashboardData(
  state: MonitorState,
  snapshot: UsageSnapshot,
  config: DetectionConfig,
  accountName: string,
  generatedAt = new Date().toISOString(),
): DashboardData {
  if (!state.latest) {
    throw new Error("Monitor state has no quota evaluations");
  }
  const metrics = new Map(
    state.latest.map((evaluation) => [
      evaluation.metric,
      buildMetric(evaluation, state, snapshot, config),
    ]),
  );
  const products = PRODUCT_NAMES.map((name) =>
    buildProduct(name, metrics),
  ).sort(
    (left, right) =>
      RISK_SCORE[right.risk] - RISK_SCORE[left.risk] ||
      right.metrics[0].projectedRatio - left.metrics[0].projectedRatio,
  );
  const critical = products.filter(
    (product) =>
      product.risk === "critical" || product.risk === "exceeded",
  ).length;
  const warning = products.filter(
    (product) => product.risk === "warning",
  ).length;

  return {
    schemaVersion: 2,
    generatedAt,
    accountName,
    status:
      snapshot.failures.length > 0
        ? "degraded"
        : critical > 0
          ? "critical"
          : warning > 0
            ? "warning"
            : "healthy",
    lastUpdated: snapshot.measuredAt,
    source: "Cloudflare GraphQL Analytics · live estimate",
    cycle: snapshot.cycle,
    summary: {
      critical,
      warning,
      products: products.length,
    },
    failures: snapshot.failures,
    products,
  };
}

function buildMetric(
  evaluation: QuotaEvaluation,
  state: MonitorState,
  snapshot: UsageSnapshot,
  config: DetectionConfig,
): DashboardMetric {
  const definition = METRICS[evaluation.metric];
  const metricState = state.metrics[evaluation.metric];
  const incident = metricState?.incident;
  return {
    ...evaluation,
    label: definition.label,
    unit: definition.unit,
    period: definition.period,
    incident: incident
      ? {
          active: true,
          startedAt: incident.startedAt,
          notificationCount: incident.notificationCount,
          recoveryStreak: metricState.recoveryStreak,
          recoverySamples: config.recoverySamples,
          worstProjectedRatio: incident.worstProjectedRatio,
        }
      : null,
    hourly:
      snapshot.hourlySeries.find((series) => series.name === evaluation.metric)
        ?.points ?? [],
    daily:
      snapshot.dailySeries.find((series) => series.name === evaluation.metric)
        ?.points ?? [],
  };
}

function buildProduct(
  name: ProductName,
  metrics: ReadonlyMap<MetricName, DashboardMetric>,
): DashboardProduct {
  const productMetrics = [...metrics.values()]
    .filter((metric) => METRICS[metric.metric].product === name)
    .sort(
      (left, right) =>
        RISK_SCORE[right.risk] - RISK_SCORE[left.risk] ||
        right.projectedRatio - left.projectedRatio,
    );
  const top = productMetrics[0];
  if (!top) {
    throw new Error(`Product ${name} has no quota metrics`);
  }
  return {
    name,
    label: PRODUCTS[name].label,
    description: PRODUCTS[name].description,
    risk: top.risk,
    topMetric: top.metric,
    metrics: productMetrics,
  };
}
