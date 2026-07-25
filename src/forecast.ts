export function calendarBucketValues(
  points: { timestamp: string; value: number }[],
  start: number,
  end: number,
  bucketMs: number,
): number[] {
  const values = new Map(
    points.map((point) => [Date.parse(point.timestamp), point.value]),
  );
  const buckets: number[] = [];
  for (let timestamp = start; timestamp < end; timestamp += bucketMs) {
    buckets.push(values.get(timestamp) ?? 0);
  }
  return buckets;
}

export function calculateForecastRates({
  dailyPoints,
  hourlyPoints,
  measuredAt,
  periodStart,
  recentHourlyUsage,
}: {
  dailyPoints: { timestamp: string; value: number }[];
  hourlyPoints: { timestamp: string; value: number }[];
  measuredAt: string;
  periodStart: string;
  recentHourlyUsage: number;
}): {
  dailySamples: number;
  dailyUsage: number;
  hourlySamples: number;
  hourlyUsage: number;
} {
  const hour = 3_600_000;
  const day = 24 * hour;
  const measuredAtMs = Date.parse(measuredAt);
  const periodStartMs = Date.parse(periodStart);
  const currentHourStart = Math.floor(measuredAtMs / hour) * hour;
  const completeHours = calendarBucketValues(
    hourlyPoints,
    Math.max(periodStartMs, currentHourStart - 6 * hour),
    currentHourStart,
    hour,
  );
  const hourlyUsage =
    completeHours.length > 0
      ? weightedAverage(completeHours)
      : recentHourlyUsage;
  const currentDayStart = Math.floor(measuredAtMs / day) * day;
  const completeDays = calendarBucketValues(
    dailyPoints,
    Math.max(periodStartMs, currentDayStart - 7 * day),
    currentDayStart,
    day,
  );
  const dailyUsage =
    completeDays.length >= 3 ? average(completeDays) : hourlyUsage * 24;

  return {
    dailySamples: completeDays.length,
    dailyUsage,
    hourlySamples: completeHours.length,
    hourlyUsage,
  };
}

export function transitionalDailyForecast(
  hourlyUsage: number,
  dailyUsage: number,
  futureDayIndex: number,
): number {
  const recentDailyRate = hourlyUsage * 24;
  const recentWeight = 0.5 ** futureDayIndex;
  return dailyUsage + (recentDailyRate - dailyUsage) * recentWeight;
}

export function sumTransitionalDailyForecast(
  hourlyUsage: number,
  dailyUsage: number,
  futureDays: number,
): number {
  let total = 0;
  for (let index = 0; index < futureDays; index += 1) {
    total += transitionalDailyForecast(hourlyUsage, dailyUsage, index);
  }
  return total;
}

export function shortTermUsageForecast({
  anchorTimestamp,
  bucketMs,
  current,
  forecastCount,
  points,
}: {
  anchorTimestamp: string;
  bucketMs: number;
  current?: {
    progress: number;
    value: number;
  };
  forecastCount: number;
  points: { timestamp: string; value: number }[];
}): {
  currentEstimate: number | null;
  values: number[];
} {
  const values = new Map(
    points.map((point) => [Date.parse(point.timestamp), point.value]),
  );
  const anchor = Date.parse(anchorTimestamp);
  const samples = Array.from(
    { length: 5 },
    (_, index) => values.get(anchor - (4 - index) * bucketMs) ?? 0,
  );
  const lastComplete = samples.at(-1) ?? 0;
  const currentEstimate = current
    ? estimateCurrentUnit(lastComplete, current)
    : null;
  const observations =
    currentEstimate === null ? samples : [...samples, currentEstimate];
  const recentWindow = observations.slice(-5);
  const previousLevel = median(recentWindow.slice(0, 3));
  const recentLevel = average(recentWindow.slice(-2));
  const levelRatio =
    previousLevel > 0
      ? recentLevel / previousLevel
      : recentLevel > 0
        ? Number.POSITIVE_INFINITY
        : 1;
  const regimeChanged = levelRatio <= 0.5 || levelRatio >= 2;
  const localValues = regimeChanged
    ? observations.slice(-2)
    : observations.slice(-3);
  const level = localValues.at(-1) ?? 0;
  const differences = localValues
    .slice(1)
    .map((value, index) => value - localValues[index]);
  const rawTrend = median(differences);
  const trendLimit = level * 0.25;
  let trend = Math.max(-trendLimit, Math.min(trendLimit, rawTrend));
  let forecast = level;
  const forecasts: number[] = [];

  for (let index = 0; index < forecastCount; index += 1) {
    forecast = Math.max(0, forecast + trend);
    forecasts.push(forecast);
    trend *= 0.65;
  }

  return {
    currentEstimate,
    values: forecasts,
  };
}

function estimateCurrentUnit(
  lastComplete: number,
  current: {
    progress: number;
    value: number;
  },
): number {
  const progress = Math.min(1, Math.max(0, current.progress));
  if (progress === 0) {
    return lastComplete;
  }
  const runRateEstimate = current.value / progress;
  const confidence = Math.min(1, progress / 0.3);
  return Math.max(
    current.value,
    lastComplete * (1 - confidence) + runRateEstimate * confidence,
  );
}

function weightedAverage(values: number[]): number {
  const weightedTotal = values.reduce(
    (total, value, index) => total + value * (index + 1),
    0,
  );
  const weightTotal = values.reduce((total, _, index) => total + index + 1, 0);
  return weightedTotal / weightTotal;
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
