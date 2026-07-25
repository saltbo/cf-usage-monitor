import type { DashboardMetric } from "../../shared/dashboard";
import type { RiskLevel } from "../../detection";
import i18n from "../i18n";

export function riskLabel(risk: RiskLevel): string {
  return i18n.t(`risk.label.${risk}`);
}

export function alertStatusLabel(
  status: DashboardMetric["alertStatus"],
): string | null {
  return status === "normal" ? null : i18n.t(`risk.alert.${status}`);
}

export function metricSummary(metric: DashboardMetric): string {
  switch (metric.alertStatus) {
    case "track_only":
      return i18n.t("risk.summary.track_only");
    case "active":
      return i18n.t("risk.summary.active");
    case "recovered":
      return i18n.t("risk.summary.recovered");
    case "pending":
      return i18n.t("risk.summary.pending");
    default:
      break;
  }
  if (metric.risk === "exceeded") {
    return i18n.t("risk.summary.exceeded");
  }
  if (metric.risk === "critical") {
    return i18n.t("risk.summary.critical");
  }
  if (metric.risk === "warning") {
    return i18n.t("risk.summary.warning");
  }
  return i18n.t("risk.summary.normal");
}
