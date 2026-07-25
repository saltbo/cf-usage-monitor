import type { ProductCostData } from "../../shared/dashboard";
import {
  formatBillingThrough,
  formatCompact,
  formatCurrency,
} from "../lib/format";
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
  return (
    <section aria-labelledby="cost-title" className="cost-panel">
      <div className="section-heading cost-heading">
        <div>
          <p className="eyebrow">Cloudflare 已入账</p>
          <h2 id="cost-title">实际用量成本</h2>
        </div>
        <p>仅包含 usage-based 费用，不含固定套餐、税费和未出账费用</p>
      </div>
      <div aria-label="成本摘要" className="cost-summary">
        <CostStat
          label="本期实际费用"
          value={formatCurrency(cost.totalCost, cost.currency)}
        />
        <CostStat
          detail={`账单日 ${formatBillingThrough(cost.postedThrough)}`}
          label="最近一日费用"
          value={formatCurrency(cost.recentCost, cost.currency)}
        />
        <CostStat label="计费项" value={String(cost.lineItems.length)} />
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
        <div className="cost-empty">本计费周期尚未产生用量费用</div>
      )}
      <div className="cost-table-wrap">
        <table>
          <thead>
            <tr>
              <th>计费项</th>
              <th>总用量</th>
              <th>计费用量</th>
              <th>本期费用</th>
            </tr>
          </thead>
          <tbody>
            {cost.lineItems.map((item) => (
              <tr key={item.serviceName}>
                <td>{item.serviceName}</td>
                <td>
                  {formatCompact(item.consumedQuantity)}{" "}
                  {item.consumedUnit}
                </td>
                <td>
                  {formatCompact(item.pricingQuantity)}{" "}
                  {item.consumedUnit}
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
