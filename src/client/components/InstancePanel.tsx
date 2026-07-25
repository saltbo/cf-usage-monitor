import { useEffect, useState } from "react";
import type { ProductName } from "../../metrics";
import type {
  DashboardMetric,
  InstanceUsageTrends,
} from "../../shared/dashboard";
import { loadInstanceUsage } from "../data/api";
import {
  formatCompact,
  formatPercent,
} from "../lib/format";
import { TrendChart } from "./TrendChart";

export function InstancePanel({
  instanceId,
  metric,
}: {
  instanceId: string;
  metric: DashboardMetric;
  productName: ProductName;
}) {
  const [grain, setGrain] = useState<"hourly" | "daily">("hourly");
  const [trends, setTrends] = useState<InstanceUsageTrends | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contributor = metric.contributors.find((item) => item.id === instanceId);
  const recent = metric.recentContributors.find((item) => item.id === instanceId);

  useEffect(() => {
    const controller = new AbortController();
    setTrends(null);
    setError(null);
    void loadInstanceUsage(metric.metric, instanceId, controller.signal)
      .then(setTrends)
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "实例趋势查询失败",
        );
      });
    return () => controller.abort();
  }, [instanceId, metric.metric]);

  const points = trends
    ? grain === "hourly"
      ? trends.hourly
      : trends.daily
    : [];
  const safe = instanceSafePerSlot(metric, grain);
  const peak = Math.max(0, ...points.map((point) => point.value));
  const instanceMetric = trends
      ? {
        ...metric,
        daily: trends.daily,
        forecastDailyUsage: trends.forecastDailyUsage,
        forecastHourlyUsage: trends.forecastHourlyUsage,
        hourly: trends.hourly,
      }
    : metric;

  return (
    <section
      aria-labelledby="instance-title"
      className="instance-panel"
    >
      <div className="instance-heading">
        <div className="instance-heading-main">
          <div>
            <p className="eyebrow">实例用量趋势</p>
            <h2 id="instance-title">{metric.label}趋势</h2>
            <code>{instanceId}</code>
          </div>
        </div>
        <div
          aria-label="实例趋势粒度"
          className="trend-tabs"
          role="tablist"
        >
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

      <div aria-label="实例用量摘要" className="instance-summary">
        <span>
          <small>本期用量</small>
          <strong>
            {formatCompact(contributor?.value ?? 0)} {metric.unit}
          </strong>
        </span>
        <span>
          <small>最近 1 小时</small>
          <strong>
            {formatCompact(recent?.value ?? 0)} {metric.unit}
          </strong>
        </span>
        <span>
          <small>占产品用量</small>
          <strong>
            {formatPercent(
              metric.used === 0 ? 0 : (contributor?.value ?? 0) / metric.used,
            )}
          </strong>
        </span>
      </div>

      {trends ? (
        <InstanceBenchmark
          grain={grain}
          metric={metric}
          peak={peak}
          safe={safe}
        />
      ) : null}
      <div aria-label="实例趋势图例" className="chart-legend">
        <span><i className="increment" />实际用量</span>
        <span><i className="forecast-increment" />预测用量</span>
        <span>
          <i className="trend-short" />
          MA3 · 3{grain === "hourly" ? "小时" : "日"}短期均线
        </span>
        <span><i className="trend-short-forecast" />MA3 预测</span>
        <span>
          <i className="trend-long" />
          MA7 · 7{grain === "hourly" ? "小时" : "日"}长期均线
        </span>
        <span><i className="trend-long-forecast" />MA7 预测</span>
        <span><i className="safe" />产品安全线</span>
      </div>
      {error ? <div className="empty-row">{error}</div> : null}
      {!error && !trends ? (
        <div className="instance-chart-loading">
          正在查询这个实例的真实用量趋势…
        </div>
      ) : null}
      {trends ? (
        <TrendChart
          className="instance-chart"
          completePeriod
          cycleStart={trends.cycleStart}
          grain={grain}
          measuredAt={trends.measuredAt}
          metric={instanceMetric}
          points={points}
        />
      ) : null}
    </section>
  );
}

function InstanceBenchmark({
  grain,
  metric,
  peak,
  safe,
}: {
  grain: "hourly" | "daily";
  metric: DashboardMetric;
  peak: number;
  safe: number;
}) {
  const maximum = Math.max(peak, safe, 1) * 1.08;
  const ratio = safe === 0 ? null : peak / safe;
  return (
    <div
      aria-label="实例峰值与产品安全线对比"
      className="instance-benchmark"
    >
      <div className="instance-benchmark-copy">
        <span>
          实例峰值 <b>{formatCompact(peak)} {metric.unit}</b>
        </span>
        <span>
          {grain === "hourly" ? "每小时" : "每日"}安全线{" "}
          <b>{formatCompact(safe)} {metric.unit}</b>
        </span>
      </div>
      <span className="quota-meter">
        <progress
          aria-label="实例峰值与安全线对比"
          className={`quota-progress ${peak > safe ? "critical" : ""}`}
          max={maximum}
          value={peak}
        />
        <svg
          aria-hidden="true"
          className="quota-meter-marker"
          preserveAspectRatio="none"
          viewBox="0 0 100 18"
        >
          <line
            className="quota-marker"
            x1={(safe / maximum) * 100}
            x2={(safe / maximum) * 100}
            y1="0"
            y2="18"
          />
        </svg>
      </span>
      <p className="instance-benchmark-result">
        {ratio === null
          ? "当前没有可用的安全线"
          : ratio >= 1
            ? `峰值超过安全线 ${formatRatio(ratio)}`
            : `峰值达到安全线的 ${formatPercent(ratio)}`}
      </p>
    </div>
  );
}

function instanceSafePerSlot(
  metric: DashboardMetric,
  grain: "hourly" | "daily",
): number {
  const periodHours = Math.max(
    1,
    (Date.parse(metric.periodEnd) - Date.parse(metric.periodStart)) / 3_600_000,
  );
  if (grain === "daily" && metric.period === "utc_day") {
    return metric.quota;
  }
  return metric.quota * (grain === "hourly" ? 1 : 24) / periodHours;
}

function formatRatio(value: number): string {
  return `${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
  }).format(value)}×`;
}
