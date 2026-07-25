import type { DashboardMetric } from "../../shared/dashboard";
import type { RiskLevel } from "../../detection";

export const RISK_LABEL: Record<RiskLevel, string> = {
  normal: "正常",
  warning: "需关注",
  critical: "高风险",
  exceeded: "已超额",
};

export function alertStatusLabel(
  status: DashboardMetric["alertStatus"],
): string | null {
  const labels: Partial<Record<DashboardMetric["alertStatus"], string>> = {
    track_only: "仅观察",
    active: "告警中",
    recovered: "已恢复",
    pending: "确认中",
  };
  return labels[status] ?? null;
}

export function metricSummary(metric: DashboardMetric): string {
  switch (metric.alertStatus) {
    case "track_only":
      return "仅观察：继续展示额度和预测，但不会发送额度告警。";
    case "active":
      return "告警中：持续提醒，消耗速度回到基础安全线以下后恢复。";
    case "recovered":
      return "本账期告警已恢复；历史超额仍保留展示。";
    case "pending":
      return "风险确认中：达到连续样本阈值后将发送告警。";
    default:
      break;
  }
  if (metric.risk === "exceeded") {
    return "本期用量已经超过包含额度，超额计费可能已经产生。";
  }
  if (metric.risk === "critical") {
    return "按当前消耗速度，预计将在本期结束前超过额度。";
  }
  if (metric.risk === "warning") {
    return "额度或期末预测已达到 80%，建议持续关注。";
  }
  return "按当前消耗速度预测，本期不会超过包含额度。";
}
