import { describe, expect, it } from "vitest";
import {
  detectQuotaRisks,
  evaluateMetric,
  type DetectionConfig,
  type MonitorState,
} from "../src/detection";
import { METRIC_NAMES, type UsageSnapshot } from "../src/metrics";

const config: DetectionConfig = {
  alertAfterSamples: 2,
  recoverySamples: 3,
  reminderMinutes: 60,
};

describe("quota risk detection", () => {
  it("projects period-end usage from the latest hourly burn rate", () => {
    const evaluation = evaluateMetric(
      "workers.requests",
      snapshot("2026-07-15T00:00:00.000Z", 4_000_000, 100_000),
    );

    expect(evaluation.risk).toBe("critical");
    expect(evaluation.usedRatio).toBe(0.4);
    expect(evaluation.projectedUsage).toBeGreaterThan(10_000_000);
    expect(evaluation.exhaustsAt).not.toBeNull();
    expect(evaluation.burnRate).toBeGreaterThan(1);
  });

  it("keeps the alert responsive while smoothing the dashboard forecast", () => {
    const usage = snapshot(
      "2026-07-15T12:30:00.000Z",
      4_000_000,
      1_000_000,
    );
    usage.hourlySeries = metricSeries(
      "workers.requests",
      [10, 20, 30, 40, 50, 60, 9_000_000],
      "2026-07-15T06:00:00.000Z",
      60 * 60 * 1_000,
    );
    usage.dailySeries = metricSeries(
      "workers.requests",
      [100, 200, 300, 400, 500, 600, 700],
      "2026-07-08T00:00:00.000Z",
      24 * 60 * 60 * 1_000,
    );

    const evaluation = evaluateMetric("workers.requests", usage);

    expect(evaluation.recentHourlyUsage).toBe(1_000_000);
    expect(evaluation.risk).toBe("critical");
    expect(evaluation.forecastHourlySamples).toBe(6);
    expect(evaluation.forecastHourlyUsage).toBeCloseTo(910 / 21);
    expect(evaluation.forecastDailySamples).toBe(7);
    expect(evaluation.forecastDailyUsage).toBe(400);
    expect(evaluation.forecastProjectedUsage).toBeLessThan(
      evaluation.projectedUsage,
    );
  });

  it("opens after two risky samples and repeats only when the reminder is due", () => {
    const first = detectQuotaRisks(
      { metrics: {} },
      snapshot("2026-07-15T00:00:00.000Z", 4_000_000, 100_000),
      config,
    );
    const second = detectQuotaRisks(
      first.state,
      snapshot("2026-07-15T00:10:00.000Z", 4_020_000, 100_000),
      config,
    );
    const early = detectQuotaRisks(
      second.state,
      snapshot("2026-07-15T00:20:00.000Z", 4_040_000, 100_000),
      config,
    );
    const reminder = detectQuotaRisks(
      early.state,
      snapshot("2026-07-15T01:10:00.000Z", 4_120_000, 100_000),
      config,
    );

    expect(first.alerts).toEqual([]);
    expect(second.alerts[0]).toMatchObject({
      metric: "workers.requests",
      notificationCount: 1,
    });
    expect(early.alerts).toEqual([]);
    expect(reminder.alerts[0]?.notificationCount).toBe(2);
  });

  it("keeps the incident open until three safe forecasts recover", () => {
    const opened = openIncident();
    const one = detectQuotaRisks(
      opened,
      snapshot("2026-07-15T01:00:00.000Z", 4_100_000, 0),
      config,
    );
    const two = detectQuotaRisks(
      one.state,
      snapshot("2026-07-15T01:10:00.000Z", 4_100_000, 0),
      config,
    );
    const three = detectQuotaRisks(
      two.state,
      snapshot("2026-07-15T01:20:00.000Z", 4_100_000, 0),
      config,
    );

    expect(one.state.metrics["workers.requests"]?.incident).toBeDefined();
    expect(two.recoveries).toEqual([]);
    expect(three.recoveries[0]).toMatchObject({
      metric: "workers.requests",
      notificationCount: 1,
    });
    expect(three.state.metrics["workers.requests"]?.incident).toBeUndefined();
  });
});

function openIncident(): MonitorState {
  const first = detectQuotaRisks(
    { metrics: {} },
    snapshot("2026-07-15T00:00:00.000Z", 4_000_000, 100_000),
    config,
  );
  return detectQuotaRisks(
    first.state,
    snapshot("2026-07-15T00:10:00.000Z", 4_020_000, 100_000),
    config,
  ).state;
}

function snapshot(
  measuredAt: string,
  workersUsed: number,
  workersRecent: number,
): UsageSnapshot {
  return {
    measuredAt,
    cycle: {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    },
    values: METRIC_NAMES.map((name) => ({
      name,
      value: name === "workers.requests" ? workersUsed : 0,
      contributors:
        name === "workers.requests"
          ? [{ id: "api", name: "api-worker", value: workersUsed }]
          : [],
    })),
    recentValues: METRIC_NAMES.map((name) => ({
      name,
      value: name === "workers.requests" ? workersRecent : 0,
      contributors:
        name === "workers.requests"
          ? [{ id: "api", name: "api-worker", value: workersRecent }]
          : [],
    })),
    hourlySeries: METRIC_NAMES.map((name) => ({ name, points: [] })),
    dailySeries: METRIC_NAMES.map((name) => ({ name, points: [] })),
    failures: [],
  };
}

function metricSeries(
  metric: "workers.requests",
  values: number[],
  start: string,
  intervalMs: number,
): UsageSnapshot["hourlySeries"] {
  const startMs = Date.parse(start);
  return METRIC_NAMES.map((name) => ({
    name,
    points:
      name === metric
        ? values.map((value, index) => ({
            timestamp: new Date(startMs + intervalMs * index).toISOString(),
            value,
          }))
        : [],
  }));
}
