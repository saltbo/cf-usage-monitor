import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CostPoint } from "../../shared/dashboard";
import {
  formatBillingThrough,
  formatCurrency,
  formatDate,
} from "../lib/format";

const WIDTH = 1_000;
const HEIGHT = 260;
const MARGIN = { top: 28, right: 18, bottom: 42, left: 72 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const DAY_MS = 24 * 60 * 60 * 1_000;

interface ChartDay {
  timestamp: string;
  cost: number | null;
}

export function CostChart({
  currency,
  cycleEnd,
  cycleStart,
  daily,
  postedThrough,
}: {
  currency: string;
  cycleEnd: string;
  cycleStart: string;
  daily: CostPoint[];
  postedThrough: string;
}) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const days = useMemo(
    () => completeBillingCycle(daily, cycleStart, cycleEnd, postedThrough),
    [cycleEnd, cycleStart, daily, postedThrough],
  );
  const maxCost = Math.max(0, ...days.map((day) => day.cost ?? 0));
  const axisMax = niceAxisMax(maxCost);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const slotWidth = PLOT_WIDTH / Math.max(1, days.length);
  const barWidth = Math.max(3, slotWidth * 0.62);
  const active = activeIndex === null ? null : days[activeIndex];
  const latestPostedIndex = Math.max(
    0,
    days.findLastIndex((day) => day.cost !== null),
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) {
      return;
    }
    const activeX =
      ((latestPostedIndex + 0.5) / Math.max(1, days.length)) *
      container.scrollWidth;
    container.scrollLeft = Math.max(0, activeX - container.clientWidth / 2);
  }, [days.length, latestPostedIndex]);

  function activateFromPointer(clientX: number) {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || days.length === 0) {
      return;
    }
    const chartX = ((clientX - bounds.left) / bounds.width) * WIDTH;
    const index = Math.max(
      0,
      Math.min(
        days.length - 1,
        Math.floor((chartX - MARGIN.left) / slotWidth),
      ),
    );
    setActiveIndex(index);
  }

  function moveActive(direction: -1 | 1) {
    setActiveIndex((current) =>
      Math.max(
        0,
        Math.min(days.length - 1, (current ?? latestPostedIndex) + direction),
      ),
    );
  }

  const activeX =
    activeIndex === null
      ? 0
      : MARGIN.left + activeIndex * slotWidth + slotWidth / 2;
  const tooltipX = Math.min(
    WIDTH - MARGIN.right - 168,
    Math.max(MARGIN.left + 8, activeX - 80),
  );

  return (
    <div className="cost-chart">
      <span className="cost-chart-timezone">{t("cost.billingDayUtc")}</span>
      <div className="cost-chart-scroll" ref={scrollRef}>
        <svg
          aria-label={t("cost.chartLabel", {
            date: formatBillingThrough(postedThrough),
          })}
          onBlur={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(latestPostedIndex)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              moveActive(-1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              moveActive(1);
            }
          }}
          onPointerLeave={() => setActiveIndex(null)}
          onPointerMove={(event) => activateFromPointer(event.clientX)}
          ref={svgRef}
          role="img"
          tabIndex={0}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
        {ticks.map((ratio) => {
          const y = MARGIN.top + PLOT_HEIGHT * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                className="cost-grid-line"
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y}
                y2={y}
              />
              <text
                className="cost-axis-label"
                textAnchor="end"
                x={MARGIN.left - 12}
                y={y + 4}
              >
                {formatCurrency(axisMax * ratio, currency)}
              </text>
            </g>
          );
        })}
        {days.map((day, index) => {
          if (day.cost === null) {
            return null;
          }
          const height = (day.cost / axisMax) * PLOT_HEIGHT;
          const x = MARGIN.left + index * slotWidth + (slotWidth - barWidth) / 2;
          return (
            <rect
              className="cost-bar"
              height={Math.max(day.cost > 0 ? 1 : 0, height)}
              key={day.timestamp}
              rx={2}
              width={barWidth}
              x={x}
              y={MARGIN.top + PLOT_HEIGHT - height}
            />
          );
        })}
        {xTickIndexes(days.length).map((index) => (
          <text
            className="cost-axis-label"
            key={days[index].timestamp}
            textAnchor={
              index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"
            }
            x={MARGIN.left + index * slotWidth + slotWidth / 2}
            y={HEIGHT - 14}
          >
            {formatDate(days[index].timestamp)}
          </text>
        ))}
        {active ? (
          <g>
            <line
              className="cost-hover-line"
              x1={activeX}
              x2={activeX}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
            />
            <g transform={`translate(${tooltipX} ${MARGIN.top + 8})`}>
              <rect className="cost-tooltip-bg" height={52} rx={6} width={160} />
              <text className="cost-tooltip-date" x={12} y={20}>
                {formatDate(active.timestamp)} · UTC
              </text>
              <text className="cost-tooltip-value" x={12} y={40}>
                {active.cost === null
                  ? t("cost.notPosted")
                  : formatCurrency(active.cost, currency)}
              </text>
            </g>
          </g>
        ) : null}
        </svg>
      </div>
    </div>
  );
}

function completeBillingCycle(
  points: readonly CostPoint[],
  cycleStart: string,
  cycleEnd: string,
  postedThrough: string,
): ChartDay[] {
  const byDate = new Map(
    points.map((point) => [point.timestamp.slice(0, 10), point.cost]),
  );
  const start = Date.parse(cycleStart);
  const end = Date.parse(cycleEnd);
  const postedEnd = Date.parse(postedThrough);
  const days: ChartDay[] = [];
  for (let timestamp = start; timestamp < end; timestamp += DAY_MS) {
    const iso = new Date(timestamp).toISOString();
    days.push({
      timestamp: iso,
      cost:
        timestamp < postedEnd
          ? (byDate.get(iso.slice(0, 10)) ?? 0)
          : null,
    });
  }
  return days;
}

function niceAxisMax(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function xTickIndexes(length: number): number[] {
  if (length <= 1) {
    return [0];
  }
  return [...new Set([0, 0.25, 0.5, 0.75, 1].map(
    (ratio) => Math.round((length - 1) * ratio),
  ))];
}
