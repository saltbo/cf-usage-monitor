import type { ProductCostData } from "../../shared/dashboard";
import { useTranslation } from "react-i18next";
import {
  formatBillingThrough,
  formatCompact,
  formatCurrency,
} from "../lib/format";
import { formatUnit } from "../lib/localization";
import { CostChart } from "./CostChart";

export function CostPanel({
  cost,
  cycleEnd,
  cycleStart,
}: {
  cost: ProductCostData;
  cycleEnd: string;
  cycleStart: string;
}) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="cost-title" className="cost-panel">
      <div className="section-heading cost-heading">
        <div>
          <p className="eyebrow">{t("cost.eyebrow")}</p>
          <h2 id="cost-title">{t("cost.title")}</h2>
        </div>
        <p>{t("cost.disclaimer")}</p>
      </div>
      <div aria-label={t("cost.summary")} className="cost-summary">
        <CostStat
          label={t("cost.current")}
          value={formatCurrency(cost.totalCost, cost.currency)}
        />
        <CostStat
          detail={t("cost.billingDate", {
            date: formatBillingThrough(cost.postedThrough),
          })}
          label={t("cost.recent")}
          value={formatCurrency(cost.recentCost, cost.currency)}
        />
        <CostStat label={t("cost.items")} value={String(cost.lineItems.length)} />
      </div>
      {cost.totalCost > 0 ? (
        <CostChart
          currency={cost.currency}
          cycleEnd={cycleEnd}
          cycleStart={cycleStart}
          daily={cost.daily}
          postedThrough={cost.postedThrough}
        />
      ) : (
        <div className="cost-empty">{t("cost.empty")}</div>
      )}
      <div className="cost-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("cost.items")}</th>
              <th>{t("cost.totalUsage")}</th>
              <th>{t("cost.billedUsage")}</th>
              <th>{t("cost.currentCost")}</th>
            </tr>
          </thead>
          <tbody>
            {cost.lineItems.map((item) => (
              <tr key={item.serviceName}>
                <td>{item.serviceName}</td>
                <td>
                  {formatCompact(item.consumedQuantity)}{" "}
                  {formatUnit(item.consumedUnit)}
                </td>
                <td>
                  {formatCompact(item.pricingQuantity)}{" "}
                  {formatUnit(item.consumedUnit)}
                </td>
                <td>
                  <strong>
                    {formatCurrency(item.cost, cost.currency)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CostStat({
  detail,
  label,
  value,
}: {
  detail?: string;
  label: string;
  value: string;
}) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
      {detail ? <em>{detail}</em> : null}
    </span>
  );
}
