import { billingCycleAt } from "./billing-cycle";

const API_BASE = "https://api.cloudflare.com/client/v4";

export async function loadBillingCycle(
  accountId: string,
  apiToken: string,
  now: number,
): Promise<{ start: string; end: string }> {
  const response = await fetch(
    `${API_BASE}/accounts/${accountId}/paygo-usage-info`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Cloudflare Billing returned HTTP ${response.status}: ${body}`,
    );
  }
  const payload: unknown = JSON.parse(body);
  const root = asRecord(payload, "Billing response");
  if (root.success !== true) {
    throw new Error(`Cloudflare Billing errors: ${JSON.stringify(root.errors)}`);
  }
  const result = asRecord(root.result, "Billing result");
  if (result.covered !== true) {
    throw new Error("Cloudflare account is not covered by PayGo usage");
  }
  if (!Array.isArray(result.subscriptions) || result.subscriptions.length === 0) {
    throw new Error("Cloudflare Billing returned no usage subscription");
  }
  const anchors = result.subscriptions.map((subscription) => {
    const record = asRecord(subscription, "Billing subscription");
    const value = record.billing_cycle_anchor_timestamp;
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
      throw new Error("Billing subscription has no valid cycle anchor");
    }
    return Date.parse(value);
  });
  const latestAnchor = Math.max(...anchors);
  return billingCycleAt(now, new Date(latestAnchor).getUTCDate());
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${name} to be an object`);
  }
  return value as Record<string, unknown>;
}
