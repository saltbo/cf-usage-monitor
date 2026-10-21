import { afterEach, describe, expect, it, vi } from "vitest";
import { runMonitor } from "../src/server/monitor";

const SCHEDULED_TIME = Date.parse("2026-10-20T23:10:00.000Z");

describe("monitor resilience", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("still alerts on quota risk when the resource catalog is unavailable", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      // Any resource-catalog listing fails, like the containers per_page limit did.
      if (/\/(d1\/database|storage\/kv\/namespaces|queues|containers\/applications)/.test(url)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              errors: [
                {
                  message:
                    '{"error":"VALIDATE_INPUT","details":' +
                    '{"per_page":"per_page must be an integer between 1 and 500"}}',
                },
              ],
            }),
            { status: 400 },
          ),
        );
      }
      if (url.includes("paygo-usage-info")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              result: {
                covered: true,
                subscriptions: [
                  {
                    billing_cycle_anchor_timestamp:
                      "2026-10-04T00:00:00Z",
                  },
                ],
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/accounts/")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              result: { id: "account-id", name: "Example Account" },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("graphql")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                viewer: {
                  accounts: [
                    {
                      cycle: [
                        {
                          dimensions: { scriptName: "app" },
                          sum: {
                            requests: 9_500_000,
                            cpuTimeUs: 1_000_000,
                          },
                        },
                      ],
                      recent: [
                        {
                          dimensions: { scriptName: "app" },
                          sum: { requests: 100_000, cpuTimeUs: 10_000 },
                        },
                      ],
                    },
                  ],
                },
              },
              errors: null,
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const sent: Array<{ type: string }> = [];
    const notifications = await import("../src/notifications");
    vi.spyOn(notifications, "sendNotifications").mockImplementation(
      async (_env, event) => {
        sent.push(event);
      },
    );

    const state = fakeState();
    await runMonitor(SCHEDULED_TIME, {
      STATE: state.namespace,
      CF_ACCOUNT_ID: "account-id",
      CF_API_TOKEN: "token",
      ALERT_WEBHOOK_URL: "https://example.com/webhook",
      ALERT_EMAIL_FROM: "alerts@example.com",
      ALERT_EMAIL_TO: "owner@example.com",
      DASHBOARD_PASSWORD: "password",
      ALERT_AFTER_SAMPLES: "1",
      RECOVERY_SAMPLES: "3",
      REMINDER_MINUTES: "60",
      USAGE_ALERT_POLICIES: {},
    } as unknown as Env);

    // Quota alerting still happens despite the catalog outage.
    expect(sent.some((event) => event.type === "cloudflare.quota_risk")).toBe(true);
    // The catalog outage is reported as a monitor error instead of being hidden.
    expect(sent.some((event) => event.type === "cloudflare.monitor_error")).toBe(true);
    // The run still committed its state, so the next window can advance.
    expect(state.put).toHaveBeenCalled();
  });
});

function fakeState(): {
  namespace: KVNamespace;
  put: ReturnType<typeof vi.fn>;
} {
  const values = new Map<string, string>();
  const put = vi.fn(async (key: string, value: string) => {
    values.set(key, value);
  });
  return {
    namespace: {
      get: vi.fn(async (key: string, type?: string) => {
        const value = values.get(key);
        if (value === undefined) {
          return null;
        }
        return type === "json" ? JSON.parse(value) : value;
      }),
      put,
    } as unknown as KVNamespace,
    put,
  };
}
