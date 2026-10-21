import { afterEach, describe, expect, it, vi } from "vitest";
import {
  evaluateWatchdog,
  readWatchdogConfig,
  recordMonitorFailure,
  recordMonitorSuccess,
} from "../src/server/watchdog";

const BASE_TIME = Date.parse("2026-10-20T12:00:00.000Z");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("monitor watchdog", () => {
  it("stays quiet while the monitor keeps succeeding", async () => {
    const state = fakeState();
    const env = watchdogEnv(state);

    await recordMonitorSuccess(env, BASE_TIME);
    const event = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 10 * 60_000,
      accountName: "Example Account",
    });

    expect(event).toBeNull();
  });

  it("reports a stall once the monitor has been silent past the threshold", async () => {
    const state = fakeState();
    const env = watchdogEnv(state);

    await recordMonitorSuccess(env, BASE_TIME);
    // 10 minutes later the monitor is still failing.
    await recordMonitorFailure(env, BASE_TIME + 10 * 60_000, "boom");

    const event = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 40 * 60_000,
      accountName: "Example Account",
    });

    expect(event).not.toBeNull();
    expect(event?.type).toBe("cloudflare.monitor_stalled");
    expect(event?.lastSuccessAt).toBe("2026-10-20T12:00:00.000Z");
    expect(event?.stalledForMinutes).toBe(40);
    expect(event?.lastError).toBe("boom");
    expect(event?.account.name).toBe("Example Account");
  });

  it("stays quiet before the threshold elapses", async () => {
    const state = fakeState();
    const env = watchdogEnv(state);

    await recordMonitorSuccess(env, BASE_TIME);
    await recordMonitorFailure(env, BASE_TIME + 10 * 60_000, "boom");

    const event = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 20 * 60_000,
      accountName: "Example Account",
    });

    expect(event).toBeNull();
  });

  it("does not repeat the stall notification inside the repeat window", async () => {
    const state = fakeState();
    const env = watchdogEnv(state);

    await recordMonitorSuccess(env, BASE_TIME);
    await recordMonitorFailure(env, BASE_TIME + 10 * 60_000, "boom");

    const first = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 40 * 60_000,
      accountName: "Example Account",
    });
    expect(first).not.toBeNull();

    // Well inside the 180 minute repeat window.
    const second = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 60 * 60_000,
      accountName: "Example Account",
    });
    expect(second).toBeNull();

    // Past the repeat window it reports again.
    const third = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 40 * 60_000 + 180 * 60_000,
      accountName: "Example Account",
    });
    expect(third).not.toBeNull();
  });

  it("clears the stall after the monitor recovers", async () => {
    const state = fakeState();
    const env = watchdogEnv(state);

    await recordMonitorSuccess(env, BASE_TIME);
    await recordMonitorFailure(env, BASE_TIME + 10 * 60_000, "boom");
    const stall = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 40 * 60_000,
      accountName: "Example Account",
    });
    expect(stall).not.toBeNull();

    // The monitor recovers.
    await recordMonitorSuccess(env, BASE_TIME + 50 * 60_000);

    // A later failure starts a fresh stall window instead of staying silent
    // because of the earlier notification.
    await recordMonitorFailure(env, BASE_TIME + 60 * 60_000, "boom again");
    const early = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 70 * 60_000,
      accountName: "Example Account",
    });
    expect(early).toBeNull();
  });

  it("reports a stall even when the monitor never succeeded", async () => {
    const state = fakeState();
    const env = watchdogEnv(state);

    await recordMonitorFailure(env, BASE_TIME, "first failure");

    const event = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME + 40 * 60_000,
      accountName: "Example Account",
    });

    expect(event).not.toBeNull();
    expect(event?.lastSuccessAt).toBeNull();
    expect(event?.stalledForMinutes).toBe(40);
    expect(event?.lastError).toBe("first failure");
  });

  it("stays quiet before any monitor result is recorded", async () => {
    const state = fakeState();
    const env = watchdogEnv(state);

    const event = await evaluateWatchdog({
      env,
      scheduledTime: BASE_TIME,
      accountName: "Example Account",
    });

    expect(event).toBeNull();
  });
});

describe("watchdog configuration", () => {
  it("uses documented defaults when the vars are absent", () => {
    const env = {
      CF_ACCOUNT_ID: "account-id",
    } as unknown as Env;
    expect(readWatchdogConfig(env)).toEqual({
      staleAfterMinutes: 30,
      repeatMinutes: 180,
    });
  });

  it("honours configured thresholds", () => {
    const env = {
      CF_ACCOUNT_ID: "account-id",
      WATCHDOG_STALE_AFTER_MINUTES: "45",
      WATCHDOG_REPEAT_MINUTES: "60",
    } as unknown as Env;
    expect(readWatchdogConfig(env)).toEqual({
      staleAfterMinutes: 45,
      repeatMinutes: 60,
    });
  });

  it("rejects invalid thresholds", () => {
    const env = {
      CF_ACCOUNT_ID: "account-id",
      WATCHDOG_STALE_AFTER_MINUTES: "0",
    } as unknown as Env;
    expect(() => readWatchdogConfig(env)).toThrow(
      "WATCHDOG_STALE_AFTER_MINUTES must be a positive integer",
    );
  });
});

function watchdogEnv(state: ReturnType<typeof fakeState>): Env {
  return {
    STATE: state.namespace,
    CF_ACCOUNT_ID: "account-id",
    WATCHDOG_STALE_AFTER_MINUTES: "30",
    WATCHDOG_REPEAT_MINUTES: "180",
  } as unknown as Env;
}

function fakeState(): {
  namespace: KVNamespace;
  put: ReturnType<typeof vi.fn>;
} {
  const values = new Map<string, string>();
  const put = vi.fn(async (key: string, value: string) => {
    values.set(key, value);
  });
  return {
    namespace: {
      get: vi.fn(async (key: string, type?: string) => {
        const value = values.get(key);
        if (value === undefined) {
          return null;
        }
        return type === "json" ? JSON.parse(value) : value;
      }),
      put,
    } as unknown as KVNamespace,
    put,
  };
}
