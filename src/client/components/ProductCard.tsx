import { Link } from "react-router";
import type { OverviewProduct } from "../../shared/dashboard";
import { alertStatusLabel } from "../lib/risk";
import { formatCurrency, formatPercent } from "../lib/format";
import { QuotaMeter } from "./QuotaMeter";
import { RiskBadge } from "./RiskBadge";

export function ProductCard({ product }: { product: OverviewProduct }) {
  return (
    <Link className="product-card" to={`/usage/${product.name}`}>
      <span className="product-identity">
        <strong>{product.label}</strong>
        <small>{product.description}</small>
        <span className="product-cost">
          <small>本期实际费用</small>
          <b>
            {formatCurrency(product.cost.totalCost, product.cost.currency)}
          </b>
        </span>
      </span>
      <span className="product-metrics">
        {product.metrics.map((metric) => {
          const status = alertStatusLabel(metric.alertStatus);
          return (
            <div className="quota-row" key={metric.metric}>
              <span className="quota-label">
                {metric.label}
                {status ? (
                  <small className={metric.alertStatus}>{status}</small>
                ) : null}
              </span>
              <QuotaMeter metric={metric} showForecast />
              <span className="quota-numbers">
                <b>{formatPercent(metric.usedRatio)}</b>
              </span>
            </div>
          );
        })}
      </span>
      <span className="product-action">
        <RiskBadge risk={product.risk} />
        <span aria-hidden="true" className="arrow">
          →
        </span>
      </span>
    </Link>
  );
}
