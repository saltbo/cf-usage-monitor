import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] =
    useState<ProductDataTab>("contributors");

  return (
    <section className="product-data-section">
      <div
        aria-label={t("tabs.label")}
        className="product-data-tabs"
        role="tablist"
      >
        <Tab
          activeTab={activeTab}
          id="contributors"
          label={t("tabs.contributors")}
          onSelect={setActiveTab}
        />
        <Tab
          activeTab={activeTab}
          id="cost"
          label={t("tabs.cost")}
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
                <p className="eyebrow">{t("contributors.eyebrow")}</p>
                <h2 id="contributors-title">{t("contributors.title")}</h2>
              </div>
              <p>{t("contributors.hint")}</p>
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
