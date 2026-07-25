export const PRODUCTS = {
  workers: { label: "Workers", description: "Requests and CPU time" },
  d1: { label: "D1", description: "Rows read and written" },
  kv: { label: "Workers KV", description: "Key operations" },
  r2: { label: "R2", description: "Class A and B operations" },
  durable_objects: {
    label: "Durable Objects",
    description: "Compute requests",
  },
  queues: { label: "Queues", description: "Billable operations" },
  workers_ai: { label: "Workers AI", description: "Daily neurons" },
  containers: { label: "Containers", description: "vCPU time" },
} as const;

export type ProductName = keyof typeof PRODUCTS;
export type QuotaPeriod = "billing_cycle" | "utc_day";

export const METRICS = {
  "workers.requests": {
    product: "workers",
    label: "Requests",
    unit: "requests",
    quota: 10_000_000,
    period: "billing_cycle",
  },
  "workers.cpu_milliseconds": {
    product: "workers",
    label: "CPU time",
    unit: "CPU ms",
    quota: 30_000_000,
    period: "billing_cycle",
  },
  "d1.rows_read": {
    product: "d1",
    label: "Rows read",
    unit: "rows",
    quota: 25_000_000_000,
    period: "billing_cycle",
  },
  "d1.rows_written": {
    product: "d1",
    label: "Rows written",
    unit: "rows",
    quota: 50_000_000,
    period: "billing_cycle",
  },
  "kv.reads": {
    product: "kv",
    label: "Keys read",
    unit: "operations",
    quota: 10_000_000,
    period: "billing_cycle",
  },
  "kv.writes": {
    product: "kv",
    label: "Keys written",
    unit: "operations",
    quota: 1_000_000,
    period: "billing_cycle",
  },
  "kv.deletes": {
    product: "kv",
    label: "Keys deleted",
    unit: "operations",
    quota: 1_000_000,
    period: "billing_cycle",
  },
  "kv.lists": {
    product: "kv",
    label: "List requests",
    unit: "operations",
    quota: 1_000_000,
    period: "billing_cycle",
  },
  "r2.class_a_operations": {
    product: "r2",
    label: "Class A operations",
    unit: "operations",
    quota: 1_000_000,
    period: "billing_cycle",
  },
  "r2.class_b_operations": {
    product: "r2",
    label: "Class B operations",
    unit: "operations",
    quota: 10_000_000,
    period: "billing_cycle",
  },
  "durable_objects.requests": {
    product: "durable_objects",
    label: "Requests",
    unit: "requests",
    quota: 1_000_000,
    period: "billing_cycle",
  },
  "queues.operations": {
    product: "queues",
    label: "Billable operations",
    unit: "operations",
    quota: 1_000_000,
    period: "billing_cycle",
  },
  "workers_ai.neurons": {
    product: "workers_ai",
    label: "Neurons",
    unit: "neurons",
    quota: 10_000,
    period: "utc_day",
  },
  "containers.cpu_seconds": {
    product: "containers",
    label: "vCPU time",
    unit: "vCPU seconds",
    quota: 22_500,
    period: "billing_cycle",
  },
} as const satisfies Record<
  string,
  {
    product: ProductName;
    label: string;
    unit: string;
    quota: number;
    period: QuotaPeriod;
  }
>;

export type MetricName = keyof typeof METRICS;
export const METRIC_NAMES = Object.keys(METRICS) as MetricName[];
export const PRODUCT_NAMES = Object.keys(PRODUCTS) as ProductName[];

export interface MetricContributor {
  id: string;
  name: string;
  value: number;
}

export interface UsageValue {
  name: MetricName;
  value: number;
  contributors: MetricContributor[];
}

export interface UsageSeries {
  name: MetricName;
  points: Array<{
    timestamp: string;
    value: number;
  }>;
}

export interface UsageSnapshot {
  measuredAt: string;
  cycle: {
    start: string;
    end: string;
  };
  values: UsageValue[];
  recentValues: UsageValue[];
  hourlySeries: UsageSeries[];
  dailySeries: UsageSeries[];
  failures: Array<{
    collector: string;
    message: string;
  }>;
}
