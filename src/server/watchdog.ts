const WATCHDOG_STATE_KEY = "monitor-watchdog-v1";
const DEFAULT_STALE_AFTER_MINUTES = 30;
const DEFAULT_REPEAT_MINUTES = 180;

export interface WatchdogEvent {
  schemaVersion: 2;
  type: "cloudflare.monitor_stalled";
  detectedAt: string;
  account: { id: string; name: string };
  lastSuccessAt: string | null;
  stalledForMinutes: number;
  lastError: string | null;
  staleAfterMinutes: number;
}

export interface WatchdogConfig {
  staleAfterMinutes: number;
  repeatMinutes: number;
}

/**
 * Persisted watchdog bookkeeping.
 *
 * `lastSuccessAt` is the heartbeat: the scheduled runner writes it only after
 * a monitor run completes without throwing. The watchdog therefore decides on
 * its own whether the monitor is alive, instead of trusting the monitor to
 * report its own failure.
 */
export interface WatchdogState {
  lastSuccessAt?: string;
  firstFailureAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  lastStallNotifiedAt?: string;
  notificationCount: number;
}

export interface WatchdogInput {
  env: Env;
  scheduledTime: number;
  accountName: string;
}

export function readWatchdogConfig(env: Env): WatchdogConfig {
  return {
    staleAfterMinutes: readPositiveInteger(
      env.WATCHDOG_STALE_AFTER_MINUTES,
      "WATCHDOG_STALE_AFTER_MINUTES",
      DEFAULT_STALE_AFTER_MINUTES,
    ),
    repeatMinutes: readPositiveInteger(
      env.WATCHDOG_REPEAT_MINUTES,
      "WATCHDOG_REPEAT_MINUTES",
      DEFAULT_REPEAT_MINUTES,
    ),
  };
}

export async function readWatchdogState(
  env: Env,
): Promise<WatchdogState> {
  const stored = await env.STATE.get<WatchdogState>(
    WATCHDOG_STATE_KEY,
    "json",
  );
  return {
    notificationCount: stored?.notificationCount ?? 0,
    lastSuccessAt: stored?.lastSuccessAt,
    firstFailureAt: stored?.firstFailureAt,
    lastFailureAt: stored?.lastFailureAt,
    lastError: stored?.lastError,
    lastStallNotifiedAt: stored?.lastStallNotifiedAt,
  };
}

/** Records a successful monitor run and clears any stall bookkeeping. */
export async function recordMonitorSuccess(
  env: Env,
  scheduledTime: number,
): Promise<void> {
  await env.STATE.put(
    WATCHDOG_STATE_KEY,
    JSON.stringify({
      lastSuccessAt: new Date(scheduledTime).toISOString(),
      notificationCount: 0,
    } satisfies WatchdogState),
  );
}

/** Records a failed monitor run without interrupting the caller. */
export async function recordMonitorFailure(
  env: Env,
  scheduledTime: number,
  message: string,
): Promise<void> {
  const state = await readWatchdogState(env);
  const now = new Date(scheduledTime).toISOString();
  await env.STATE.put(
    WATCHDOG_STATE_KEY,
    JSON.stringify({
      ...state,
      firstFailureAt: state.firstFailureAt ?? now,
      lastFailureAt: now,
      lastError: message,
    } satisfies WatchdogState),
  );
}

/**
 * Records a monitor run that completed without throwing but did not collect
 * a new window. Repeated skips mean the monitor is no longer making progress,
 * so they are tracked like failures for stall detection.
 */
export async function recordMonitorSkip(
  env: Env,
  scheduledTime: number,
): Promise<void> {
  const state = await readWatchdogState(env);
  const now = new Date(scheduledTime).toISOString();
  await env.STATE.put(
    WATCHDOG_STATE_KEY,
    JSON.stringify({
      ...state,
      firstFailureAt: state.firstFailureAt ?? now,
      lastFailureAt: now,
      lastError: state.lastError ?? "monitor skipped a window without collecting",
    } satisfies WatchdogState),
  );
}

/**
 * Emits a stall event when the monitor has not completed a successful run for
 * longer than the configured threshold.
 *
 * The stall is measured from the last successful run when one exists, and
 * from the first observed failure otherwise, so a monitor that has never
 * succeeded still reports itself.
 */
export async function evaluateWatchdog(
  input: WatchdogInput,
): Promise<WatchdogEvent | null> {
  const config = readWatchdogConfig(input.env);
  const state = await readWatchdogState(input.env);

  const referenceMs = resolveReferenceMs(state);
  if (referenceMs === null) {
    return null;
  }
  const stalledForMinutes = Math.max(
    0,
    Math.round((input.scheduledTime - referenceMs) / 60_000),
  );
  if (stalledForMinutes < config.staleAfterMinutes) {
    return null;
  }

  if (state.lastStallNotifiedAt) {
    const sinceNotification =
      input.scheduledTime - Date.parse(state.lastStallNotifiedAt);
    if (sinceNotification < config.repeatMinutes * 60 * 1_000) {
      return null;
    }
  }

  await input.env.STATE.put(
    WATCHDOG_STATE_KEY,
    JSON.stringify({
      ...state,
      lastStallNotifiedAt: new Date(input.scheduledTime).toISOString(),
      notificationCount: state.notificationCount + 1,
    } satisfies WatchdogState),
  );

  return {
    schemaVersion: 2,
    type: "cloudflare.monitor_stalled",
    detectedAt: new Date(input.scheduledTime).toISOString(),
    account: {
      id: input.env.CF_ACCOUNT_ID,
      name: input.accountName,
    },
    lastSuccessAt: state.lastSuccessAt ?? null,
    stalledForMinutes,
    lastError: state.lastError ?? null,
    staleAfterMinutes: config.staleAfterMinutes,
  };
}

function resolveReferenceMs(state: WatchdogState): number | null {
  const candidate = state.lastSuccessAt ?? state.firstFailureAt;
  if (!candidate) {
    return null;
  }
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : parsed;
}

function readPositiveInteger(
  value: unknown,
  name: string,
  fallback: number,
): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
