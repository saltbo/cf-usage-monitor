import type { MetricName, ProductName } from "../../metrics";
import i18n from "../i18n";

const UNIT_KEYS: Record<string, string> = {
  requests: "requests",
  "CPU ms": "cpu_ms",
  rows: "rows",
  operations: "operations",
  "GB-month": "gb_month",
  "GB-months": "gb_month",
  neurons: "neurons",
  "vCPU seconds": "vcpu_seconds",
  "vCPU-seconds": "vcpu_seconds",
  seconds: "seconds",
  minutes: "minutes",
  bytes: "bytes",
  GB: "gb",
  Gigabytes: "gb",
  "GB-seconds": "gb_seconds",
  "GiB-seconds": "gib_seconds",
  "vCPU minutes": "vcpu_minutes",
};

export function productLabel(product: ProductName): string {
  return i18n.t(`products.${product}.label`);
}

export function productDescription(product: ProductName): string {
  return i18n.t(`products.${product}.description`);
}

export function metricLabel(metric: MetricName): string {
  return i18n.t(`metrics.${metric}`);
}

export function formatUnit(unit: string): string {
  if (unit.length === 0) {
    return "";
  }
  const key = UNIT_KEYS[unit];
  return key ? i18n.t(`units.${key}`) : unit;
}
