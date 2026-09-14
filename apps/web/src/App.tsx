import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PortfolioPage from "./pages/PortfolioPage";
import DealDetailPage from "./pages/DealDetailPage";
import VendorsPage from "./pages/VendorsPage";
import PriceListPage from "./pages/PriceListPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<PortfolioPage />} />
          <Route path="/deals/:dealId" element={<DealDetailPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/price-list" element={<PriceListPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
