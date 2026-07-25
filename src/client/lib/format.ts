import i18n from "../i18n";

function locale(): string {
  return i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en-US";
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(locale(), {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat(locale(), {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(value: number, currency: string): string {
  const fractionDigits = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
  return new Intl.NumberFormat(locale(), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale(), {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatBillingThrough(value: string): string {
  return formatDate(new Date(Date.parse(value) - 1).toISOString());
}

export function formatTimestamp(
  value: string,
  includeTimeZone = false,
): string {
  return new Intl.DateTimeFormat(locale(), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: includeTimeZone ? "short" : undefined,
  }).format(new Date(value));
}

export function localTimeZoneLabel(value: string): string {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat(locale(), {
    timeZoneName: "short",
  });
  const timeZone = formatter.resolvedOptions().timeZone;
  const shortName = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return shortName && shortName !== timeZone
    ? `${timeZone} (${shortName})`
    : timeZone;
}

export function relativeTime(value: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(value)) / 60_000));
  const formatter = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  if (minutes < 1) return formatter.format(0, "second");
  if (minutes < 60) return formatter.format(-minutes, "minute");
  return formatter.format(-Math.floor(minutes / 60), "hour");
}

export function formatRatio(value: number): string {
  return `${new Intl.NumberFormat(locale(), {
    maximumFractionDigits: 1,
  }).format(value)}×`;
}

export function shortId(value: string): string {
  return value.length > 22
    ? `${value.slice(0, 10)}…${value.slice(-5)}`
    : value;
}
