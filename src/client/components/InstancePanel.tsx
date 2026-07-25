import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProductName } from "../../metrics";
import type {
  DashboardMetric,
  InstanceUsageTrends,
} from "../../shared/dashboard";
import { loadInstanceUsage } from "../data/api";
import {
  formatCompact,
  formatPercent,
  formatRatio,
} from "../lib/format";
import { formatUnit, metricLabel } from "../lib/localization";
import i18n from "../i18n";
import { TrendChart } from "./TrendChart";

export function InstancePanel({
  instanceId,
  metric,
}: {
  instanceId: string;
  metric: DashboardMetric;
  productName: ProductName;
}) {
  const { t } = useTranslation();
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
            : i18n.t("instance.requestError"),
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
            <p className="eyebrow">{t("instance.eyebrow")}</p>
            <h2 id="instance-title">
              {t("instance.title", { metric: metricLabel(metric.metric) })}
            </h2>
            <code>{instanceId}</code>
          </div>
        </div>
        <div
          aria-label={t("instance.grainTabs")}
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

      <div aria-label={t("instance.summary")} className="instance-summary">
        <span>
          <small>{t("instance.currentUsage")}</small>
          <strong>
            {formatCompact(contributor?.value ?? 0)} {formatUnit(metric.unit)}
          </strong>
        </span>
        <span>
          <small>{t("instance.recentHour")}</small>
          <strong>
            {formatCompact(recent?.value ?? 0)} {formatUnit(metric.unit)}
          </strong>
        </span>
        <span>
          <small>{t("instance.share")}</small>
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
      <div aria-label={t("instance.legend")} className="chart-legend">
        <span><i className="increment" />{t("product.actualUsage")}</span>
        <span><i className="forecast-increment" />{t("product.forecastUsage")}</span>
        <span>
          <i className="trend-short" />
          {t("product.shortAverage", {
            unit: t(grain === "hourly" ? "common.hour" : "common.day"),
          })}
        </span>
        <span><i className="trend-short-forecast" />{t("product.maForecast", { window: 3 })}</span>
        <span>
          <i className="trend-long" />
          {t("product.longAverage", {
            unit: t(grain === "hourly" ? "common.hour" : "common.day"),
          })}
        </span>
        <span><i className="trend-long-forecast" />{t("product.maForecast", { window: 7 })}</span>
        <span><i className="safe" />{t("instance.productSafeLine")}</span>
      </div>
      {error ? <div className="empty-row">{error}</div> : null}
      {!error && !trends ? (
        <div className="instance-chart-loading">
          {t("instance.loading")}
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
  const { t } = useTranslation();
  const maximum = Math.max(peak, safe, 1) * 1.08;
  const ratio = safe === 0 ? null : peak / safe;
  const unit = formatUnit(metric.unit);
  return (
    <div
      aria-label={t("instance.benchmark")}
      className="instance-benchmark"
    >
      <div className="instance-benchmark-copy">
        <span>
          {t("instance.peak", {
            value: formatCompact(peak),
            unit,
          })}
        </span>
        <span>
          {t("instance.slotSafe", {
            period: t(grain === "hourly" ? "common.hourly" : "common.daily"),
            value: formatCompact(safe),
            unit,
          })}
        </span>
      </div>
      <span className="quota-meter">
        <progress
          aria-label={t("instance.benchmark")}
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
          ? t("instance.noSafeLine")
          : ratio >= 1
            ? t("instance.peakExceeded", { ratio: formatRatio(ratio) })
            : t("instance.peakRatio", { ratio: formatPercent(ratio) })}
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
