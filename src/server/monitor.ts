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
import { PRODUCT_NAMES, type ProductName } from "../metrics";
import { readDetectionConfig } from "./config";
import {
  loadAccountName,
  loadResourceNames,
  type ResourceNames,
} from "./resource-catalog";

const STATE_KEY = "monitor-state-v2";
const SAMPLE_INTERVAL_MS = SAMPLE_INTERVAL_MINUTES * 60 * 1_000;
const ANALYTICS_DELAY_MS = 5 * 60 * 1_000;

type MonitorErrorEntry = MonitorErrorEvent["errors"][number];

export interface MonitorOutcome {
  /**
   * False when the run was skipped because the window was already
   * processed. A skipped run must not refresh the watchdog heartbeat,
   * otherwise a monitor that stopped collecting would look healthy.
   */
  collected: boolean;
}

export async function runMonitor(
  scheduledTime: number,
  env: Env,
): Promise<MonitorOutcome> {
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
    return { collected: false };
  }

  const [cycle, accountName, resourceNames] = await Promise.all([
    loadBillingCycle(
      env.CF_ACCOUNT_ID,
      env.CF_API_TOKEN,
      measuredAtMs,
    ),
    loadAccountNameOrFallback(env),
    loadResourceNamesOrFallback(env, PRODUCT_NAMES),
  ]);
  const snapshot = await collectQuotaUsage(
    env.CF_ACCOUNT_ID,
    env.CF_API_TOKEN,
    cycle,
    measuredAt,
    resourceNames.names,
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
  const failures = [...snapshot.failures, ...resourceNames.failures];
  if (failures.length > 0) {
    const event: MonitorErrorEvent = {
      ...base,
      type: "cloudflare.monitor_error",
      errors: failures,
    };
    events.push(event);
  }

  detection.state.lastRun = {
    detectedAt: base.detectedAt,
    failures,
    alerts: detection.alerts,
    recoveries: detection.recoveries,
  };
  await Promise.all(events.map((event) => sendNotifications(env, event)));
  await env.STATE.put(STATE_KEY, JSON.stringify(detection.state));
  log("info", "monitor_completed", {
    measuredAt,
    failedCollectors: failures.length,
    alerts: detection.alerts.length,
    recoveries: detection.recoveries.length,
  });
  return { collected: true };
}

/**
 * Resource display names are cosmetic. A catalog outage must never silence
 * quota alerting, so failures degrade to raw identifiers and surface as a
 * monitor error instead of aborting the whole run.
 */
async function loadResourceNamesOrFallback(
  env: Env,
  products: readonly ProductName[],
): Promise<{ names: ResourceNames; failures: MonitorErrorEntry[] }> {
  try {
    return {
      names: await loadResourceNames(env, products),
      failures: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "resource_catalog_unavailable", { message });
    return {
      names: {},
      failures: [{ collector: "resource_catalog", message }],
    };
  }
}

async function loadAccountNameOrFallback(env: Env): Promise<string> {
  try {
    return await loadAccountName(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "account_name_unavailable", { message });
    return env.CF_ACCOUNT_ID;
  }
}

function log(
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  console[level](JSON.stringify({ level, event, ...fields }));
}
