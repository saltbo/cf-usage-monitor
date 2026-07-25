import {
  METRICS,
  METRIC_NAMES,
  type MetricContributor,
  type MetricName,
  type UsageSnapshot,
} from "./metrics";

export const SAMPLE_INTERVAL_MINUTES = 10;
const HISTORY_LIMIT = 24 * 6;
const HOUR_MS = 60 * 60 * 1_000;

export type RiskLevel = "normal" | "warning" | "critical" | "exceeded";

export interface QuotaEvaluation {
  metric: MetricName;
  used: number;
  quota: number;
  recentHourlyUsage: number;
  safeHourlyUsage: number;
  burnRate: number | null;
  usedRatio: number;
  projectedUsage: number;
  projectedRatio: number;
  exhaustsAt: string | null;
  periodStart: string;
  periodEnd: string;
  risk: RiskLevel;
  contributors: MetricContributor[];
  recentContributors: MetricContributor[];
}

export interface MetricState {
  samples: Array<{
    windowEnd: string;
    used: number;
    recentHourlyUsage: number;
  }>;
  riskStreak: number;
  recoveryStreak: number;
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
  const evaluations = METRIC_NAMES.map((metric) =>
    evaluateMetric(metric, snapshot),
  );

  for (const evaluation of evaluations) {
    const metricState = state.metrics[evaluation.metric] ?? {
      samples: [],
      riskStreak: 0,
      recoveryStreak: 0,
    };
    metricState.samples = [
      ...metricState.samples,
      {
        windowEnd: snapshot.measuredAt,
        used: evaluation.used,
        recentHourlyUsage: evaluation.recentHourlyUsage,
      },
    ].slice(-HISTORY_LIMIT);
    state.metrics[evaluation.metric] = metricState;

    const atRisk =
      evaluation.risk === "critical" || evaluation.risk === "exceeded";
    metricState.riskStreak = atRisk ? metricState.riskStreak + 1 : 0;

    if (metricState.incident) {
      metricState.incident.worstProjectedRatio = Math.max(
        metricState.incident.worstProjectedRatio,
        evaluation.projectedRatio,
      );
      metricState.recoveryStreak = atRisk
        ? 0
        : metricState.recoveryStreak + 1;

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
        metricState.recoveryStreak = 0;
        continue;
      }

      const reminderDue =
        nowMs - Date.parse(metricState.incident.lastNotifiedAt) >=
        config.reminderMinutes * 60 * 1_000;
      if (atRisk && reminderDue) {
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
      evaluation.risk === "exceeded" ||
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
    alerts.push({
      ...evaluation,
      incidentStartedAt: snapshot.measuredAt,
      notificationCount: 1,
    });
  }

  state.latest = evaluations;
  return { state, alerts, recoveries };
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
  const remainingHours = Math.max(
    0,
    (Date.parse(period.end) - Date.parse(snapshot.measuredAt)) / HOUR_MS,
  );
  const remainingQuota = Math.max(0, quota - used);
  const safeHourlyUsage =
    remainingHours === 0 ? 0 : remainingQuota / remainingHours;
  const projectedUsage = used + recentHourlyUsage * remainingHours;
  const projectedRatio = projectedUsage / quota;
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
    burnRate,
    usedRatio,
    projectedUsage,
    projectedRatio,
    exhaustsAt,
    periodStart: period.start,
    periodEnd: period.end,
    risk,
    contributors: usage?.contributors ?? [],
    recentContributors: recent?.contributors ?? [],
  };
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
