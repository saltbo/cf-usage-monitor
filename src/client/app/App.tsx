import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "../components/AppShell";
import { OverviewPage } from "../pages/OverviewPage";
import { ProductPage } from "../pages/ProductPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="usage/:productName" element={<ProductPage />} />
        <Route
          path="usage/:productName/instances/:instanceId"
          element={<ProductPage />}
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
