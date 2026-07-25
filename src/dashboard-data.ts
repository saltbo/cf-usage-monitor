import {
  METRICS,
  PRODUCTS,
  PRODUCT_NAMES,
  type MetricName,
  type ProductName,
  type UsageSnapshot,
} from "./metrics";
import {
  productCost,
  type BillingCosts,
} from "./costs";
import type {
  AlertPolicy,
  DetectionConfig,
  MonitorState,
  QuotaEvaluation,
  RiskLevel,
} from "./detection";
import type {
  DashboardData,
  DashboardMetric,
  DashboardProduct,
  OverviewData,
} from "./shared/dashboard";

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

export function buildOverviewData(
  dashboard: DashboardData,
  costs: BillingCosts,
): OverviewData {
  return {
    schemaVersion: dashboard.schemaVersion,
    generatedAt: dashboard.generatedAt,
    accountName: dashboard.accountName,
    status: dashboard.status,
    lastUpdated: dashboard.lastUpdated,
    source: dashboard.source,
    cycle: dashboard.cycle,
    cost: costs.overview,
    summary: dashboard.summary,
    failures: dashboard.failures,
    products: dashboard.products.map((product) => {
      const cost = productCost(costs, product.name);
      return {
        name: product.name,
        label: product.label,
        description: product.description,
        risk: product.risk,
        cost: {
          currency: cost.currency,
          totalCost: cost.totalCost,
          recentCost: cost.recentCost,
          postedThrough: cost.postedThrough,
        },
        metrics: product.metrics.map((metric) => ({
          metric: metric.metric,
          label: metric.label,
          unit: metric.unit,
          risk: metric.risk,
          used: metric.used,
          quota: metric.quota,
          usedRatio: metric.usedRatio,
          forecastProjectedRatio: metric.forecastProjectedRatio,
          alertStatus: metric.alertStatus,
        })),
      };
    }),
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
  const alertPolicy = config.policies[evaluation.metric] ?? "strict";
  const alertStatus =
    alertPolicy === "track_only"
      ? "track_only"
      : incident
        ? "active"
        : metricState?.recoveredForPeriod
          ? "recovered"
          : (metricState?.riskStreak ?? 0) > 0
            ? "pending"
            : "normal";
  return {
    ...evaluation,
    label: definition.label,
    unit: definition.unit,
    period: definition.period,
    alertPolicy,
    alertStatus,
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
