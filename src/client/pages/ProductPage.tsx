import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { PRODUCT_NAMES, type ProductName } from "../../metrics";
import type { DashboardMetric } from "../../shared/dashboard";
import { FailurePanel } from "../components/FailurePanel";
import { InstancePanel } from "../components/InstancePanel";
import { ProductDataTabs } from "../components/ProductDataTabs";
import { QuotaMeter } from "../components/QuotaMeter";
import { TrendChart } from "../components/TrendChart";
import { useDashboard } from "../data/dashboard-context";
import { useProductDashboard } from "../data/use-product-dashboard";
import { formatCompact, formatDate, formatPercent } from "../lib/format";
import {
  formatUnit,
  metricLabel,
  productLabel,
} from "../lib/localization";
import { metricSummary } from "../lib/risk";
import i18n from "../i18n";

export function ProductPage() {
  const { t } = useTranslation();
  const { data } = useDashboard();
  const { instanceId, productName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grain, setGrain] = useState<"hourly" | "daily">("hourly");
  const validProductName = isProductName(productName) ? productName : null;
  const live = useProductDashboard(validProductName, data?.generatedAt);

  if (!validProductName) {
    return <Navigate replace to="/" />;
  }
  if (!live.data) {
    return (
      <div className={live.error ? "issues-panel" : "loading-state"}>
        {live.error ??
          t("product.loading", { product: productLabel(validProductName) })}
      </div>
    );
  }
  const dashboard = live.data;
  const product = dashboard.product;

  const requestedMetric = searchParams.get("metric");
  const metric =
    product.metrics.find((item) => item.metric === requestedMetric) ??
    product.metrics.find((item) => item.metric === product.topMetric) ??
    product.metrics[0];
  if (!metric) {
    throw new Error(`Product ${product.name} has no metrics`);
  }

  return (
    <>
      <div className="detail-heading">
        <div className="detail-heading-main">
          <Link
            aria-label={
              instanceId
                ? t("product.backToProduct", {
                    product: productLabel(product.name),
                  })
                : t("product.backToOverview")
            }
            className="detail-back"
            to={
              instanceId
                ? `/usage/${product.name}?metric=${encodeURIComponent(metric.metric)}`
                : "/"
            }
          >
            ←
          </Link>
          <h1>
            {instanceId
              ? metric.contributors.find(
                  (item) => item.id === decodeURIComponent(instanceId),
                )?.name ?? decodeURIComponent(instanceId)
              : productLabel(product.name)}
          </h1>
        </div>
        <div
          aria-label={t("product.metricTabs")}
          className="metric-tabs"
          role="tablist"
        >
          {product.metrics.map((item) => (
            <button
              aria-selected={item.metric === metric.metric}
              className="metric-tab"
              key={item.metric}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set("metric", item.metric);
                setSearchParams(next);
              }}
              role="tab"
              type="button"
            >
              <span>{metricLabel(item.metric)}</span>
            </button>
          ))}
        </div>
      </div>

      {instanceId ? (
        <InstancePanel
          instanceId={decodeURIComponent(instanceId)}
          metric={metric}
          productName={product.name as ProductName}
        />
      ) : (
        <>
          <section
            aria-labelledby="risk-title"
            className="risk-panel"
          >
            <div className="detail-quota">
              <div className="detail-quota-heading">
                <div>
                  <small id="risk-title">
                    {productLabel(product.name)} · {metricLabel(metric.metric)}
                  </small>
                  <strong>{formatPercent(metric.usedRatio)}</strong>
                </div>
                <div className="detail-quota-meta">
                  <span className={forecastTone(metric)}>
                    {t("product.steadyForecast", {
                      value: formatPercent(metric.forecastProjectedRatio),
                    })}
                  </span>
                  <b>
                    {formatCompact(metric.used)} / {formatCompact(metric.quota)}{" "}
                    {formatUnit(metric.unit)}
                  </b>
                </div>
              </div>
              <div
                aria-label={t("product.quotaRatio")}
                className="detail-quota-track"
                role="progressbar"
              >
                <QuotaMeter metric={metric} showForecast />
              </div>
              <div className="detail-quota-foot">
                <span>0%</span>
                <strong className={forecastTone(metric)}>
                  {quotaBalance(metric)}
                </strong>
                <span>
                  {metric.usedRatio > 1
                    ? formatPercent(quotaScale(metric) / 100)
                    : t("product.quota100")}
                </span>
              </div>
              <p className="detail-quota-summary">{metricSummary(metric)}</p>
            </div>

            <div className="trend-heading">
              <div>
                <p className="eyebrow">{t("product.growthEyebrow")}</p>
                <h3>
                  {t(
                    grain === "hourly"
                      ? "product.hourlyGrowth"
                      : "product.dailyGrowth",
                  )}
                </h3>
                <p>
                  {grain === "hourly"
                    ? t("product.hourlyPeriod")
                    : t("product.billingPeriod", {
                        start: formatDate(metric.periodStart),
                        end: formatDate(metric.periodEnd),
                      })}
                </p>
              </div>
              <div
                aria-label={t("product.grainTabs")}
                className="trend-tabs"
                role="tablist"
              >
                <button
                  aria-selected={grain === "hourly"}
                  onClick={() => setGrain("hourly")}
                  role="tab"
                  type="button"
                >
                  {t("common.hour")}
                </button>
                <button
                  aria-selected={grain === "daily"}
                  onClick={() => setGrain("daily")}
                  role="tab"
                  type="button"
                >
                  {t("common.day")}
                </button>
              </div>
            </div>
            <ChartLegend grain={grain} />
            <TrendChart
              className="quota-chart"
              completePeriod
              cycleStart={live.data?.cycle.start}
              grain={grain}
              measuredAt={live.data?.lastUpdated}
              metric={metric}
            />
          </section>

          <ProductDataTabs
            cost={dashboard.cost}
            cycleEnd={dashboard.cycle.end}
            cycleStart={dashboard.cycle.start}
            metric={metric}
            productName={product.name as ProductName}
          />
        </>
      )}
      <FailurePanel failures={live.data?.failures ?? []} />
    </>
  );
}

function ChartLegend({ grain }: { grain: "hourly" | "daily" }) {
  const { t } = useTranslation();
  const unit = t(grain === "hourly" ? "common.hour" : "common.day");
  const longWindow = 7;
  return (
    <div aria-label={t("common.legend")} className="chart-legend">
      <span><i className="increment" />{t("product.actualUsage")}</span>
      <span><i className="forecast-increment" />{t("product.forecastUsage")}</span>
      <span><i className="trend-short" />{t("product.shortAverage", { unit })}</span>
      <span><i className="trend-short-forecast" />{t("product.maForecast", { window: 3 })}</span>
      <span>
        <i className="trend-long" />
        {t("product.longAverage", { unit })}
      </span>
      <span><i className="trend-long-forecast" />{t("product.maForecast", { window: longWindow })}</span>
      <span><i className="safe" />{t("product.safeLine")}</span>
    </div>
  );
}

function forecastTone(metric: DashboardMetric): string {
  if (metric.forecastProjectedRatio >= 1) return "critical";
  if (metric.forecastProjectedRatio >= 0.8) return "warning";
  return "";
}

function quotaScale(metric: DashboardMetric): number {
  const usedPercent = Math.max(0, metric.usedRatio * 100);
  return usedPercent <= 100
    ? 100
    : Math.ceil((usedPercent * 1.08) / 25) * 25;
}

function quotaBalance(metric: DashboardMetric): string {
  const unit = formatUnit(metric.unit);
  if (metric.used > metric.quota) {
    return i18n.t("product.exceeded", {
      amount: formatCompact(metric.used - metric.quota),
      unit,
      ratio: formatPercent(metric.usedRatio - 1),
    });
  }
  if (metric.forecastProjectedUsage > metric.quota) {
    return i18n.t("product.forecastExceeded", {
      amount: formatCompact(metric.forecastProjectedUsage - metric.quota),
      unit,
      ratio: formatPercent(metric.forecastProjectedRatio - 1),
    });
  }
  return i18n.t("product.remaining", {
    amount: formatCompact(metric.quota - metric.used),
    forecast: formatCompact(metric.quota - metric.forecastProjectedUsage),
    unit,
  });
}

function isProductName(value: string | undefined): value is ProductName {
  return PRODUCT_NAMES.includes(value as ProductName);
}
