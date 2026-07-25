import { FailurePanel } from "../components/FailurePanel";
import { ProductCard } from "../components/ProductCard";
import { useDashboard } from "../data/dashboard-context";
import {
  formatBillingThrough,
  formatCurrency,
  formatDate,
} from "../lib/format";

export function OverviewPage() {
  const { t } = useTranslation();
  const { data, error, loading, refresh, refreshing } = useDashboard();
  if (loading) {
    return <div className="loading-state">{t("overview.loading")}</div>;
  }
  if (!data) {
    return (
      <section className="error-state">
        <h1>{t("overview.errorTitle")}</h1>
        <p>{error}</p>
        <button
          disabled={refreshing}
          onClick={() => void refresh()}
          type="button"
        >
          {refreshing ? t("common.refreshing") : t("common.retry")}
        </button>
      </section>
    );
  }

  const statusRisk =
    data.status === "degraded"
      ? "warning"
      : data.status === "healthy"
        ? "normal"
        : data.status;
  const statusLabel =
    t(`overview.status.${data.status}`);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("overview.eyebrow")}</p>
          <h1>{t("overview.title")}</h1>
          <p>
            {t("overview.cycle", {
              start: formatDate(data.cycle.start),
              end: formatDate(data.cycle.end),
            })}
          </p>
        </div>
        <span className={`status-pill risk-${statusRisk}`}>
          {t("overview.accountStatus", { status: statusLabel })}
        </span>
      </div>
      <div aria-label={t("overview.summaryLabel")} className="summary-grid">
        <SummaryCard
          detail={t("overview.postedThrough", {
            date: formatBillingThrough(data.cost.postedThrough),
          })}
          label={t("overview.currentCost")}
          value={formatCurrency(data.cost.totalCost, data.cost.currency)}
        />
        <SummaryCard
          label={t("overview.recentCost")}
          value={formatCurrency(data.cost.recentCost, data.cost.currency)}
        />
        <SummaryCard
          label={t("overview.criticalProducts")}
          tone="critical"
          value={data.summary.critical}
        />
        <SummaryCard
          label={t("overview.warningProducts")}
          tone="warning"
          value={data.summary.warning}
        />
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("overview.sortEyebrow")}</p>
          <h2>{t("overview.productQuotas")}</h2>
        </div>
        <p>{t("overview.productStatusHint")}</p>
      </div>
      <FailurePanel failures={data.failures} />
      <div className="product-list">
        {data.products.map((product) => (
          <ProductCard key={product.name} product={product} />
        ))}
      </div>
      {error ? <div className="toast">{error}</div> : null}
    </>
  );
}

function SummaryCard({
  label,
  detail,
  tone = "normal",
  value,
}: {
  label: string;
  detail?: string;
  tone?: "normal" | "warning" | "critical";
  value: number | string;
}) {
  return (
    <article className={`summary-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}
import { useTranslation } from "react-i18next";
