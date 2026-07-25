import {
  type KeyboardEvent,
  type PointerEvent,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { DashboardMetric } from "../../shared/dashboard";
import { shortTermUsageForecast } from "../../forecast";
import {
  formatCompact,
  formatDate,
  formatTimestamp,
  localTimeZoneLabel,
} from "../lib/format";
import { formatUnit, metricLabel } from "../lib/localization";

interface TrendPoint {
  timestamp: string;
  value: number;
}

interface TrendSlot extends TrendPoint {
  actual: number;
  forecast: number | null;
  state: "complete" | "partial" | "future";
}

export function TrendChart({
  className = "quota-chart",
  completePeriod = false,
  cycleStart,
  metric,
  measuredAt,
  grain,
  points: sourcePoints = grain === "hourly" ? metric.hourly : metric.daily,
}: {
  className?: string;
  completePeriod?: boolean;
  cycleStart?: string;
  metric: DashboardMetric;
  measuredAt?: string;
  grain: "hourly" | "daily";
  points?: TrendPoint[];
}) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const points = completePeriod
    ? buildTrendSlots(metric, grain, sourcePoints, measuredAt, cycleStart)
    : sourcePoints.map<TrendSlot>((point) => ({
        ...point,
        actual: point.value,
        forecast: null,
        state: "complete",
      }));
  if (points.length === 0) {
    return <div className="empty-state">{t("chart.empty")}</div>;
  }

  const safeValue =
    grain === "hourly"
      ? metric.baselineHourlyUsage
      : metric.baselineHourlyUsage * 24;
  const completedPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter((point) => point.state === "complete");
  const shortWindow = 3;
  const longWindow = 7;
  const bucketMs = grain === "hourly" ? 3_600_000 : 86_400_000;
  const shortAverage = buildMovingAverage(
    completedPoints,
    sourcePoints,
    shortWindow,
    bucketMs,
  );
  const longAverage = buildMovingAverage(
    completedPoints,
    sourcePoints,
    longWindow,
    bucketMs,
  );
  const forecastIndices = points
    .map((point, index) => ({ forecast: point.forecast, index }))
    .filter((point) => point.forecast !== null)
    .map((point) => point.index);
  const shortForecast = buildProjectedMovingAverage(
    shortAverage,
    forecastIndices,
    points,
    sourcePoints,
    shortWindow,
    bucketMs,
  );
  const longForecast = buildProjectedMovingAverage(
    longAverage,
    forecastIndices,
    points,
    sourcePoints,
    longWindow,
    bucketMs,
  );
  const observedMaximum = Math.max(
    ...points.map((point) => point.value),
    ...shortAverage.map((point) => point.value),
    ...longAverage.map((point) => point.value),
    ...shortForecast.map((point) => point.value),
    ...longForecast.map((point) => point.value),
    1,
  );
  const chartMaximum = observedMaximum * 1.12;
  const width = 960;
  const height = 300;
  const margin = { top: 24, right: 24, bottom: 42, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const step = innerWidth / points.length;
  const barWidth = Math.max(3, step * 0.62);
  const safeClipped = safeValue > chartMaximum;
  const overflowBandHeight = safeClipped ? innerHeight / 4 : 0;
  const plotTop = margin.top + overflowBandHeight;
  const plotHeight = innerHeight - overflowBandHeight;
  const y = (value: number) =>
    plotTop + plotHeight - (value / chartMaximum) * plotHeight;
  const safeY = safeClipped ? margin.top + 2 : y(safeValue);
  const tickEvery = Math.max(1, Math.ceil(points.length / 7));
  const interval =
    points.length > 1
      ? Math.max(
          1,
          Date.parse(points[1].timestamp) - Date.parse(points[0].timestamp),
        )
      : grain === "hourly"
        ? 3_600_000
        : 86_400_000;
  const domainStart = Date.parse(points[0].timestamp);
  const domainEnd = Date.parse(points.at(-1)?.timestamp ?? points[0].timestamp) +
    interval;
  const now = measuredAt ? Date.parse(measuredAt) : Date.now();
  const nowX =
    now >= domainStart && now <= domainEnd
      ? margin.left +
        ((now - domainStart) / (domainEnd - domainStart)) * innerWidth
      : null;
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const activeX =
    activeIndex === null
      ? null
      : margin.left + step * activeIndex + step / 2;
  const activeTrendValues =
    activeIndex === null
      ? []
      : [
          {
            color: "#fbbf24",
            label:
              activePoint?.forecast === null
                ? `MA${shortWindow}`
                : t("product.maForecast", { window: shortWindow }),
            value:
              activePoint?.forecast === null
                ? shortAverage.find((point) => point.index === activeIndex)
                    ?.value
                : shortForecast.find((point) => point.index === activeIndex)
                    ?.value,
          },
          {
            color: "#a78bfa",
            label:
              activePoint?.forecast === null
                ? `MA${longWindow}`
                : t("product.maForecast", { window: longWindow }),
            value:
              activePoint?.forecast === null
                ? longAverage.find((point) => point.index === activeIndex)
                    ?.value
                : longForecast.find((point) => point.index === activeIndex)
                    ?.value,
          },
        ].filter(
          (
            item,
          ): item is { color: string; label: string; value: number } =>
            item.value !== undefined,
        );
  const activeY =
    activePoint === null
      ? null
      : y(
          activePoint.forecast === null
            ? activePoint.actual
            : activePoint.actual + activePoint.forecast,
        );

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * width;
    const index = Math.max(
      0,
      Math.min(points.length - 1, Math.floor((svgX - margin.left) / step)),
    );
    setActiveIndex(index);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    setActiveIndex((current) =>
      Math.max(
        0,
        Math.min(
          points.length - 1,
          (current ?? points.length - 1) + direction,
        ),
      ),
    );
  }

  return (
    <div
      aria-label={t("chart.trendLabel", {
        metric: metricLabel(metric.metric),
        value: formatCompact(safeValue),
        unit: formatUnit(metric.unit),
      })}
      className={className}
      role="img"
    >
      <svg
        aria-label={t("chart.interactive", {
          metric: metricLabel(metric.metric),
        })}
        onBlur={() => setActiveIndex(null)}
        onFocus={() => setActiveIndex((current) => current ?? points.length - 1)}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={handlePointerMove}
        tabIndex={0}
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = chartMaximum * ratio;
          const position = y(value);
          return (
            <g key={ratio}>
              <line
                stroke="#243144"
                x1={margin.left}
                x2={width - margin.right}
              y1={position}
              y2={position}
              />
              <text
                fill="#9aa8ba"
                fontSize="10"
                textAnchor="end"
                x={margin.left - 10}
                y={position + 4}
              >
                {formatCompact(value)}
              </text>
            </g>
          );
        })}
        <line
          className="chart-y-axis"
          stroke="#243144"
          x1={margin.left}
          x2={margin.left}
          y1={plotTop}
          y2={plotTop + plotHeight}
        />
        {points.map((point, index) => {
          const x = margin.left + step * index + (step - barWidth) / 2;
          const actualTop = y(point.actual);
          const projectedTop = y(point.value);
          const base = y(0);
          return (
            <g
              className="chart-slot"
              data-state={point.state}
              key={point.timestamp}
            >
              {point.actual > 0 ? (
                <rect
                  className="chart-actual-bar"
                  fill="#5eead4"
                  opacity={activeIndex === index ? 1 : point.state === "partial" ? 0.48 : 0.75}
                  height={Math.max(1, base - actualTop)}
                  rx={2}
                  width={barWidth}
                  x={x}
                  y={actualTop}
                >
                  <title>
                    {formatTrendTimestamp(point.timestamp, grain, true)} ·{" "}
                    {t("chart.actual")} {formatCompact(point.actual)}{" "}
                    {formatUnit(metric.unit)}
                    {point.state === "partial"
                      ? ` (${t("chart.partial")})`
                      : ""}
                  </title>
                </rect>
              ) : null}
              {point.forecast !== null &&
              (point.state === "future" || point.forecast > 0) ? (
                <rect
                  className="chart-forecast-bar"
                  fill="#5eead4"
                  fillOpacity=".12"
                  height={Math.max(1, actualTop - projectedTop)}
                  rx={2}
                  stroke="#5eead4"
                  strokeDasharray="4 3"
                  strokeWidth="1.5"
                  width={barWidth}
                  x={x}
                  y={point.forecast > 0 ? projectedTop : actualTop - 1}
                >
                  <title>
                    {formatTrendTimestamp(point.timestamp, grain, true)} ·{" "}
                    {t("chart.forecast")} {formatCompact(point.value)}{" "}
                    {formatUnit(metric.unit)}
                  </title>
                </rect>
              ) : null}
              {grain === "hourly" && point.state === "partial" ? (
                <text
                  fill="#9aa8ba"
                  fontSize="9"
                  textAnchor="middle"
                  x={x + barWidth / 2}
                  y={Math.max(plotTop + 12, actualTop - 7)}
                >
                  {t("chart.partial")}
                </text>
              ) : null}
              {index % tickEvery === 0 || index === points.length - 1 ? (
                <text
                  fill="#9aa8ba"
                  fontSize="9"
                  textAnchor="middle"
                  x={x + barWidth / 2}
                  y={height - 12}
                >
                  {formatTrendTick(point.timestamp, grain)}
                </text>
              ) : null}
            </g>
          );
        })}
        <MovingAverageLine
          className="chart-moving-average-short"
          color="#fbbf24"
          points={shortAverage}
          step={step}
          xStart={margin.left}
          y={y}
        />
        <MovingAverageLine
          className="chart-moving-average-long"
          color="#a78bfa"
          points={longAverage}
          step={step}
          xStart={margin.left}
          y={y}
        />
        <TrendForecastLine
          className="chart-moving-average-short-forecast"
          color="#fbbf24"
          points={shortForecast}
          step={step}
          xStart={margin.left}
          y={y}
        />
        <TrendForecastLine
          className="chart-moving-average-long-forecast"
          color="#a78bfa"
          points={longForecast}
          step={step}
          xStart={margin.left}
          y={y}
        />
        <line
          className="chart-safe-line"
          stroke="#60a5fa"
          strokeDasharray="6 5"
          strokeWidth="1.5"
          x1={margin.left}
          x2={width - margin.right}
          y1={safeY}
          y2={safeY}
        />
        <line
          className="chart-safe-tick"
          stroke="#60a5fa"
          strokeWidth="1.5"
          x1={margin.left - 5}
          x2={margin.left + 4}
          y1={safeY}
          y2={safeY}
        />
        <text
          className="chart-safe-axis-value"
          fill="#60a5fa"
          fontSize="10"
          textAnchor="end"
          x={margin.left - 10}
          y={safeY + 4}
        >
          {formatCompact(safeValue)}
        </text>
        {safeClipped ? (
          <g className="chart-safe-overflow" pointerEvents="none">
            <line
              className="chart-safe-gap"
              opacity=".7"
              stroke="#68778b"
              strokeDasharray="1 6"
              strokeLinecap="round"
              strokeWidth="2"
              x1={margin.left}
              x2={margin.left}
              y1={safeY + 5}
              y2={plotTop - 1}
            />
          </g>
        ) : null}
        {safeClipped ? (
          <g className="chart-safe-label" pointerEvents="none">
            <text
              fill="#dbeafe"
              fontSize="9"
              textAnchor="start"
              x={margin.left + 8}
              y={safeY + 15}
            >
              {t("chart.safeLine")}
            </text>
          </g>
        ) : null}
        {nowX === null ? null : (
          <g className="chart-now-marker" pointerEvents="none">
            <line
              className="chart-now-line"
              opacity=".55"
              stroke="#f8fafc"
              strokeDasharray="2 5"
              x1={nowX}
              x2={nowX}
              y1={plotTop}
              y2={plotTop + plotHeight}
            />
            <text
              fill="#f8fafc"
              fontSize="9"
              x={Math.min(width - margin.right - 24, nowX + 5)}
              y={plotTop + 12}
            >
              {t("chart.now")}
            </text>
          </g>
        )}
        {activePoint && activeX !== null && activeY !== null ? (
          <ChartTooltip
            activeX={activeX}
            activeY={activeY}
            height={height}
            hoverTop={safeClipped ? safeY : plotTop}
            grain={grain}
            margin={{ ...margin, top: plotTop }}
            metric={metric}
            point={activePoint}
            trendValues={activeTrendValues}
            width={width}
          />
        ) : null}
      </svg>
      <div className="chart-timezone">
        {t("common.timezone")} ·{" "}
        {grain === "hourly"
          ? localTimeZoneLabel(measuredAt ?? new Date().toISOString())
          : t("chart.dailyUtc")}
      </div>
    </div>
  );
}

function buildMovingAverage(
  samples: Array<TrendSlot & { index: number }>,
  source: TrendPoint[],
  windowSize: number,
  bucketMs: number,
): { index: number; value: number }[] {
  const values = new Map(
    source.map((point) => [Date.parse(point.timestamp), point.value]),
  );
  return samples.map((point) => {
    const timestamp = Date.parse(point.timestamp);
    const window = Array.from(
      { length: windowSize },
      (_, offset) => values.get(timestamp - offset * bucketMs) ?? 0,
    );
    return {
      index: point.index,
      value:
        window.reduce((sum, sample) => sum + sample, 0) / windowSize,
    };
  });
}

function MovingAverageLine({
  className,
  color,
  points,
  step,
  xStart,
  y,
}: {
  className: string;
  color: string;
  points: { index: number; value: number }[];
  step: number;
  xStart: number;
  y: (value: number) => number;
}) {
  if (points.length < 2) {
    return null;
  }
  return (
    <polyline
      className={`chart-moving-average ${className}`}
      fill="none"
      points={points
        .map(
          (point) =>
            `${xStart + step * point.index + step / 2},${y(point.value)}`,
        )
        .join(" ")}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
    />
  );
}

function buildProjectedMovingAverage(
  history: { index: number; value: number }[],
  forecastIndices: number[],
  visiblePoints: TrendSlot[],
  sourcePoints: TrendPoint[],
  windowSize: number,
  bucketMs: number,
): { index: number; value: number }[] {
  const anchor = history.at(-1);
  if (!anchor || forecastIndices.length === 0) {
    return [];
  }
  const values = new Map(
    sourcePoints.map((point) => [Date.parse(point.timestamp), point.value]),
  );
  const projected = forecastIndices.map((index) => {
    const point = visiblePoints[index];
    if (!point || point.forecast === null) {
      throw new Error(`Projected trend point ${index} is missing`);
    }
    const timestamp = Date.parse(point.timestamp);
    values.set(timestamp, point.value);
    const window = Array.from(
      { length: windowSize },
      (_, offset) => values.get(timestamp - offset * bucketMs) ?? 0,
    );
    return {
      index,
      value: window.reduce((sum, value) => sum + value, 0) / windowSize,
    };
  });
  return [
    anchor,
    ...projected,
  ];
}

function TrendForecastLine({
  className,
  color,
  points,
  step,
  xStart,
  y,
}: {
  className: string;
  color: string;
  points: { index: number; value: number }[];
  step: number;
  xStart: number;
  y: (value: number) => number;
}) {
  if (points.length < 2) {
    return null;
  }
  return (
    <polyline
      className={`chart-moving-average-forecast ${className}`}
      fill="none"
      points={points
        .map(
          (point) =>
            `${xStart + step * point.index + step / 2},${y(point.value)}`,
        )
        .join(" ")}
      stroke={color}
      strokeDasharray="7 5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
    />
  );
}

function buildTrendSlots(
  metric: DashboardMetric,
  grain: "hourly" | "daily",
  source: TrendPoint[],
  measuredAt?: string,
  cycleStart?: string,
): TrendSlot[] {
  if (!measuredAt) {
    throw new Error("measuredAt is required for a complete-period trend");
  }
  const hour = 3_600_000;
  const day = 24 * hour;
  const unit = grain === "hourly" ? hour : day;
  const now = Date.parse(measuredAt);
  const utcDayStart = Math.floor(now / day) * day;
  const localDay = localDayBounds(now, hour);
  const repeatingDaily = grain === "daily" && metric.period === "utc_day";
  const start =
    grain === "hourly"
      ? localDay.start
      : repeatingDaily
        ? Math.max(
            Date.parse(cycleStart ?? metric.periodStart),
            utcDayStart - 13 * day,
          )
        : Date.parse(metric.periodStart);
  const end =
    grain === "hourly"
      ? localDay.end
      : repeatingDaily
        ? utcDayStart + day
        : Date.parse(metric.periodEnd);
  const byTime = new Map(
    source.map((point) => [Date.parse(point.timestamp), point.value]),
  );
  const currentUnitStart = Math.floor(now / unit) * unit;
  const currentProgress = (now - currentUnitStart) / unit;
  const usesFullUnitRate = metric.metric === "r2.storage_gb_month";
  const dailyOperatingLevel =
    grain === "daily"
      ? estimateDailyOperatingLevel(metric.hourly, now, usesFullUnitRate)
      : null;
  const projection = shortTermUsageForecast({
    anchorTimestamp: new Date(currentUnitStart - unit).toISOString(),
    bucketMs: unit,
    current:
      currentProgress > 0
        ? {
            progress:
              dailyOperatingLevel === null && !usesFullUnitRate
                ? currentProgress
                : 1,
            value:
              dailyOperatingLevel ??
              (byTime.get(currentUnitStart) ?? 0),
          }
        : undefined,
    forecastCount: 5,
    points: source,
  });
  const slots: TrendSlot[] = [];
  let futureIndex = 0;

  for (let time = start; time < end; time += unit) {
    const slotEnd = time + unit;
    const state =
      slotEnd <= now ? "complete" : time < now ? "partial" : "future";
    const actual = time < now ? (byTime.get(time) ?? 0) : 0;
    const forecast =
      state === "partial"
        ? Math.max(0, (projection.currentEstimate ?? actual) - actual)
        : state === "future"
          ? (projection.values[futureIndex++] ?? null)
          : null;
    slots.push({
      actual,
      forecast,
      state,
      timestamp: new Date(time).toISOString(),
      value: actual + (forecast ?? 0),
    });
  }
  return slots;
}

function localDayBounds(
  now: number,
  bucketMs: number,
): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: Math.ceil(start.getTime() / bucketMs) * bucketMs,
    end: Math.ceil(end.getTime() / bucketMs) * bucketMs,
  };
}

function estimateDailyOperatingLevel(
  hourlyPoints: TrendPoint[],
  now: number,
  usesFullUnitRate: boolean,
): number | null {
  if (hourlyPoints.length === 0) {
    return null;
  }
  const hour = 3_600_000;
  const currentHourStart = Math.floor(now / hour) * hour;
  const byTime = new Map(
    hourlyPoints.map((point) => [Date.parse(point.timestamp), point.value]),
  );
  const hourlyProjection = shortTermUsageForecast({
    anchorTimestamp: new Date(currentHourStart - hour).toISOString(),
    bucketMs: hour,
    current: {
      progress: usesFullUnitRate ? 1 : (now - currentHourStart) / hour,
      value: byTime.get(currentHourStart) ?? 0,
    },
    forecastCount: 2,
    points: hourlyPoints,
  });
  const operatingLevels = [
    hourlyProjection.currentEstimate,
    ...hourlyProjection.values,
  ].filter((value): value is number => value !== null);
  return (
    (operatingLevels.reduce((sum, value) => sum + value, 0) /
      operatingLevels.length) *
    24
  );
}

function formatTrendTick(
  timestamp: string,
  grain: "hourly" | "daily",
): string {
  if (grain === "hourly") {
    return formatTimestamp(timestamp);
  }
  return formatDate(timestamp);
}

function formatTrendTimestamp(
  timestamp: string,
  grain: "hourly" | "daily",
  includeTimeZone = false,
): string {
  return grain === "hourly"
    ? formatTimestamp(timestamp, includeTimeZone)
    : `${formatTrendTick(timestamp, grain)}${includeTimeZone ? " · UTC" : ""}`;
}

function ChartTooltip({
  activeX,
  activeY,
  height,
  hoverTop,
  grain,
  margin,
  metric,
  point,
  trendValues,
  width,
}: {
  activeX: number;
  activeY: number;
  height: number;
  hoverTop: number;
  grain: "hourly" | "daily";
  margin: { top: number; right: number; bottom: number; left: number };
  metric: DashboardMetric;
  point: TrendSlot;
  trendValues: { color: string; label: string; value: number }[];
  width: number;
}) {
  const { t } = useTranslation();
  const tooltipWidth = 190;
  const showActual = point.state !== "future";
  const showForecast = point.forecast !== null;
  const tooltipHeight =
    32 +
    (showActual ? 16 : 0) +
    (showForecast ? 16 : 0) +
    trendValues.length * 16;
  const x = Math.min(
    width - margin.right - tooltipWidth,
    Math.max(margin.left, activeX + 12),
  );
  const y = Math.min(
    height - margin.bottom - tooltipHeight,
    Math.max(margin.top, activeY - tooltipHeight - 10),
  );
  return (
    <g className="chart-active-point" pointerEvents="none">
      <line
        className="chart-hover-line"
        stroke="#f8fafc"
        strokeDasharray="3 4"
        x1={activeX}
        x2={activeX}
        y1={hoverTop}
        y2={height - margin.bottom}
      />
      <circle
        cx={activeX}
        cy={activeY}
        fill="#070b12"
        r="5"
        stroke="#5eead4"
        strokeWidth="2"
      />
      <rect
        fill="#111b2a"
        height={tooltipHeight}
        rx="5"
        stroke="#3a4b62"
        width={tooltipWidth}
        x={x}
        y={y}
      />
      <text fill="#9aa8ba" fontSize="10" x={x + 10} y={y + 18}>
        {formatTrendTimestamp(point.timestamp, grain, true)}
      </text>
      {showActual ? (
        <text
          fill="#f8fafc"
          fontSize="12"
          fontWeight="700"
          x={x + 10}
          y={y + 36}
        >
          {formatCompact(point.actual)} {formatUnit(metric.unit)}
        </text>
      ) : null}
      {showForecast ? (
        <text
          fill="#5eead4"
          fontSize="10"
          x={x + 10}
          y={y + (showActual ? 53 : 36)}
        >
          {t(
            point.state === "partial"
              ? "chart.estimatedComplete"
              : "chart.forecast",
          )}{" "}
          · {formatCompact(point.value)} {formatUnit(metric.unit)}
        </text>
      ) : null}
      {trendValues.map((trend, index) => (
        <text
          fill={trend.color}
          fontSize="10"
          key={trend.label}
          x={x + 10}
          y={
            y +
            36 +
            (showActual ? 16 : 0) +
            (showForecast ? 16 : 0) +
            index * 16
          }
        >
          {trend.label} · {formatCompact(trend.value)}{" "}
          {formatUnit(metric.unit)}
        </text>
      ))}
    </g>
  );
}
