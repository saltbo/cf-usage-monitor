import { collectInstanceUsage, collectQuotaUsage } from "./analytics";
import { isDashboardAuthorized, unauthorizedResponse } from "./auth";
import { loadBillingCycle } from "./billing";
import {
  DASHBOARD_CSS,
  DASHBOARD_HTML,
  DASHBOARD_JS,
} from "./dashboard-page";
import {
  detectQuotaRisks,
  SAMPLE_INTERVAL_MINUTES,
  type DetectionConfig,
  type MonitorState,
} from "./detection";
import { loadLatestDashboard } from "./live-dashboard";
import {
  sendNotifications,
  type AlertEvent,
  type MonitorErrorEvent,
  type QuotaRecoveredEvent,
  type QuotaRiskEvent,
} from "./notifications";
import { METRIC_NAMES, type MetricName } from "./metrics";

const STATE_KEY = "monitor-state-v2";
const SAMPLE_INTERVAL_MS = SAMPLE_INTERVAL_MINUTES * 60 * 1_000;
const ANALYTICS_DELAY_MS = 5 * 60 * 1_000;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "cf-usage-monitor" });
    }
    if (!(await isDashboardAuthorized(request, env.DASHBOARD_PASSWORD))) {
      return unauthorizedResponse();
    }
    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname.startsWith("/usage/"))
    ) {
      return assetResponse(DASHBOARD_HTML, "text/html; charset=utf-8");
    }
    if (request.method === "GET" && url.pathname === "/dashboard.css") {
      return assetResponse(DASHBOARD_CSS, "text/css; charset=utf-8");
    }
    if (request.method === "GET" && url.pathname === "/dashboard.js") {
      return assetResponse(DASHBOARD_JS, "text/javascript; charset=utf-8");
    }
    if (request.method === "GET" && url.pathname === "/api/usage") {
      const state = (await env.STATE.get<MonitorState>(STATE_KEY, "json")) ?? {
        metrics: {},
      };
      const dashboard = await loadLatestDashboard({
        state,
        config: readConfig(env),
        accountId: env.CF_ACCOUNT_ID,
        accountName: env.ACCOUNT_NAME,
        apiToken: env.CF_API_TOKEN,
        d1DatabaseNames: readD1DatabaseNames(env),
      });
      return Response.json(dashboard, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (request.method === "GET" && url.pathname === "/api/instance-usage") {
      const metric = url.searchParams.get("metric");
      const instanceId = url.searchParams.get("instance");
      if (!metric || !METRIC_NAMES.includes(metric as MetricName)) {
        return Response.json(
          { error: "metric must be a supported quota metric" },
          { status: 400 },
        );
      }
      if (!instanceId) {
        return Response.json(
          { error: "instance must be a non-empty resource identifier" },
          { status: 400 },
        );
      }
      const measuredAt = new Date(Date.now() - ANALYTICS_DELAY_MS).toISOString();
      const cycle = await loadBillingCycle(
        env.CF_ACCOUNT_ID,
        env.CF_API_TOKEN,
        Date.parse(measuredAt),
      );
      const trends = await collectInstanceUsage(
        env.CF_ACCOUNT_ID,
        env.CF_API_TOKEN,
        metric as MetricName,
        instanceId,
        cycle.start,
        measuredAt,
      );
      return Response.json(trends, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(controller, env): Promise<void> {
    await runMonitor(controller.scheduledTime, env);
  },
} satisfies ExportedHandler<Env>;

async function runMonitor(scheduledTime: number, env: Env): Promise<void> {
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

  const cycle = await loadBillingCycle(
    env.CF_ACCOUNT_ID,
    env.CF_API_TOKEN,
    measuredAtMs,
  );
  const snapshot = await collectQuotaUsage(
    env.CF_ACCOUNT_ID,
    env.CF_API_TOKEN,
    cycle,
    measuredAt,
    readD1DatabaseNames(env),
  );
  const detection = detectQuotaRisks(previous, snapshot, readConfig(env));
  const base = {
    schemaVersion: 2,
    detectedAt: new Date(scheduledTime).toISOString(),
    account: {
      id: env.CF_ACCOUNT_ID,
      name: env.ACCOUNT_NAME,
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
  await env.STATE.put(STATE_KEY, JSON.stringify(detection.state));
  await Promise.all(events.map((event) => sendNotifications(env, event)));
  log("info", "monitor_completed", {
    measuredAt,
    failedCollectors: snapshot.failures.length,
    alerts: detection.alerts.length,
    recoveries: detection.recoveries.length,
  });
}

function readConfig(env: Env): DetectionConfig {
  return {
    alertAfterSamples: readPositiveInteger(
      env.ALERT_AFTER_SAMPLES,
      "ALERT_AFTER_SAMPLES",
    ),
    recoverySamples: readPositiveInteger(
      env.RECOVERY_SAMPLES,
      "RECOVERY_SAMPLES",
    ),
    reminderMinutes: readPositiveInteger(
      env.REMINDER_MINUTES,
      "REMINDER_MINUTES",
    ),
  };
}

function readD1DatabaseNames(env: Env): Record<string, string> {
  const source = asRecord(env.D1_DATABASE_NAMES, "D1_DATABASE_NAMES");
  return Object.fromEntries(
    Object.entries(source).map(([id, name]) => {
      if (typeof name !== "string" || name.length === 0) {
        throw new Error(`D1_DATABASE_NAMES.${id} must be a non-empty string`);
      }
      return [id, name];
    }),
  );
}

function readPositiveInteger(value: unknown, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function log(
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  console[level](JSON.stringify({ level, event, ...fields }));
}

function assetResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; " +
        "connect-src 'self'; img-src 'self' data:; object-src 'none'; " +
        "base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "Content-Type": contentType,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}
