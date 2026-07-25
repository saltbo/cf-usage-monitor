import {
  METRICS,
  METRIC_NAMES,
  type MetricContributor,
  type MetricName,
  type UsageSnapshot,
} from "./metrics";
import {
  calculateForecastRates,
  sumTransitionalDailyForecast,
} from "./forecast";

export const SAMPLE_INTERVAL_MINUTES = 10;
const HISTORY_LIMIT = 24 * 6;
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

export type RiskLevel = "normal" | "warning" | "critical" | "exceeded";
export type AlertPolicy = "strict" | "track_only";

export interface QuotaEvaluation {
  metric: MetricName;
  used: number;
  quota: number;
  recentHourlyUsage: number;
  safeHourlyUsage: number;
  baselineHourlyUsage: number;
  burnRate: number | null;
  usedRatio: number;
  projectedUsage: number;
  projectedRatio: number;
  forecastHourlyUsage: number;
  forecastHourlySamples: number;
  forecastDailyUsage: number;
  forecastDailySamples: number;
  forecastProjectedUsage: number;
  forecastProjectedRatio: number;
  exhaustsAt: string | null;
  periodStart: string;
  periodEnd: string;
  risk: RiskLevel;
  contributors: MetricContributor[];
  recentContributors: MetricContributor[];
}

export interface MetricState {
  periodStart?: string;
  samples: Array<{
    windowEnd: string;
    used: number;
    recentHourlyUsage: number;
  }>;
  riskStreak: number;
  recoveryStreak: number;
  recoveredForPeriod?: boolean;
  incident?: {
    startedAt: string;
    lastNotifiedAt: string;
    notificationCount: number;
    worstProjectedRatio: number;
  };
  lastIncident?: {
    startedAt: string;
    endedAt: string;
    notificationCount: number;
    worstProjectedRatio: number;
  };
}

export interface MonitorState {
  lastWindowEnd?: string;
  metrics: Partial<Record<MetricName, MetricState>>;
  latest?: QuotaEvaluation[];
  lastRun?: {
    detectedAt: string;
    failures: UsageSnapshot["failures"];
    alerts: QuotaAlert[];
    recoveries: QuotaRecovery[];
  };
}

export interface DetectionConfig {
  alertAfterSamples: number;
  recoverySamples: number;
  reminderMinutes: number;
  policies: Partial<Record<MetricName, AlertPolicy>>;
}

export interface QuotaAlert extends QuotaEvaluation {
  incidentStartedAt: string;
  notificationCount: number;
}

export interface QuotaRecovery extends QuotaEvaluation {
  incidentStartedAt: string;
  notificationCount: number;
}

export interface DetectionResult {
  state: MonitorState;
  alerts: QuotaAlert[];
  recoveries: QuotaRecovery[];
}

export function detectQuotaRisks(
  previous: MonitorState,
  snapshot: UsageSnapshot,
  config: DetectionConfig,
): DetectionResult {
  const nowMs = Date.parse(snapshot.measuredAt);
  const state: MonitorState = {
    lastWindowEnd: snapshot.measuredAt,
    metrics: structuredClone(previous.metrics),
  };
  const alerts: QuotaAlert[] = [];
  const recoveries: QuotaRecovery[] = [];
  const failedCollectors = new Set(
    snapshot.failures.map((failure) => failure.collector),
  );
  const evaluations = METRIC_NAMES.map((metric) => {
    const evaluation = evaluateMetric(metric, snapshot);
    if (!failedCollectors.has(collectorForMetric(metric))) {
      return evaluation;
    }
    return (
      previous.latest?.find((candidate) => candidate.metric === metric) ??
      evaluation
    );
  });

  for (const evaluation of evaluations) {
    if (failedCollectors.has(collectorForMetric(evaluation.metric))) {
      continue;
    }
    const metricState = state.metrics[evaluation.metric] ?? {
      samples: [],
      riskStreak: 0,
      recoveryStreak: 0,
    };
    if (
      metricState.periodStart &&
      metricState.periodStart !== evaluation.periodStart
    ) {
      metricState.riskStreak = 0;
      metricState.recoveryStreak = 0;
      metricState.recoveredForPeriod = false;
      delete metricState.incident;
    }
    metricState.periodStart = evaluation.periodStart;
    metricState.samples = [
      ...metricState.samples,
      {
        windowEnd: snapshot.measuredAt,
        used: evaluation.used,
        recentHourlyUsage: evaluation.recentHourlyUsage,
      },
    ].slice(-HISTORY_LIMIT);
    state.metrics[evaluation.metric] = metricState;

    const policy = alertPolicyFor(config, evaluation.metric);
    if (policy === "track_only") {
      metricState.riskStreak = 0;
      metricState.recoveryStreak = 0;
      metricState.recoveredForPeriod = false;
      delete metricState.incident;
      continue;
    }

    const quotaAtRisk =
      evaluation.risk === "critical" || evaluation.risk === "exceeded";
    const aboveBaseline =
      evaluation.recentHourlyUsage >= evaluation.baselineHourlyUsage;
    const openingRisk =
      quotaAtRisk &&
      (!metricState.recoveredForPeriod || aboveBaseline);
    metricState.riskStreak = openingRisk ? metricState.riskStreak + 1 : 0;

    if (metricState.incident) {
      metricState.incident.worstProjectedRatio = Math.max(
        metricState.incident.worstProjectedRatio,
        evaluation.projectedRatio,
      );
      metricState.recoveryStreak =
        evaluation.recentHourlyUsage < evaluation.baselineHourlyUsage
          ? metricState.recoveryStreak + 1
          : 0;

      if (metricState.recoveryStreak >= config.recoverySamples) {
        recoveries.push({
          ...evaluation,
          incidentStartedAt: metricState.incident.startedAt,
          notificationCount: metricState.incident.notificationCount,
        });
        metricState.lastIncident = {
          startedAt: metricState.incident.startedAt,
          endedAt: snapshot.measuredAt,
          notificationCount: metricState.incident.notificationCount,
          worstProjectedRatio: metricState.incident.worstProjectedRatio,
        };
        delete metricState.incident;
        metricState.recoveredForPeriod = true;
        metricState.recoveryStreak = 0;
        continue;
      }

      const reminderDue =
        nowMs - Date.parse(metricState.incident.lastNotifiedAt) >=
        config.reminderMinutes * 60 * 1_000;
      if (metricState.recoveryStreak === 0 && reminderDue) {
        metricState.incident.notificationCount += 1;
        metricState.incident.lastNotifiedAt = snapshot.measuredAt;
        alerts.push({
          ...evaluation,
          incidentStartedAt: metricState.incident.startedAt,
          notificationCount: metricState.incident.notificationCount,
        });
      }
      continue;
    }

    const shouldOpen =
      metricState.recoveredForPeriod
        ? openingRisk &&
          metricState.riskStreak >= config.alertAfterSamples
        : evaluation.risk === "exceeded" ||
          (evaluation.risk === "critical" &&
            metricState.riskStreak >= config.alertAfterSamples);
    if (!shouldOpen) {
      continue;
    }

    metricState.incident = {
      startedAt: snapshot.measuredAt,
      lastNotifiedAt: snapshot.measuredAt,
      notificationCount: 1,
      worstProjectedRatio: evaluation.projectedRatio,
    };
    metricState.recoveredForPeriod = false;
    alerts.push({
      ...evaluation,
      incidentStartedAt: snapshot.measuredAt,
      notificationCount: 1,
    });
  }

  state.latest = evaluations;
  return { state, alerts, recoveries };
}

function collectorForMetric(metric: MetricName): string {
  if (metric === "r2.storage_gb_month") {
    return "r2_storage";
  }
  return METRICS[metric].product;
}

export function evaluateMetric(
  metric: MetricName,
  snapshot: UsageSnapshot,
): QuotaEvaluation {
  const definition = METRICS[metric];
  const usage = snapshot.values.find((value) => value.name === metric);
  const recent = snapshot.recentValues.find((value) => value.name === metric);
  const period =
    definition.period === "utc_day"
      ? utcDay(snapshot.measuredAt)
      : snapshot.cycle;
  const used = usage?.value ?? 0;
  const recentHourlyUsage = recent?.value ?? 0;
  const quota = definition.quota;
  const periodHours = Math.max(
    1,
    (Date.parse(period.end) - Date.parse(period.start)) / HOUR_MS,
  );
  const baselineHourlyUsage = quota / periodHours;
  const remainingHours = Math.max(
    0,
    (Date.parse(period.end) - Date.parse(snapshot.measuredAt)) / HOUR_MS,
  );
  const remainingQuota = Math.max(0, quota - used);
  const safeHourlyUsage =
    remainingHours === 0 ? 0 : remainingQuota / remainingHours;
  const dailyPeakStorage = usesDailyPeakAverage(metric);
  const remainingFullDays = fullDaysAfterCurrentUtcDay(
    snapshot.measuredAt,
    period.end,
  );
  const projectedUsage =
    used +
    recentHourlyUsage *
      (dailyPeakStorage ? remainingFullDays * 24 : remainingHours);
  const projectedRatio = projectedUsage / quota;
  const forecast = buildStableForecast(metric, snapshot, period, used);
  const usedRatio = used / quota;
  const burnRate =
    safeHourlyUsage === 0
      ? recentHourlyUsage > 0
        ? null
        : 0
      : recentHourlyUsage / safeHourlyUsage;
  const exhaustsAt =
    recentHourlyUsage <= 0 || used >= quota
      ? used >= quota
        ? snapshot.measuredAt
        : null
      : new Date(
          Date.parse(snapshot.measuredAt) +
            (remainingQuota / recentHourlyUsage) * HOUR_MS,
        ).toISOString();
  const risk: RiskLevel =
    usedRatio >= 1
      ? "exceeded"
      : projectedRatio >= 1
        ? "critical"
        : usedRatio >= 0.8 || projectedRatio >= 0.8
          ? "warning"
          : "normal";

  return {
    metric,
    used,
    quota,
    recentHourlyUsage,
    safeHourlyUsage,
    baselineHourlyUsage,
    burnRate,
    usedRatio,
    projectedUsage,
    projectedRatio,
    ...forecast,
    exhaustsAt,
    periodStart: period.start,
    periodEnd: period.end,
    risk,
    contributors: usage?.contributors ?? [],
    recentContributors: recent?.contributors ?? [],
  };
}

export function alertPolicyFor(
  config: DetectionConfig,
  metric: MetricName,
): AlertPolicy {
  return config.policies[metric] ?? "strict";
}

function buildStableForecast(
  metric: MetricName,
  snapshot: UsageSnapshot,
  period: { start: string; end: string },
  used: number,
): Pick<
  QuotaEvaluation,
  | "forecastHourlyUsage"
  | "forecastHourlySamples"
  | "forecastDailyUsage"
  | "forecastDailySamples"
  | "forecastProjectedUsage"
  | "forecastProjectedRatio"
> {
  const measuredAtMs = Date.parse(snapshot.measuredAt);
  const hourlyPoints =
    snapshot.hourlySeries.find((series) => series.name === metric)?.points ?? [];
  const recentHourlyUsage =
    snapshot.recentValues.find((value) => value.name === metric)?.value ?? 0;
  const dailyPoints =
    snapshot.dailySeries.find((series) => series.name === metric)?.points ?? [];
  const rates = calculateForecastRates({
    dailyPoints,
    hourlyPoints,
    measuredAt: snapshot.measuredAt,
    periodStart: period.start,
    recentHourlyUsage,
  });
  const forecastHourlyUsage = rates.hourlyUsage;
  const forecastDailyUsage = rates.dailyUsage;

  const periodEndMs = Date.parse(period.end);
  const nextUtcDayMs =
    Math.floor(measuredAtMs / DAY_MS) * DAY_MS + DAY_MS;
  const currentDayEndMs = Math.min(nextUtcDayMs, periodEndMs);
  const remainingCurrentDayHours = Math.max(
    0,
    (currentDayEndMs - measuredAtMs) / HOUR_MS,
  );
  const remainingFullDays = Math.max(
    0,
    (periodEndMs - currentDayEndMs) / DAY_MS,
  );
  const futureDailyUsage = sumTransitionalDailyForecast(
    forecastHourlyUsage,
    forecastDailyUsage,
    Math.floor(remainingFullDays),
  );
  const forecastProjectedUsage =
    used +
    (usesDailyPeakAverage(metric)
      ? futureDailyUsage
      : forecastHourlyUsage * remainingCurrentDayHours +
        futureDailyUsage);

  return {
    forecastHourlyUsage,
    forecastHourlySamples: rates.hourlySamples,
    forecastDailyUsage,
    forecastDailySamples: rates.dailySamples,
    forecastProjectedUsage,
    forecastProjectedRatio: forecastProjectedUsage / METRICS[metric].quota,
  };
}

function fullDaysAfterCurrentUtcDay(measuredAt: string, periodEnd: string): number {
  const measuredAtMs = Date.parse(measuredAt);
  const nextUtcDayMs =
    Math.floor(measuredAtMs / DAY_MS) * DAY_MS + DAY_MS;
  return Math.max(0, (Date.parse(periodEnd) - nextUtcDayMs) / DAY_MS);
}

function usesDailyPeakAverage(metric: MetricName): boolean {
  const definition = METRICS[metric];
  return (
    "usageModel" in definition &&
    definition.usageModel === "daily_peak_average_30d"
  );
}

function utcDay(value: string): { start: string; end: string } {
  const date = new Date(value);
  const start = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + 24 * HOUR_MS).toISOString(),
  };
}
