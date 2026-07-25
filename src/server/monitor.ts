import { collectQuotaUsage } from "../analytics";
import { loadBillingCycle } from "../billing";
import {
  detectQuotaRisks,
  SAMPLE_INTERVAL_MINUTES,
  type MonitorState,
} from "../detection";
import {
  sendNotifications,
  type AlertEvent,
  type MonitorErrorEvent,
  type QuotaRecoveredEvent,
  type QuotaRiskEvent,
} from "../notifications";
import { PRODUCT_NAMES } from "../metrics";
import { readDetectionConfig } from "./config";
import {
  loadAccountName,
  loadResourceNames,
} from "./resource-catalog";

const STATE_KEY = "monitor-state-v2";
const SAMPLE_INTERVAL_MS = SAMPLE_INTERVAL_MINUTES * 60 * 1_000;
const ANALYTICS_DELAY_MS = 5 * 60 * 1_000;

export async function runMonitor(
  scheduledTime: number,
  env: Env,
): Promise<void> {
  const measuredAtMs =
    Math.floor(
      (scheduledTime - ANALYTICS_DELAY_MS) / SAMPLE_INTERVAL_MS,
    ) * SAMPLE_INTERVAL_MS;
  const measuredAt = new Date(measuredAtMs).toISOString();
  const previous = (await env.STATE.get<MonitorState>(STATE_KEY, "json")) ?? {
    metrics: {},
  };
  if (previous.lastWindowEnd === measuredAt) {
    log("info", "duplicate_window_skipped", { measuredAt });
    return;
  }

  const [cycle, accountName, resourceNames] = await Promise.all([
    loadBillingCycle(
      env.CF_ACCOUNT_ID,
      env.CF_API_TOKEN,
      measuredAtMs,
    ),
    loadAccountName(env),
    loadResourceNames(env, PRODUCT_NAMES),
  ]);
  const snapshot = await collectQuotaUsage(
    env.CF_ACCOUNT_ID,
    env.CF_API_TOKEN,
    cycle,
    measuredAt,
    resourceNames,
  );
  const detection = detectQuotaRisks(
    previous,
    snapshot,
    readDetectionConfig(env),
  );
  const base = {
    schemaVersion: 2,
    detectedAt: new Date(scheduledTime).toISOString(),
    account: {
      id: env.CF_ACCOUNT_ID,
      name: accountName,
    },
  } as const;
  const events: AlertEvent[] = [];

  if (detection.alerts.length > 0) {
    const event: QuotaRiskEvent = {
      ...base,
      type: "cloudflare.quota_risk",
      alerts: detection.alerts,
    };
    events.push(event);
  }
  if (detection.recoveries.length > 0) {
    const event: QuotaRecoveredEvent = {
      ...base,
      type: "cloudflare.quota_recovered",
      recoveries: detection.recoveries,
    };
    events.push(event);
  }
  if (snapshot.failures.length > 0) {
    const event: MonitorErrorEvent = {
      ...base,
      type: "cloudflare.monitor_error",
      errors: snapshot.failures,
    };
    events.push(event);
  }

  detection.state.lastRun = {
    detectedAt: base.detectedAt,
    failures: snapshot.failures,
    alerts: detection.alerts,
    recoveries: detection.recoveries,
  };
  await Promise.all(events.map((event) => sendNotifications(env, event)));
  await env.STATE.put(STATE_KEY, JSON.stringify(detection.state));
  log("info", "monitor_completed", {
    measuredAt,
    failedCollectors: snapshot.failures.length,
    alerts: detection.alerts.length,
    recoveries: detection.recoveries.length,
  });
}

function log(
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  console[level](JSON.stringify({ level, event, ...fields }));
}
