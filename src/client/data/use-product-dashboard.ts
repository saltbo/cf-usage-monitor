import { useEffect, useState } from "react";
import type { ProductName } from "../../metrics";
import type { ProductDashboardData } from "../../shared/dashboard";
import { loadProduct } from "./api";
import i18n from "../i18n";

export function useProductDashboard(
  productName: ProductName | null,
  refreshKey: string | undefined,
) {
  const [data, setData] = useState<ProductDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productName) {
      setData(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setData(null);
    setError(null);
    void loadProduct(productName, controller.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : i18n.t("errors.product"),
        );
      });
    return () => controller.abort();
  }, [productName, refreshKey]);

  return {
    data,
    error,
    loading: productName !== null && data === null && error === null,
  };
}
