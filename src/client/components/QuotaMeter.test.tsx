import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardMetric } from "../../shared/dashboard";
import { QuotaMeter } from "./QuotaMeter";

describe("QuotaMeter", () => {
  it("renders actual usage and the stable forecast as an accessible meter", () => {
    const { container } = render(<QuotaMeter metric={metric()} showForecast />);

    const meter = screen.getByRole("progressbar");
    expect(meter).toHaveAttribute("value", "75");
    expect(meter).toHaveAttribute("max", "100");
    expect(meter).toHaveAccessibleName("当前使用 75%；稳健预计 90%");
    expect(container.querySelector(".forecast-marker")).toBeInTheDocument();
  });

  it("expands its scale and marks the included quota after overage", () => {
    const { container } = render(
      <QuotaMeter
        metric={metric({ usedRatio: 1.25, used: 125, risk: "exceeded" })}
        showForecast
      />,
    );

    const meter = screen.getByRole("progressbar");
    expect(meter).toHaveAttribute("max", "150");
    expect(container.querySelector(".quota-marker")).toBeInTheDocument();
  });
});

function metric(overrides: Partial<DashboardMetric> = {}): DashboardMetric {
  return {
    metric: "workers.requests",
    label: "Requests",
    unit: "requests",
    period: "billing_cycle",
    alertPolicy: "strict",
    alertStatus: "normal",
    used: 75,
    quota: 100,
    recentHourlyUsage: 2,
    safeHourlyUsage: 3,
    baselineHourlyUsage: 1,
    burnRate: 0.67,
    usedRatio: 0.75,
    projectedUsage: 85,
    projectedRatio: 0.85,
    forecastHourlyUsage: 2,
    forecastHourlySamples: 6,
    forecastDailyUsage: 48,
    forecastDailySamples: 3,
    forecastProjectedUsage: 90,
    forecastProjectedRatio: 0.9,
    exhaustsAt: null,
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-08-01T00:00:00.000Z",
    risk: "normal",
    contributors: [],
    recentContributors: [],
    incident: null,
    hourly: [],
    daily: [],
    ...overrides,
  };
}
