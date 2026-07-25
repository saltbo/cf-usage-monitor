import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import type { OverviewData } from "../../shared/dashboard";
import { loadOverview } from "./api";
import i18n from "../i18n";

interface DashboardContextValue {
  data: OverviewData | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);
const REFRESH_INTERVAL_MS = 5 * 60 * 1_000;

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  const request = useCallback(async (
    loader: (signal: AbortSignal) => Promise<OverviewData>,
  ) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setRefreshing(true);
    try {
      const next = await loader(controller.signal);
      setData(next);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : i18n.t("errors.usage"),
      );
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  const refresh = useCallback(() => request(loadOverview), [request]);
  useEffect(() => {
    if (pathname !== "/") {
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      activeRequest.current?.abort();
    };
  }, [pathname, refresh]);

  const value = useMemo(
    () => ({
      data,
      error,
      loading: data === null && error === null,
      refreshing,
      refresh,
    }),
    [data, error, refresh, refreshing],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (!value) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }
  return value;
}
