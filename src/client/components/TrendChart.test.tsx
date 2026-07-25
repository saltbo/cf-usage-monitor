import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardMetric } from "../../shared/dashboard";
import { TrendChart } from "./TrendChart";

describe("TrendChart", () => {
  it("shares hover, tooltip, current-time and keyboard behavior", () => {
    const now = Date.now();
    const points = [-2, -1, 0].map((offset, index) => ({
      timestamp: new Date(now + offset * 3_600_000).toISOString(),
      value: (index + 1) * 10,
    }));
    const { container } = render(
      <TrendChart grain="hourly" metric={metric(points)} />,
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("chart svg is missing");
    Object.defineProperty(svg, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 960 }),
    });

    expect(container.querySelector(".chart-now-marker")).toBeInTheDocument();
    expect(container.querySelector(".chart-timezone")).toHaveTextContent(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    expect(container.querySelector(".chart-safe-label")).not.toBeInTheDocument();
    fireEvent.pointerMove(svg, { clientX: 500 });
    expect(container.querySelector(".chart-hover-line")).toBeInTheDocument();
    const localZoneName = new Intl.DateTimeFormat("zh-CN", {
      timeZoneName: "short",
    })
      .formatToParts(new Date(points[1].timestamp))
      .find((part) => part.type === "timeZoneName")?.value;
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      localZoneName ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "20 次请求",
    );

    fireEvent.focus(svg);
    fireEvent.keyDown(svg, { key: "ArrowLeft" });
    expect(container.querySelector(".chart-active-point")).toBeInTheDocument();
    fireEvent.blur(svg);
    expect(container.querySelector(".chart-active-point")).not.toBeInTheDocument();
  });

  it("pins a distant safety line to the top without compressing actual bars", () => {
    const now = Date.now();
    const points = [4, 5].map((value, index) => ({
      timestamp: new Date(now + index * 3_600_000).toISOString(),
      value,
    }));
    const distantSafetyLine = {
      ...metric(points),
      baselineHourlyUsage: 100,
    };
    const { container } = render(
      <TrendChart grain="hourly" metric={distantSafetyLine} />,
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("chart svg is missing");
    fireEvent.focus(svg);

    expect(container.querySelector(".chart-safe-line")).toHaveAttribute(
      "y1",
      "26",
    );
    expect(container.querySelector(".chart-hover-line")).toHaveAttribute(
      "y1",
      "26",
    );
    expect(container.querySelector(".chart-safe-label")).toHaveTextContent(
      "↑ 安全线",
    );
    expect(
      container.querySelector(".chart-safe-label rect"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".chart-safe-label text")).toHaveAttribute(
      "text-anchor",
      "start",
    );
    expect(container.querySelector(".chart-safe-axis-value")).toHaveTextContent(
      "100",
    );
    expect(container.querySelector(".chart-safe-tick")).toBeInTheDocument();
    expect(container.querySelector(".chart-safe-gap")).toBeInTheDocument();
    expect(container.querySelector(".chart-safe-gap")).toHaveAttribute(
      "x1",
      container.querySelector(".chart-y-axis")?.getAttribute("x1"),
    );
    const gridLines = container.querySelectorAll("line[stroke='#243144']");
    expect(gridLines.item(gridLines.length - 1)).toHaveAttribute("y1", "82.5");
    const bars = container.querySelectorAll("rect[fill='#5eead4']");
    expect(bars[1]).toHaveAttribute("height", expect.not.stringMatching(/^0/));
  });

  it("fills the complete local day and billing cycle with forecast slots", () => {
    const hourlyMeasuredAt = new Date(2026, 6, 25, 12, 30).toISOString();
    const dailyMeasuredAt = "2026-07-25T12:30:00.000Z";
    const hour = 3_600_000;
    const measuredAtMs = Date.parse(hourlyMeasuredAt);
    const hourlyPoints = Array.from({ length: 5 }, (_, index) => ({
      timestamp: new Date(
        measuredAtMs - (5 - index) * hour - 30 * 60_000,
      ).toISOString(),
      value: 10,
    }));
    const completeMetric = {
      ...metric(hourlyPoints),
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-08-01T00:00:00.000Z",
    };
    const hourly = render(
      <TrendChart
        completePeriod
        grain="hourly"
        measuredAt={hourlyMeasuredAt}
        metric={completeMetric}
      />,
    );

    expect(hourly.container.querySelectorAll(".chart-slot")).toHaveLength(24);
    expect(
      hourly.container.querySelectorAll(".chart-slot[data-state='future']"),
    ).toHaveLength(11);
    expect(
      hourly.container.querySelectorAll(
        ".chart-slot[data-state='future'] .chart-forecast-bar",
      ),
    ).toHaveLength(5);
    expect(
      hourly.container.querySelector(".chart-moving-average-short-forecast"),
    ).toHaveAttribute("stroke", "#fbbf24");
    expect(
      hourly.container.querySelector(".chart-moving-average-long-forecast"),
    ).toHaveAttribute("stroke", "#a78bfa");
    expect(
      hourly.container.querySelector(".chart-moving-average-short-forecast"),
    ).toHaveAttribute("stroke-dasharray", "7 5");
    expect(
      hourly.container.querySelector(".chart-moving-average-long-forecast"),
    ).toBeInTheDocument();
    hourly.unmount();

    const dailyPoints = Array.from({ length: 5 }, (_, index) => ({
      timestamp: new Date(
        Date.parse("2026-07-20T00:00:00.000Z") + index * 24 * hour,
      ).toISOString(),
      value: 10,
    }));
    const daily = render(
      <TrendChart
        completePeriod
        grain="daily"
        measuredAt={dailyMeasuredAt}
        metric={{ ...completeMetric, daily: dailyPoints }}
      />,
    );
    expect(daily.container.querySelectorAll(".chart-slot")).toHaveLength(31);
    expect(
      daily.container.querySelectorAll(".chart-slot[data-state='future']"),
    ).toHaveLength(6);
    expect(
      daily.container.querySelectorAll(
        ".chart-slot[data-state='future'] .chart-forecast-bar",
      ),
    ).toHaveLength(5);
    expect(daily.container.querySelector(".chart-timezone")).toHaveTextContent(
      "UTC（日聚合）",
    );
    expect(
      daily.container.querySelector(".chart-moving-average-short-forecast"),
    ).toBeInTheDocument();
    expect(
      daily.container.querySelector(".chart-moving-average-long-forecast"),
    ).toBeInTheDocument();
  });

  it("draws fixed-window short and long averages and exposes them on hover", () => {
    const start = Date.parse("2026-07-25T00:00:00.000Z");
    const points = Array.from({ length: 13 }, (_, index) => ({
      timestamp: new Date(start + index * 3_600_000).toISOString(),
      value: index + 1,
    }));
    const { container } = render(
      <TrendChart grain="hourly" metric={metric(points)} />,
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("chart svg is missing");

    expect(
      container.querySelector(".chart-moving-average-short"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".chart-moving-average-long"),
    ).toBeInTheDocument();

    fireEvent.focus(svg);
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "MA3 · 12 次请求",
    );
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "MA7 · 10 次请求",
    );
  });

  it("uses the recent hourly operating level when the current day is polluted", () => {
    const hour = 3_600_000;
    const measuredAt = "2026-07-25T12:30:00.000Z";
    const hourlyStart = Date.parse("2026-07-25T07:00:00.000Z");
    const hourly = Array.from({ length: 6 }, (_, index) => ({
      timestamp: new Date(hourlyStart + index * hour).toISOString(),
      value: index === 5 ? 0.5 : 1,
    }));
    const dailyStart = Date.parse("2026-07-20T00:00:00.000Z");
    const daily = [100, 100, 100, 30, 20, 1_000].map((value, index) => ({
      timestamp: new Date(dailyStart + index * 24 * hour).toISOString(),
      value,
    }));
    const pollutedMetric = {
      ...metric(hourly),
      daily,
      periodStart: "2026-07-20T00:00:00.000Z",
      periodEnd: "2026-08-01T00:00:00.000Z",
    };
    const { container } = render(
      <TrendChart
        completePeriod
        grain="daily"
        measuredAt={measuredAt}
        metric={pollutedMetric}
      />,
    );
    const futureTitles = [...container.querySelectorAll(
      ".chart-slot[data-state='future'] .chart-forecast-bar title",
    )].map((title) => title.textContent);

    expect(futureTitles).toHaveLength(5);
    expect(futureTitles[0]).toContain("预测 28 次请求");
    expect(futureTitles[1]).toContain("预测 30.6 次请求");
    expect(futureTitles.join(" ")).not.toContain("1000");
  });

  it("does not progress-scale R2 storage rate points", () => {
    const hour = 3_600_000;
    const measuredAt = "2026-07-25T12:30:00.000Z";
    const hourlyStart = Date.parse("2026-07-25T07:00:00.000Z");
    const hourly = Array.from({ length: 6 }, (_, index) => ({
      timestamp: new Date(hourlyStart + index * hour).toISOString(),
      value: 0.2,
    }));
    const dailyStart = Date.parse("2026-07-20T00:00:00.000Z");
    const daily = Array.from({ length: 6 }, (_, index) => ({
      timestamp: new Date(dailyStart + index * 24 * hour).toISOString(),
      value: 5,
    }));
    const storageMetric: DashboardMetric = {
      ...metric(hourly),
      daily,
      label: "Storage",
      metric: "r2.storage_gb_month",
      periodStart: "2026-07-20T00:00:00.000Z",
      periodEnd: "2026-08-01T00:00:00.000Z",
      unit: "GB-month",
    };
    const hourlyChart = render(
      <TrendChart
        completePeriod
        grain="hourly"
        measuredAt={measuredAt}
        metric={storageMetric}
      />,
    );
    const hourlyTitles = [...hourlyChart.container.querySelectorAll(
      ".chart-slot[data-state='future'] .chart-forecast-bar title",
    )].map((title) => title.textContent);

    expect(hourlyTitles).toHaveLength(5);
    expect(hourlyTitles.every((title) => title?.includes("预测 0.2 GB·月")))
      .toBe(true);
    hourlyChart.unmount();

    const dailyChart = render(
      <TrendChart
        completePeriod
        grain="daily"
        measuredAt={measuredAt}
        metric={storageMetric}
      />,
    );
    const dailyTitles = [...dailyChart.container.querySelectorAll(
      ".chart-slot[data-state='future'] .chart-forecast-bar title",
    )].map((title) => title.textContent);

    expect(dailyTitles).toHaveLength(5);
    expect(dailyTitles[0]).toContain("预测 4.7 GB·月");
    expect(dailyTitles.join(" ")).not.toContain("12");
  });

  it("uses prior-period buckets for averages at the first visible slot", () => {
    const measuredDate = new Date(2026, 6, 25, 12, 30);
    const visibleStart = new Date(measuredDate);
    visibleStart.setHours(0, 0, 0, 0);
    const start = visibleStart.getTime() - 7 * 24 * 3_600_000;
    const points = Array.from({ length: 7 * 24 + 13 }, (_, index) => ({
      timestamp: new Date(start + index * 3_600_000).toISOString(),
      value: 10,
    }));
    const measuredAt = measuredDate.toISOString();
    const { container } = render(
      <TrendChart
        completePeriod
        grain="hourly"
        measuredAt={measuredAt}
        metric={metric(points)}
      />,
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("chart svg is missing");
    Object.defineProperty(svg, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 960 }),
    });

    fireEvent.pointerMove(svg, { clientX: 65 });
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "MA3 · 10 次请求",
    );
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "MA7 · 10 次请求",
    );

    fireEvent.pointerMove(svg, { clientX: 538 });
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "预测 · 25 次请求",
    );
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "MA3 预测 · 18.33 次请求",
    );
    expect(container.querySelector(".chart-active-point")).toHaveTextContent(
      "MA7 预测 · 13.57 次请求",
    );
  });
});

function metric(
  hourly: DashboardMetric["hourly"],
): DashboardMetric {
  return {
    metric: "workers.requests",
    label: "Requests",
    unit: "requests",
    period: "billing_cycle",
    alertPolicy: "strict",
    alertStatus: "normal",
    used: 60,
    quota: 100,
    recentHourlyUsage: 10,
    safeHourlyUsage: 20,
    baselineHourlyUsage: 20,
    burnRate: 0.5,
    usedRatio: 0.6,
    projectedUsage: 80,
    projectedRatio: 0.8,
    forecastHourlyUsage: 10,
    forecastHourlySamples: 3,
    forecastDailyUsage: 20,
    forecastDailySamples: 3,
    forecastProjectedUsage: 80,
    forecastProjectedRatio: 0.8,
    exhaustsAt: null,
    periodStart: new Date(Date.now() - 86_400_000).toISOString(),
    periodEnd: new Date(Date.now() + 86_400_000).toISOString(),
    risk: "normal",
    contributors: [],
    recentContributors: [],
    incident: null,
    hourly,
    daily: hourly,
  };
}
