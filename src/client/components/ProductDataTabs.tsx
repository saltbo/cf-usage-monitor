import { useState } from "react";
import type { ProductName } from "../../metrics";
import type {
  DashboardMetric,
  ProductCostData,
} from "../../shared/dashboard";
import { ContributorTable } from "./ContributorTable";
import { CostPanel } from "./CostPanel";

type ProductDataTab = "cost" | "contributors";

export function ProductDataTabs({
  cost,
  cycleEnd,
  cycleStart,
  metric,
  productName,
}: {
  cost: ProductCostData;
  cycleEnd: string;
  cycleStart: string;
  metric: DashboardMetric;
  productName: ProductName;
}) {
  const [activeTab, setActiveTab] =
    useState<ProductDataTab>("contributors");

  return (
    <section className="product-data-section">
      <div
        aria-label="产品数据详情"
        className="product-data-tabs"
        role="tablist"
      >
        <Tab
          activeTab={activeTab}
          id="contributors"
          label="实例归因"
          onSelect={setActiveTab}
        />
        <Tab
          activeTab={activeTab}
          id="cost"
          label="成本明细"
          onSelect={setActiveTab}
        />
      </div>
      <div
        aria-labelledby={`${activeTab}-tab`}
        className="product-data-content"
        id="product-data-panel"
        role="tabpanel"
      >
        {activeTab === "cost" ? (
          <CostPanel
            cost={cost}
            cycleEnd={cycleEnd}
            cycleStart={cycleStart}
          />
        ) : (
          <section
            aria-labelledby="contributors-title"
            className="contributors-section"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">实例归因</p>
                <h2 id="contributors-title">谁消耗得最多？</h2>
              </div>
              <p>按当前计费周期用量排序</p>
            </div>
            <ContributorTable metric={metric} productName={productName} />
          </section>
        )}
      </div>
    </section>
  );
}

function Tab({
  activeTab,
  id,
  label,
  onSelect,
}: {
  activeTab: ProductDataTab;
  id: ProductDataTab;
  label: string;
  onSelect: (tab: ProductDataTab) => void;
}) {
  return (
    <button
      aria-controls="product-data-panel"
      aria-selected={activeTab === id}
      id={`${id}-tab`}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
          return;
        }
        event.preventDefault();
        const next = id === "contributors" ? "cost" : "contributors";
        onSelect(next);
        event.currentTarget.parentElement
          ?.querySelector<HTMLButtonElement>(`#${next}-tab`)
          ?.focus();
      }}
      onClick={() => onSelect(id)}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}
