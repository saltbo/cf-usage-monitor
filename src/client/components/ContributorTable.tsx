import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { DashboardMetric } from "../../shared/dashboard";
import type { ProductName } from "../../metrics";
import { formatCompact, formatPercent, shortId } from "../lib/format";
import { formatUnit } from "../lib/localization";

export function ContributorTable({
  metric,
  productName,
}: {
  metric: DashboardMetric;
  productName: ProductName;
}) {
  const { t } = useTranslation();
  const unit = formatUnit(metric.unit);
  const recent = new Map(
    metric.recentContributors.map((contributor) => [
      contributor.id,
      contributor.value,
    ]),
  );
  const remainingHours = Math.max(
    0,
    (Date.parse(metric.periodEnd) - Date.now()) / 3_600_000,
  );

  return (
    <div className="contributors-table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("contributors.instance")}</th>
            <th>{t("contributors.currentUsage")}</th>
            <th>{t("contributors.share")}</th>
            <th>{t("contributors.recentHour")}</th>
            <th>{t("contributors.forecast")}</th>
          </tr>
        </thead>
        <tbody>
          {metric.contributors.length === 0 ? (
            <tr>
              <td className="empty-row" colSpan={5}>
                {t("contributors.empty")}
              </td>
            </tr>
          ) : (
            metric.contributors.map((contributor) => {
              const recentValue = recent.get(contributor.id) ?? 0;
              const share = metric.used === 0 ? 0 : contributor.value / metric.used;
              const projected = contributor.value + recentValue * remainingHours;
              return (
                <tr key={contributor.id}>
                  <td>
                    <Link
                      className="instance-link"
                      to={{
                        pathname: `/usage/${productName}/instances/${encodeURIComponent(contributor.id)}`,
                        search: `?metric=${encodeURIComponent(metric.metric)}`,
                      }}
                    >
                      <strong>{contributor.name}</strong>
                      <small>{shortId(contributor.id)}</small>
                    </Link>
                  </td>
                  <td>{formatCompact(contributor.value)} {unit}</td>
                  <td>
                    <span className="instance-share">
                      <i
                        style={{
                          "--share": `${Math.min(100, share * 100)}%`,
                        } as CSSProperties}
                      />
                      {formatPercent(share)}
                    </span>
                  </td>
                  <td>{formatCompact(recentValue)} {unit}</td>
                  <td>{formatCompact(projected)} {unit}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
