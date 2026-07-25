import { describe, expect, it } from "vitest";
import {
  buildEmail,
  deliverAll,
  type MonitorErrorEvent,
  type QuotaRecoveredEvent,
  type QuotaRiskEvent,
} from "../src/notifications";
import type { QuotaAlert } from "../src/detection";

const base = {
  schemaVersion: 2,
  detectedAt: "2026-07-24T11:10:00.000Z",
  account: { id: "account-id", name: "primary" },
} as const;

describe("email notifications", () => {
  it("explains quota risk and the top contributor", () => {
    const event: QuotaRiskEvent = {
      ...base,
      type: "cloudflare.quota_risk",
      alerts: [alert()],
    };
    const email = buildEmail(event);

    expect(email.subject).toBe(
      "[Cloudflare] Cloudflare quota risk: 1 metric(s) on primary",
    );
    expect(email.text).toContain("D1 · Rows written");
    expect(email.text).toContain("projected 160.0%");
    expect(email.text).toContain("top contributor orders-db");
  });

  it("formats recovery and monitor failure messages", () => {
    const recovery: QuotaRecoveredEvent = {
      ...base,
      type: "cloudflare.quota_recovered",
      recoveries: [{ ...alert(), projectedRatio: 0.7 }],
    };
    expect(buildEmail(recovery).text).toContain(
      "projected 70.0% at period end",
    );

    const failure: MonitorErrorEvent = {
      ...base,
      type: "cloudflare.monitor_error",
      errors: [
        { collector: "workers", message: "request <failed> & stopped" },
      ],
    };
    expect(buildEmail(failure).html).toContain(
      "request &lt;failed&gt; &amp; stopped",
    );
  });
});

describe("notification delivery", () => {
  it("attempts every delivery and reports failures", async () => {
    const attempted: string[] = [];
    await expect(
      deliverAll([
        {
          name: "webhook",
          send: async () => {
            attempted.push("webhook");
            throw new Error("unavailable");
          },
        },
        {
          name: "email",
          send: async () => {
            attempted.push("email");
          },
        },
      ]),
    ).rejects.toThrow("webhook: unavailable");
    expect(attempted).toEqual(["webhook", "email"]);
  });
});

function alert(): QuotaAlert {
  return {
    metric: "d1.rows_written",
    used: 30_000_000,
    quota: 50_000_000,
    recentHourlyUsage: 100_000,
    safeHourlyUsage: 20_000,
    burnRate: 5,
    usedRatio: 0.6,
    projectedUsage: 80_000_000,
    projectedRatio: 1.6,
    forecastHourlyUsage: 60_000,
    forecastHourlySamples: 6,
    forecastDailyUsage: 1_200_000,
    forecastDailySamples: 7,
    forecastProjectedUsage: 55_000_000,
    forecastProjectedRatio: 1.1,
    exhaustsAt: "2026-08-01T00:00:00.000Z",
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-08-10T00:00:00.000Z",
    risk: "critical",
    contributors: [
      { id: "orders", name: "orders-db", value: 30_000_000 },
    ],
    recentContributors: [
      { id: "orders", name: "orders-db", value: 100_000 },
    ],
    incidentStartedAt: "2026-07-24T11:00:00.000Z",
    notificationCount: 2,
  };
}
