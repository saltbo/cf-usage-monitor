import { describe, expect, it } from "vitest";
import {
  calendarBucketValues,
  shortTermUsageForecast,
  sumTransitionalDailyForecast,
  transitionalDailyForecast,
} from "../src/forecast";

describe("forecast helpers", () => {
  it("fills missing calendar buckets with zero", () => {
    const hour = 3_600_000;
    const start = Date.parse("2026-07-25T00:00:00.000Z");

    expect(
      calendarBucketValues(
        [
          { timestamp: new Date(start).toISOString(), value: 10 },
          { timestamp: new Date(start + 2 * hour).toISOString(), value: 30 },
        ],
        start,
        start + 3 * hour,
        hour,
      ),
    ).toEqual([10, 0, 30]);
  });

  it("transitions from the recent hourly run rate to the daily baseline", () => {
    expect(transitionalDailyForecast(10, 10, 0)).toBe(240);
    expect(transitionalDailyForecast(10, 10, 1)).toBe(125);
    expect(transitionalDailyForecast(10, 10, 2)).toBe(67.5);
    expect(sumTransitionalDailyForecast(10, 10, 3)).toBe(432.5);
  });

  it("follows a recent level shift instead of an older spike", () => {
    const hour = 3_600_000;
    const start = Date.parse("2026-07-25T00:00:00.000Z");
    const points = [100, 100, 100, 10, 10].map((value, index) => ({
      timestamp: new Date(start + index * hour).toISOString(),
      value,
    }));

    expect(
      shortTermUsageForecast({
        anchorTimestamp: new Date(start + 4 * hour).toISOString(),
        bucketMs: hour,
        forecastCount: 5,
        points,
      }),
    ).toEqual({
      currentEstimate: null,
      values: [10, 10, 10, 10, 10],
    });
  });

  it("continues a local trend with damping after a level shift", () => {
    const hour = 3_600_000;
    const start = Date.parse("2026-07-25T00:00:00.000Z");
    const points = [120, 125, 130, 30, 20].map((value, index) => ({
      timestamp: new Date(start + index * hour).toISOString(),
      value,
    }));

    expect(
      shortTermUsageForecast({
        anchorTimestamp: new Date(start + 4 * hour).toISOString(),
        bucketMs: hour,
        current: {
          progress: 0.5,
          value: 6,
        },
        forecastCount: 5,
        points,
      }),
    ).toEqual({
      currentEstimate: 12,
      values: [9, 7.05, 5.7825, 4.958625, 4.42310625],
    });
  });
});
