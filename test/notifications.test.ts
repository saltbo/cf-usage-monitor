import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBark,
  buildEmail,
  deliverAll,
  sendBark,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

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
      "is below baseline 67,204.3",
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

describe("Bark notifications", () => {
  it("builds a concise Bark message", () => {
    const message = buildBark({
      ...base,
      type: "cloudflare.quota_risk",
      alerts: [alert()],
    });

    expect(message.title).toBe(
      "[Cloudflare] Cloudflare quota risk: 1 metric(s) on primary",
    );
    expect(message.body).toContain("Account: primary (account-id)");
    expect(message.body).toContain("D1 · Rows written");
    expect(message.group).toBe("cf-usage-monitor");
    expect(message.level).toBe("critical");
  });

  it("maps event severity to Bark interruption levels", () => {
    expect(
      buildBark({
        ...base,
        type: "cloudflare.quota_risk",
        alerts: [{ ...alert(), risk: "warning" }],
      }).level,
    ).toBe("timeSensitive");
    expect(
      buildBark({
        ...base,
        type: "cloudflare.monitor_error",
        errors: [{ collector: "workers", message: "failed" }],
      }).level,
    ).toBe("active");
    expect(
      buildBark({
        ...base,
        type: "cloudflare.quota_recovered",
        recoveries: [{ ...alert(), risk: "normal" }],
      }).level,
    ).toBe("passive");
  });

  it("posts JSON with an event level and keeps other Bark query options", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 200, message: "success" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendBark(
      "https://api.day.app/device-key/copied-test-body?level=critical&volume=8",
      {
        ...base,
        type: "cloudflare.quota_risk",
        alerts: [alert()],
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(input.toString()).toBe(
      "https://api.day.app/device-key?volume=8",
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "cf-usage-monitor/0.2",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      title: "[Cloudflare] Cloudflare quota risk: 1 metric(s) on primary",
      group: "cf-usage-monitor",
      level: "critical",
    });
  });

  it("reports Bark HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("invalid device key", { status: 400 }),
        ),
    );

    await expect(
      sendBark("https://api.day.app/device-key", {
        ...base,
        type: "cloudflare.monitor_error",
        errors: [{ collector: "workers", message: "failed" }],
      }),
    ).rejects.toThrow("HTTP 400: invalid device key");
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
    baselineHourlyUsage: 67_204.3,
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
