import { sendNotifications } from "../notifications";
import { runMonitor } from "./monitor";
import { loadAccountName } from "./resource-catalog";
import {
  evaluateWatchdog,
  recordMonitorFailure,
  recordMonitorSkip,
  recordMonitorSuccess,
} from "./watchdog";

/**
 * Runs one scheduled cycle.
 *
 * The monitor and the watchdog are deliberately decoupled. The monitor owns
 * quota collection and alerting; the watchdog only observes whether the
 * monitor completes a successful run. A monitor that throws is recorded as a
 * failure and the watchdog still gets a chance to report the stall, so a
 * broken monitor can never silence the alarm about itself.
 */
export async function runScheduled(
  scheduledTime: number,
  env: Env,
): Promise<void> {
  let monitorError: string | undefined;
  try {
    const outcome = await runMonitor(scheduledTime, env);
    if (outcome.collected) {
      await recordMonitorSuccess(env, scheduledTime);
      log("info", "monitor_succeeded", { scheduledTime });
    } else {
      // The window was already processed. This is not evidence that the
      // monitor is healthy, so the watchdog heartbeat stays untouched.
      await recordMonitorSkip(env, scheduledTime);
      log("info", "monitor_skipped", { scheduledTime });
    }
  } catch (error) {
    monitorError = error instanceof Error ? error.message : String(error);
    try {
      await recordMonitorFailure(env, scheduledTime, monitorError);
    } catch (recordError) {
      log("error", "watchdog_record_failed", {
        message:
          recordError instanceof Error
            ? recordError.message
            : String(recordError),
      });
    }
    log("error", "monitor_failed", { scheduledTime, message: monitorError });
  }

  try {
    const stall = await evaluateWatchdog({
      env,
      scheduledTime,
      accountName: await loadAccountNameSafely(env),
    });
    if (!stall) {
      return;
    }
    await sendNotifications(env, stall);
    log("info", "watchdog_reported_stall", {
      stalledForMinutes: stall.stalledForMinutes,
      lastSuccessAt: stall.lastSuccessAt,
    });
  } catch (error) {
    log("error", "watchdog_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadAccountNameSafely(env: Env): Promise<string> {
  try {
    return await loadAccountName(env);
  } catch {
    return env.CF_ACCOUNT_ID;
  }
}

function log(
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  console[level](JSON.stringify({ level, event, ...fields }));
}
