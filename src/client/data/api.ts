import type {
  InstanceUsageTrends,
  OverviewData,
  ProductDashboardData,
} from "../../shared/dashboard";
import type { MetricName, ProductName } from "../../metrics";
import i18n from "../i18n";

export function loadOverview(signal?: AbortSignal): Promise<OverviewData> {
  return getJson("/api/overview", signal);
}

export function loadProduct(
  productName: ProductName,
  signal?: AbortSignal,
): Promise<ProductDashboardData> {
  return getJson(`/api/products/${productName}`, signal);
}

export function loadInstanceUsage(
  metric: MetricName,
  instanceId: string,
  signal?: AbortSignal,
): Promise<InstanceUsageTrends> {
  const search = new URLSearchParams({ metric, instance: instanceId });
  return getJson(`/api/instance-usage?${search}`, signal);
}

async function getJson<T>(
  url: string,
  signal?: AbortSignal,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(i18n.t("errors.request", { status: response.status }));
  }
  return (await response.json()) as T;
}
