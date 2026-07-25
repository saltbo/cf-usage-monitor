import { collectQuotaUsage } from "../analytics";
import { loadBillingCycle } from "../billing";
import { buildDashboardData } from "../dashboard-data";
import { detectQuotaRisks, type MonitorState } from "../detection";
import type { ProductName } from "../metrics";
import type { ProductDashboardData } from "../shared/dashboard";
import { readDetectionConfig } from "./config";
import {
  loadAccountName,
  loadResourceNames,
} from "./resource-catalog";

const ANALYTICS_DELAY_MS = 5 * 60 * 1_000;

export async function loadProductDashboard(
  productName: ProductName,
  state: MonitorState,
  env: Env,
  now = Date.now(),
): Promise<ProductDashboardData> {
  const measuredAt = new Date(now - ANALYTICS_DELAY_MS).toISOString();
  const config = readDetectionConfig(env);
  const [cycle, accountName, resourceNames] = await Promise.all([
    loadBillingCycle(
      env.CF_ACCOUNT_ID,
      env.CF_API_TOKEN,
      Date.parse(measuredAt),
    ),
    loadAccountName(env),
    loadResourceNames(env, [productName]),
  ]);
  const snapshot = await collectQuotaUsage(
    env.CF_ACCOUNT_ID,
    env.CF_API_TOKEN,
    cycle,
    measuredAt,
    resourceNames,
    true,
    productName,
  );
  const detection = detectQuotaRisks(
    structuredClone(state),
    snapshot,
    config,
  );
  const dashboard = buildDashboardData(
    detection.state,
    snapshot,
    config,
    accountName,
    new Date(now).toISOString(),
  );
  const product = dashboard.products.find(
    (candidate) => candidate.name === productName,
  );
  if (!product) {
    throw new Error(`Product ${productName} has no dashboard data`);
  }
  return {
    generatedAt: dashboard.generatedAt,
    lastUpdated: dashboard.lastUpdated,
    source: dashboard.source,
    cycle: dashboard.cycle,
    failures: dashboard.failures,
    product,
  };
}
