import { describe, expect, it } from "vitest";
import { buildDashboardData } from "../src/dashboard-data";
import {
  detectQuotaRisks,
  type DetectionConfig,
} from "../src/detection";
import { METRIC_NAMES, type UsageSnapshot } from "../src/metrics";

const config: DetectionConfig = {
  alertAfterSamples: 2,
  recoverySamples: 3,
  reminderMinutes: 60,
};

describe("dashboard data", () => {
  it("groups quota metrics by product and ranks risky products first", () => {
    const snapshot = usage();
    const detected = detectQuotaRisks({ metrics: {} }, snapshot, config);
    const dashboard = buildDashboardData(
      detected.state,
      snapshot,
      config,
      "primary",
      snapshot.measuredAt,
    );

    expect(dashboard.schemaVersion).toBe(2);
    expect(dashboard.products[0].name).toBe("d1");
    expect(dashboard.products[0].topMetric).toBe("d1.rows_written");
    expect(dashboard.products[0].metrics[0]).toMatchObject({
      used: 30_000_000,
      quota: 50_000_000,
      risk: "critical",
      forecastHourlyUsage: 900_000,
      forecastHourlySamples: 1,
      forecastDailySamples: 1,
    });
    expect(dashboard.products[0].metrics[0].contributors[0].name).toBe(
      "orders-db",
    );
    expect(dashboard.products[0].metrics[0].hourly).toEqual([
      { timestamp: "2026-07-14T23:00:00.000Z", value: 900_000 },
    ]);
    expect(dashboard.products[0].metrics[0].daily).toEqual([
      { timestamp: "2026-07-14T00:00:00.000Z", value: 3_500_000 },
    ]);
  });
});

function usage(): UsageSnapshot {
  return {
    measuredAt: "2026-07-15T00:00:00.000Z",
    cycle: {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    },
    values: METRIC_NAMES.map((name) => ({
      name,
      value: name === "d1.rows_written" ? 30_000_000 : 0,
      contributors:
        name === "d1.rows_written"
          ? [{ id: "orders", name: "orders-db", value: 30_000_000 }]
          : [],
    })),
    recentValues: METRIC_NAMES.map((name) => ({
      name,
      value: name === "d1.rows_written" ? 1_000_000 : 0,
      contributors:
        name === "d1.rows_written"
          ? [{ id: "orders", name: "orders-db", value: 1_000_000 }]
          : [],
    })),
    hourlySeries: METRIC_NAMES.map((name) => ({
      name,
      points:
        name === "d1.rows_written"
          ? [{ timestamp: "2026-07-14T23:00:00.000Z", value: 900_000 }]
          : [],
    })),
    dailySeries: METRIC_NAMES.map((name) => ({
      name,
      points:
        name === "d1.rows_written"
          ? [{ timestamp: "2026-07-14T00:00:00.000Z", value: 3_500_000 }]
          : [],
    })),
    failures: [],
  };
}
