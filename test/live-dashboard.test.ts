import { describe, expect, it, vi } from "vitest";
import { loadLatestDashboard } from "../src/live-dashboard";
import type { DetectionConfig } from "../src/detection";
import { METRIC_NAMES } from "../src/metrics";

const config: DetectionConfig = {
  alertAfterSamples: 2,
  recoverySamples: 3,
  reminderMinutes: 60,
};

describe("latest dashboard", () => {
  it("queries Cloudflare directly for the current billing cycle", async () => {
    const collect = vi.fn().mockImplementation(
      async (
        _accountId: string,
        _token: string,
        cycle: { start: string; end: string },
        measuredAt: string,
      ) => ({
        measuredAt,
        cycle,
        values: METRIC_NAMES.map((name) => ({
          name,
          value: 0,
          contributors: [],
        })),
        recentValues: METRIC_NAMES.map((name) => ({
          name,
          value: 0,
          contributors: [],
        })),
        hourlySeries: METRIC_NAMES.map((name) => ({ name, points: [] })),
        dailySeries: METRIC_NAMES.map((name) => ({ name, points: [] })),
        failures: [],
      }),
    );

    const dashboard = await loadLatestDashboard({
      state: { metrics: {} },
      config,
      accountId: "account",
      accountName: "primary",
      apiToken: "token",
      now: Date.parse("2026-07-24T12:35:00.000Z"),
      collect,
      loadCycle: vi.fn().mockResolvedValue({
        start: "2026-07-10T00:00:00.000Z",
        end: "2026-08-10T00:00:00.000Z",
      }),
    });

    expect(collect).toHaveBeenCalledWith(
      "account",
      "token",
      {
        start: "2026-07-10T00:00:00.000Z",
        end: "2026-08-10T00:00:00.000Z",
      },
      "2026-07-24T12:30:00.000Z",
      {},
      true,
    );
    expect(dashboard.source).toContain("live estimate");
  });
});
