import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { PublicLanding } from "../../features/public/PublicLanding";

function PublicRoute({ page }: { page: "home" | "market" | "contact" | "courier" }) {
  const navigate = useNavigate();

  return (
    <PublicLanding
      onNavigateHome={() => navigate("/")}
      onNavigateMarket={() => navigate("/market")}
      onNavigateContact={() => navigate("/contact")}
      onNavigateCourier={() => navigate("/courier")}
      page={page}
    />
  );
}

export function PublicApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute page="home" />} />
        <Route path="/market" element={<PublicRoute page="market" />} />
        <Route path="/contact" element={<PublicRoute page="contact" />} />
        <Route path="/courier" element={<PublicRoute page="courier" />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default PublicApp;
