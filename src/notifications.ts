import type { QuotaAlert, QuotaRecovery } from "./detection";
import { METRICS, PRODUCTS } from "./metrics";

interface EventBase {
  schemaVersion: 2;
  detectedAt: string;
  account: { id: string; name: string };
}

export interface QuotaRiskEvent extends EventBase {
  type: "cloudflare.quota_risk";
  alerts: QuotaAlert[];
}

export interface QuotaRecoveredEvent extends EventBase {
  type: "cloudflare.quota_recovered";
  recoveries: QuotaRecovery[];
}

export interface MonitorErrorEvent extends EventBase {
  type: "cloudflare.monitor_error";
  errors: Array<{ collector: string; message: string }>;
}

export type AlertEvent =
  | QuotaRiskEvent
  | QuotaRecoveredEvent
  | MonitorErrorEvent;

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export async function sendNotifications(
  env: Env,
  event: AlertEvent,
): Promise<void> {
  await deliverAll([
    {
      name: "webhook",
      send: () => sendWebhook(env.ALERT_WEBHOOK_URL, event),
    },
    {
      name: "email",
      send: () => sendEmail(env, event),
    },
  ]);
}

export async function deliverAll(
  deliveries: ReadonlyArray<{
    name: string;
    send: () => Promise<void>;
  }>,
): Promise<void> {
  const results = await Promise.allSettled(
    deliveries.map((delivery) => delivery.send()),
  );
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          `${deliveries[index].name}: ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`,
        ]
      : [],
  );
  if (failures.length > 0) {
    throw new Error(`Notification delivery failed: ${failures.join("; ")}`);
  }
}

export function buildEmail(event: AlertEvent): EmailContent {
  const details =
    event.type === "cloudflare.quota_risk"
      ? event.alerts.map(alertLine)
      : event.type === "cloudflare.quota_recovered"
        ? event.recoveries.map(recoveryLine)
        : event.errors.map(
            (error) => `${error.collector}: ${error.message}`,
          );
  const title =
    event.type === "cloudflare.quota_risk"
      ? `Cloudflare quota risk: ${event.alerts.length} metric(s)`
      : event.type === "cloudflare.quota_recovered"
        ? `Cloudflare quota risk recovered: ${event.recoveries.length} metric(s)`
        : `Cloudflare monitor error: ${event.errors.length} collector(s)`;
  const subject = `[Cloudflare] ${title} on ${event.account.name}`;
  const text = [
    title,
    `Account: ${event.account.name} (${event.account.id})`,
    `Detected: ${event.detectedAt}`,
    "",
    ...details,
  ].join("\n");
  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p><strong>Account:</strong> ${escapeHtml(event.account.name)}</p>`,
    `<p><strong>Detected:</strong> ${escapeHtml(event.detectedAt)}</p>`,
    `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`,
  ].join("");
  return { subject, text, html };
}

function recoveryLine(recovery: QuotaRecovery): string {
  return (
    `${metricTitle(recovery.metric)} recovered; recent hourly usage ` +
    `${formatNumber(recovery.recentHourlyUsage)} ${
      METRICS[recovery.metric].unit
    } is below baseline ${formatNumber(recovery.baselineHourlyUsage)}; ` +
    `current quota usage ${formatPercent(recovery.usedRatio)} after ` +
    `${recovery.notificationCount} alert(s)`
  );
}

function alertLine(alert: QuotaAlert): string {
  const exhaustion = alert.exhaustsAt
    ? `; estimated exhaustion ${alert.exhaustsAt}`
    : "";
  const top = alert.recentContributors[0];
  const contributor = top
    ? `; top contributor ${top.name} (${formatNumber(top.value)} ${METRICS[alert.metric].unit} in the last hour)`
    : "";
  return (
    `${metricTitle(alert.metric)}: ${formatNumber(alert.used)} / ` +
    `${formatNumber(alert.quota)} used (${formatPercent(alert.usedRatio)}); ` +
    `projected ${formatPercent(alert.projectedRatio)} at period end` +
    `${exhaustion}; alert #${alert.notificationCount}${contributor}`
  );
}

function metricTitle(metric: QuotaAlert["metric"]): string {
  const definition = METRICS[metric];
  return `${PRODUCTS[definition.product].label} · ${definition.label}`;
}

async function sendWebhook(
  webhookUrl: string,
  event: AlertEvent,
): Promise<void> {
  const url = new URL(webhookUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ALERT_WEBHOOK_URL must use HTTP or HTTPS");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "cf-usage-monitor/0.2",
    },
    body: JSON.stringify(event),
  });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${(await response.text()).slice(0, 1_000)}`,
    );
  }
}

async function sendEmail(env: Env, event: AlertEvent): Promise<void> {
  const content = buildEmail(event);
  await env.EMAIL.send({
    to: env.ALERT_EMAIL_TO,
    from: {
      email: env.ALERT_EMAIL_FROM,
      name: "CF Usage Monitor",
    },
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
