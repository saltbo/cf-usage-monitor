import { collectQuotaUsage } from "./analytics";
import { loadBillingCycle } from "./billing";
import {
  buildDashboardData,
  type DashboardData,
} from "./dashboard-data";
import {
  detectQuotaRisks,
  type DetectionConfig,
  type MonitorState,
} from "./detection";
import type { UsageSnapshot } from "./metrics";

type CollectUsage = typeof collectQuotaUsage;
type LoadCycle = typeof loadBillingCycle;

interface LatestDashboardInput {
  state: MonitorState;
  config: DetectionConfig;
  accountId: string;
  accountName: string;
  apiToken: string;
  d1DatabaseNames?: Record<string, string>;
  now?: number;
  collect?: CollectUsage;
  loadCycle?: LoadCycle;
}

export async function loadLatestDashboard({
  state,
  config,
  accountId,
  accountName,
  apiToken,
  d1DatabaseNames = {},
  now = Date.now(),
  collect = collectQuotaUsage,
  loadCycle = loadBillingCycle,
}: LatestDashboardInput): Promise<DashboardData> {
  const measuredAt = new Date(now - 5 * 60 * 1_000).toISOString();
  const cycle = await loadCycle(
    accountId,
    apiToken,
    Date.parse(measuredAt),
  );
  const snapshot: UsageSnapshot = await collect(
    accountId,
    apiToken,
    cycle,
    measuredAt,
    d1DatabaseNames,
    true,
  );
  const detection = detectQuotaRisks(
    structuredClone(state),
    snapshot,
    config,
  );
  return buildDashboardData(
    detection.state,
    snapshot,
    config,
    accountName,
    new Date(now).toISOString(),
  );
}
