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

export interface CostOverview {
  currency: string;
  totalCost: number;
  recentCost: number;
  postedThrough: string;
}

export interface CostPoint {
  timestamp: string;
  cost: number;
}

export interface CostLineItem {
  serviceName: string;
  consumedQuantity: number;
  consumedUnit: string;
  pricingQuantity: number;
  cost: number;
}

export interface ProductCostData extends CostOverview {
  daily: CostPoint[];
  lineItems: CostLineItem[];
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
  cost: CostOverview;
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
  cost: CostOverview;
  summary: DashboardData["summary"];
  failures: UsageSnapshot["failures"];
  products: OverviewProduct[];
}

export interface ProductDashboardData {
  generatedAt: string;
  lastUpdated: string;
  source: string;
  cycle: UsageSnapshot["cycle"];
  cost: ProductCostData;
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
