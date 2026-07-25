import type {
  AlertPolicy,
  QuotaEvaluation,
  RiskLevel,
} from "../detection";
import type {
  MetricName,
  ProductName,
  UsageSeries,
  UsageSnapshot,
} from "../metrics";

export interface DashboardMetric extends QuotaEvaluation {
  label: string;
  unit: string;
  period: "billing_cycle" | "utc_day";
  alertPolicy: AlertPolicy;
  alertStatus: "normal" | "pending" | "active" | "recovered" | "track_only";
  incident: {
    active: boolean;
    startedAt: string;
    notificationCount: number;
    recoveryStreak: number;
    recoverySamples: number;
    worstProjectedRatio: number;
  } | null;
  hourly: UsageSeries["points"];
  daily: UsageSeries["points"];
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

export type OverviewMetric = Pick<
  DashboardMetric,
  | "metric"
  | "label"
  | "unit"
  | "risk"
  | "used"
  | "quota"
  | "usedRatio"
  | "forecastProjectedRatio"
  | "alertStatus"
>;

export interface OverviewProduct {
  name: ProductName;
  label: string;
  description: string;
  risk: RiskLevel;
  metrics: OverviewMetric[];
}

export interface OverviewData {
  schemaVersion: 2;
  generatedAt: string;
  accountName: string;
  status: DashboardData["status"];
  lastUpdated: string;
  source: string;
  cycle: UsageSnapshot["cycle"];
  summary: DashboardData["summary"];
  failures: UsageSnapshot["failures"];
  products: OverviewProduct[];
}

export interface ProductDashboardData {
  generatedAt: string;
  lastUpdated: string;
  source: string;
  cycle: UsageSnapshot["cycle"];
  failures: UsageSnapshot["failures"];
  product: DashboardProduct;
}

export interface InstanceUsageTrends {
  metric: MetricName;
  instanceId: string;
  measuredAt: string;
  cycleStart: string;
  forecastHourlyUsage: number;
  forecastDailyUsage: number;
  hourly: UsageSeries["points"];
  daily: UsageSeries["points"];
}
