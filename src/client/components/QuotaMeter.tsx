import type { OverviewMetric } from "../../shared/dashboard";
import { formatPercent } from "../lib/format";

export function QuotaMeter({
  metric,
  showForecast = false,
}: {
  metric: OverviewMetric;
  showForecast?: boolean;
}) {
  const usedPercent = Math.max(0, metric.usedRatio * 100);
  const scale = usedPercent <= 100
    ? 100
    : Math.ceil((usedPercent * 1.08) / 25) * 25;
  const quotaPosition = (100 / scale) * 100;
  const forecastPosition = Math.min(
    100,
    Math.max(0, metric.forecastProjectedRatio * 100),
  );
  const label = [
    `当前使用 ${formatPercent(metric.usedRatio)}`,
    showForecast
      ? `稳健预计 ${formatPercent(metric.forecastProjectedRatio)}`
      : null,
  ]
    .filter(Boolean)
    .join("；");

  return (
    <span className="quota-meter">
      <progress
        aria-label={label}
        className={`quota-progress ${
          metric.usedRatio >= 1
            ? "critical"
            : metric.usedRatio >= 0.8
              ? "warning"
              : ""
        }`}
        max={scale}
        value={usedPercent}
      />
      {usedPercent > 100 ? (
        <svg
          aria-hidden="true"
          className="quota-meter-marker"
          preserveAspectRatio="none"
          viewBox="0 0 100 18"
        >
          <line
            className="quota-marker"
            x1={quotaPosition}
            x2={quotaPosition}
            y1="0"
            y2="18"
          />
        </svg>
      ) : showForecast ? (
        <svg
          aria-hidden="true"
          className="quota-meter-marker"
          preserveAspectRatio="none"
          viewBox="0 0 100 18"
        >
          <line
            className="forecast-marker"
            x1={forecastPosition}
            x2={forecastPosition}
            y1="0"
            y2="18"
          />
        </svg>
      ) : null}
    </span>
  );
}
