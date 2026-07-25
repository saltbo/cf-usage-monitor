import type { RiskLevel } from "../../detection";
import { useTranslation } from "react-i18next";
import { riskLabel } from "../lib/risk";

export function RiskBadge({
  risk,
  label,
}: {
  risk: RiskLevel;
  label?: string;
}) {
  useTranslation();
  return (
    <span className={`risk-chip risk-${risk}`}>
      {label ?? riskLabel(risk)}
    </span>
  );
}
