export function billingCycleAt(
  now: number,
  renewalDay: number,
): { start: string; end: string } {
  if (!Number.isInteger(renewalDay) || renewalDay < 1 || renewalDay > 31) {
    throw new Error("BILLING_CYCLE_DAY must be an integer from 1 to 31");
  }
  const current = new Date(now);
  const thisMonth = anchor(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    renewalDay,
  );
  const start =
    now >= thisMonth
      ? thisMonth
      : anchor(
          current.getUTCFullYear(),
          current.getUTCMonth() - 1,
          renewalDay,
        );
  const startDate = new Date(start);
  const end = anchor(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth() + 1,
    renewalDay,
  );
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}

function anchor(year: number, month: number, day: number): number {
  const normalized = new Date(Date.UTC(year, month, 1));
  const days = new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      normalized.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  return Date.UTC(
    normalized.getUTCFullYear(),
    normalized.getUTCMonth(),
    Math.min(day, days),
  );
}
