import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import "./admin.css";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { AdminApp } from "./AdminApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </StrictMode>,
);
