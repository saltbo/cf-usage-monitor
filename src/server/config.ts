import {
  type AlertPolicy,
  type DetectionConfig,
} from "../detection";
import { METRIC_NAMES, type MetricName } from "../metrics";

export function readDetectionConfig(env: Env): DetectionConfig {
  return {
    alertAfterSamples: readPositiveInteger(
      env.ALERT_AFTER_SAMPLES,
      "ALERT_AFTER_SAMPLES",
    ),
    recoverySamples: readPositiveInteger(
      env.RECOVERY_SAMPLES,
      "RECOVERY_SAMPLES",
    ),
    reminderMinutes: readPositiveInteger(
      env.REMINDER_MINUTES,
      "REMINDER_MINUTES",
    ),
    policies: readAlertPolicies(env.USAGE_ALERT_POLICIES),
  };
}

function readAlertPolicies(
  value: unknown,
): Partial<Record<MetricName, AlertPolicy>> {
  const source = asRecord(value, "USAGE_ALERT_POLICIES");
  return Object.fromEntries(
    Object.entries(source).map(([metric, policy]) => {
      if (!METRIC_NAMES.includes(metric as MetricName)) {
        throw new Error(
          `USAGE_ALERT_POLICIES.${metric} is not a supported metric`,
        );
      }
      if (policy !== "strict" && policy !== "track_only") {
        throw new Error(
          `USAGE_ALERT_POLICIES.${metric} must be strict or track_only`,
        );
      }
      return [metric, policy];
    }),
  );
}

function readPositiveInteger(value: unknown, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}
