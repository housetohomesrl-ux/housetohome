import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PortfolioPage from "./pages/PortfolioPage";
import DealDetailPage from "./pages/DealDetailPage";
import VendorsPage from "./pages/VendorsPage";
import ClientsPage from "./pages/ClientsPage";
import PriceListPage from "./pages/PriceListPage";
import RevenueFlipPage from "./pages/RevenueFlipPage";
import RevenueRistrutturazionePage from "./pages/RevenueRistrutturazionePage";

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
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/price-list/:scope" element={<PriceListPage />} />
          <Route path="/revenue/flip" element={<RevenueFlipPage />} />
          <Route path="/revenue/ristrutturazione" element={<RevenueRistrutturazionePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
