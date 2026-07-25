import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { DashboardMetric } from "../../shared/dashboard";
import { ProductDataTabs } from "./ProductDataTabs";

describe("ProductDataTabs", () => {
  it("shows attribution first and switches to cost details", () => {
    render(
      <MemoryRouter>
        <ProductDataTabs
          cost={{
            currency: "USD",
            totalCost: 0,
            recentCost: 0,
            postedThrough: "2026-07-25T00:00:00.000Z",
            daily: [],
            lineItems: [],
          }}
          cycleEnd="2026-08-01T00:00:00.000Z"
          cycleStart="2026-07-01T00:00:00.000Z"
          metric={{
            metric: "d1.rows_read",
            unit: "rows",
            used: 0,
            periodEnd: "2026-08-01T00:00:00.000Z",
            contributors: [],
            recentContributors: [],
          } as unknown as DashboardMetric}
          productName="d1"
        />
      </MemoryRouter>,
    );

    const attribution = screen.getByRole("tab", { name: "实例归因" });
    const cost = screen.getByRole("tab", { name: "成本明细" });
    expect(attribution).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("谁消耗得最多？");

    fireEvent.keyDown(attribution, { key: "ArrowRight" });
    expect(cost).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("实际用量成本");
  });
});
