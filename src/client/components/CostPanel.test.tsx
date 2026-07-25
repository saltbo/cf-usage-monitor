import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CostPanel } from "./CostPanel";

describe("CostPanel", () => {
  it("shows real billing totals, line items, and an interactive UTC chart", () => {
    render(
      <CostPanel
        cost={{
          currency: "USD",
          totalCost: 5.0043,
          recentCost: 3.0043,
          postedThrough: "2026-07-03T00:00:00.000Z",
          daily: [
            { timestamp: "2026-07-01T00:00:00.000Z", cost: 2 },
            { timestamp: "2026-07-02T00:00:00.000Z", cost: 3.0043 },
          ],
          lineItems: [
            {
              serviceName: "D1 Rows Written",
              consumedQuantity: 3_000,
              consumedUnit: "rows",
              pricingQuantity: 3_000,
              cost: 5.0043,
            },
          ],
        }}
        cycleEnd="2026-08-01T00:00:00.000Z"
        cycleStart="2026-07-01T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("实际用量成本")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("成本摘要")).getByText("US$5.00"),
    ).toBeInTheDocument();
    expect(screen.getByText("D1 Rows Written")).toBeInTheDocument();
    expect(screen.getByText("账单日 · UTC")).toBeInTheDocument();

    const chart = screen.getByRole("img", {
      name: "本计费周期每日实际成本，已入账至 7月2日",
    });
    fireEvent.focus(chart);
    expect(chart.querySelector(".cost-hover-line")).toBeInTheDocument();
    expect(chart.querySelector(".cost-tooltip-date")?.textContent).toContain(
      "7月2日 · UTC",
    );
  });
});
