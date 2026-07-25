import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { useDashboard } from "../data/dashboard-context";
import type { SupportedLanguage } from "../i18n";
import { relativeTime } from "../lib/format";

export function AppShell() {
  const { data, refresh, refreshing } = useDashboard();
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en";

  function changeLanguage(next: SupportedLanguage) {
    void i18n.changeLanguage(next);
  }

  return (
    <>
      <a className="skip-link" href="#main">
        {t("header.skip")}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span aria-hidden="true" className="brand-mark">
              <i />
              <i />
            </span>
            <span>
              <strong>CF Usage Monitor</strong>
              <small>{t("header.tagline")}</small>
            </span>
          </Link>
          <div className="header-meta">
            <span>{t("header.account", { name: data?.accountName ?? "—" })}</span>
            <span>
              {data
                ? t("header.updated", { time: relativeTime(data.lastUpdated) })
                : t("common.loading")}
            </span>
            <div
              aria-label={t("language.label")}
              className="language-switch"
              role="group"
            >
              <button
                aria-pressed={language === "zh-CN"}
                onClick={() => changeLanguage("zh-CN")}
                type="button"
              >
                中
              </button>
              <button
                aria-pressed={language === "en"}
                onClick={() => changeLanguage("en")}
                type="button"
              >
                EN
              </button>
            </div>
            <button
              disabled={refreshing}
              id="refresh-button"
              onClick={() => void refresh()}
              type="button"
            >
              {refreshing ? t("common.refreshing") : t("common.refresh")}
            </button>
          </div>
        </div>
      </header>
      <main className="page-shell" id="main">
        <Outlet />
        <footer>
          <span>
            {t("header.source", {
              source: data?.source ?? "Cloudflare GraphQL Analytics",
            })}
          </span>
          <span>{t("header.review")}</span>
        </footer>
      </main>
    </>
  );
}
