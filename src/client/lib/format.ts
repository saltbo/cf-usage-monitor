export function formatCompact(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatTimestamp(
  value: string,
  includeTimeZone = false,
): string {
  return new Intl.DateTimeFormat("zh-CN", {
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
  const formatter = new Intl.DateTimeFormat("zh-CN", {
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
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}

export function shortId(value: string): string {
  return value.length > 22
    ? `${value.slice(0, 10)}…${value.slice(-5)}`
    : value;
}
