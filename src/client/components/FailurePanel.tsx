import type { DashboardData } from "../../shared/dashboard";
import { useTranslation } from "react-i18next";

export function FailurePanel({
  failures,
}: {
  failures: DashboardData["failures"];
}) {
  const { t } = useTranslation();
  if (failures.length === 0) return null;
  return (
    <section className="failure-panel">
      <strong>{t("errors.partial")}</strong>
      <ul>
        {failures.map((failure) => (
          <li key={failure.collector}>
            <strong>{failure.collector}</strong> · {failure.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
