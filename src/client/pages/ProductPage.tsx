import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { PRODUCTS, PRODUCT_NAMES, type ProductName } from "../../metrics";
import type { DashboardMetric } from "../../shared/dashboard";
import { ContributorTable } from "../components/ContributorTable";
import { FailurePanel } from "../components/FailurePanel";
import { InstancePanel } from "../components/InstancePanel";
import { QuotaMeter } from "../components/QuotaMeter";
import { TrendChart } from "../components/TrendChart";
import { useDashboard } from "../data/dashboard-context";
import { useProductDashboard } from "../data/use-product-dashboard";
import { formatCompact, formatDate, formatPercent } from "../lib/format";
import { metricSummary } from "../lib/risk";

export function ProductPage() {
  const { data } = useDashboard();
  const { instanceId, productName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grain, setGrain] = useState<"hourly" | "daily">("hourly");
  const validProductName = isProductName(productName) ? productName : null;
  const live = useProductDashboard(validProductName, data?.generatedAt);

  if (!validProductName) {
    return <Navigate replace to="/" />;
  }
  const product = live.data?.product;
  if (!product) {
    const definition = PRODUCTS[validProductName];
    return (
      <div className={live.error ? "issues-panel" : "loading-state"}>
        {live.error ?? `正在加载 ${definition.label} 的实时趋势…`}
      </div>
    );
  }

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
            aria-label={instanceId ? `返回${product.label}详情` : "返回账户额度"}
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
              : product.label}
          </h1>
        </div>
        <div aria-label="计费指标" className="metric-tabs" role="tablist">
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
              <span>{item.label}</span>
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
                    {product.label} · {metric.label}
                  </small>
                  <strong>{formatPercent(metric.usedRatio)}</strong>
                </div>
                <div className="detail-quota-meta">
                  <span className={forecastTone(metric)}>
                    稳健预计 {formatPercent(metric.forecastProjectedRatio)}
                  </span>
                  <b>
                    {formatCompact(metric.used)} / {formatCompact(metric.quota)}{" "}
                    {metric.unit}
                  </b>
                </div>
              </div>
              <div
                aria-label="本期额度使用比例"
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
                    : "额度 100%"}
                </span>
              </div>
              <p className="detail-quota-summary">{metricSummary(metric)}</p>
            </div>

            <div className="trend-heading">
              <div>
                <p className="eyebrow">增长速度</p>
                <h3>{grain === "hourly" ? "每小时新增用量" : "每日新增用量"}</h3>
                <p>
                  {grain === "hourly"
                    ? "当地时间今天 00:00—24:00；未来小时按近期用量预测"
                    : `完整账单周期 ${formatDate(metric.periodStart)} — ${formatDate(metric.periodEnd)}`}
                </p>
              </div>
              <div aria-label="趋势粒度" className="trend-tabs" role="tablist">
                <button
                  aria-selected={grain === "hourly"}
                  onClick={() => setGrain("hourly")}
                  role="tab"
                  type="button"
                >
                  小时
                </button>
                <button
                  aria-selected={grain === "daily"}
                  onClick={() => setGrain("daily")}
                  role="tab"
                  type="button"
                >
                  天
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
            <ContributorTable
              metric={metric}
              productName={product.name as ProductName}
            />
          </section>
        </>
      )}
      <FailurePanel failures={live.data?.failures ?? []} />
    </>
  );
}

function ChartLegend({ grain }: { grain: "hourly" | "daily" }) {
  const unit = grain === "hourly" ? "小时" : "日";
  const longWindow = 7;
  return (
    <div aria-label="图例" className="chart-legend">
      <span><i className="increment" />实际用量</span>
      <span><i className="forecast-increment" />预测用量</span>
      <span><i className="trend-short" />MA3 · 3{unit}短期均线</span>
      <span><i className="trend-short-forecast" />MA3 预测</span>
      <span>
        <i className="trend-long" />
        MA{longWindow} · {longWindow}{unit}长期均线
      </span>
      <span><i className="trend-long-forecast" />MA7 预测</span>
      <span><i className="safe" />安全线</span>
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
  if (metric.used > metric.quota) {
    return `已超出 ${formatCompact(metric.used - metric.quota)} ${metric.unit} · ${formatPercent(metric.usedRatio - 1)}`;
  }
  if (metric.forecastProjectedUsage > metric.quota) {
    return `稳健预计将超出 ${formatCompact(metric.forecastProjectedUsage - metric.quota)} ${metric.unit} · ${formatPercent(metric.forecastProjectedRatio - 1)}`;
  }
  return `剩余 ${formatCompact(metric.quota - metric.used)} ${metric.unit} · 稳健预计期末剩余 ${formatCompact(metric.quota - metric.forecastProjectedUsage)} ${metric.unit}`;
}

function isProductName(value: string | undefined): value is ProductName {
  return PRODUCT_NAMES.includes(value as ProductName);
}
