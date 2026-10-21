import { afterEach, describe, expect, it, vi } from "vitest";
import { runScheduled } from "../src/server/schedule";

const BASE_TIME = Date.parse("2026-10-20T12:00:00.000Z");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scheduled run", () => {
  it("reports a stall when the monitor keeps throwing", async () => {
    const state = fakeState();
    const notifications = await import("../src/notifications");
    const sent: Array<{ type: string }> = [];
    vi.spyOn(notifications, "sendNotifications").mockImplementation(
      async (_env, event) => {
        sent.push(event);
      },
    );

    const monitor = await import("../src/server/monitor");
    vi.spyOn(monitor, "runMonitor").mockImplementation(async () => {
      throw new Error("catalog exploded");
    });

    const env = scheduledEnv(state);

    // First cycle: the monitor fails for the first time.
    await runScheduled(BASE_TIME, env);
    expect(sent).toHaveLength(0);

    // Later cycles stay quiet until the stall threshold is reached.
    await runScheduled(BASE_TIME + 20 * 60_000, env);
    expect(sent).toHaveLength(0);

    await runScheduled(BASE_TIME + 40 * 60_000, env);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("cloudflare.monitor_stalled");
  });

  it("does not report a stall when the monitor succeeds", async () => {
    const state = fakeState();
    const notifications = await import("../src/notifications");
    const sent: Array<{ type: string }> = [];
    vi.spyOn(notifications, "sendNotifications").mockImplementation(
      async (_env, event) => {
        sent.push(event);
      },
    );

    const monitor = await import("../src/server/monitor");
    vi.spyOn(monitor, "runMonitor").mockResolvedValue({ collected: true });

    const env = scheduledEnv(state);

    await runScheduled(BASE_TIME, env);
    await runScheduled(BASE_TIME + 20 * 60_000, env);
    await runScheduled(BASE_TIME + 40 * 60_000, env);
    await runScheduled(BASE_TIME + 60 * 60_000, env);

    expect(sent).toHaveLength(0);
  });

  it("treats a skipped window as a stall rather than a success", async () => {
    const state = fakeState();
    const notifications = await import("../src/notifications");
    const sent: Array<{ type: string }> = [];
    vi.spyOn(notifications, "sendNotifications").mockImplementation(
      async (_env, event) => {
        sent.push(event);
      },
    );

    const monitor = await import("../src/server/monitor");
    // The window was already processed, so no collection happened. That must
    // not refresh the watchdog heartbeat, otherwise a monitor that stopped
    // collecting would look healthy forever.
    vi.spyOn(monitor, "runMonitor").mockResolvedValue({ collected: false });

    const env = scheduledEnv(state);

    await runScheduled(BASE_TIME, env);
    // Still inside the stall threshold.
    await runScheduled(BASE_TIME + 20 * 60_000, env);
    expect(sent).toHaveLength(0);

    // Past the threshold the skip is reported as a stall.
    await runScheduled(BASE_TIME + 40 * 60_000, env);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("cloudflare.monitor_stalled");
  });

  it("does not let a skipped window overwrite the last success heartbeat", async () => {
    const state = fakeState();
    const notifications = await import("../src/notifications");
    const sent: Array<{ type: string }> = [];
    vi.spyOn(notifications, "sendNotifications").mockImplementation(
      async (_env, event) => {
        sent.push(event);
      },
    );

    const monitor = await import("../src/server/monitor");
    const impl = vi
      .spyOn(monitor, "runMonitor")
      .mockResolvedValue({ collected: true });
    const env = scheduledEnv(state);

    await runScheduled(BASE_TIME, env);
    // A later run skips, which must not move the heartbeat forward.
    impl.mockResolvedValue({ collected: false });
    await runScheduled(BASE_TIME + 40 * 60_000, env);

    const stored = JSON.parse(state.values.get("monitor-watchdog-v1") ?? "{}");
    expect(stored.lastSuccessAt).toBe("2026-10-20T12:00:00.000Z");
  });

  it("still reports a stall when the monitor recovers and breaks again", async () => {
    const state = fakeState();
    const notifications = await import("../src/notifications");
    const sent: Array<{ type: string }> = [];
    vi.spyOn(notifications, "sendNotifications").mockImplementation(
      async (_env, event) => {
        sent.push(event);
      },
    );

    const monitor = await import("../src/server/monitor");
    const failing = vi
      .spyOn(monitor, "runMonitor")
      .mockImplementation(async () => {
        throw new Error("boom");
      });

    const env = scheduledEnv(state);

    await runScheduled(BASE_TIME, env);
    await runScheduled(BASE_TIME + 40 * 60_000, env);
    expect(sent).toHaveLength(1);

    // Monitor recovers.
    failing.mockResolvedValue({ collected: true });
    await runScheduled(BASE_TIME + 50 * 60_000, env);

    // Monitor breaks again: a fresh stall must be reported.
    failing.mockImplementation(async () => {
      throw new Error("boom again");
    });
    await runScheduled(BASE_TIME + 60 * 60_000, env);
    expect(sent).toHaveLength(1);

    await runScheduled(BASE_TIME + 100 * 60_000, env);
    expect(sent).toHaveLength(2);
    expect(sent[1].type).toBe("cloudflare.monitor_stalled");
  });
});

function scheduledEnv(state: ReturnType<typeof fakeState>): Env {
  return {
    STATE: state.namespace,
    CF_ACCOUNT_ID: "account-id",
    CF_API_TOKEN: "token",
    ALERT_WEBHOOK_URL: "https://api.day.app/device-key",
    ALERT_EMAIL_FROM: "alerts@example.com",
    ALERT_EMAIL_TO: "owner@example.com",
    DASHBOARD_PASSWORD: "password",
    ALERT_AFTER_SAMPLES: "2",
    RECOVERY_SAMPLES: "3",
    REMINDER_MINUTES: "60",
    WATCHDOG_STALE_AFTER_MINUTES: "30",
    WATCHDOG_REPEAT_MINUTES: "180",
  } as unknown as Env;
}

function fakeState(): {
  namespace: KVNamespace;
  put: ReturnType<typeof vi.fn>;
  values: Map<string, string>;
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
    values,
  };
}
