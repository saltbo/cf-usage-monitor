import type { RiskLevel } from "../../detection";
import { RISK_LABEL } from "../lib/risk";

export function RiskBadge({
  risk,
  label = RISK_LABEL[risk],
}: {
  risk: RiskLevel;
  label?: string;
}) {
  return <span className={`risk-chip risk-${risk}`}>{label}</span>;
}
