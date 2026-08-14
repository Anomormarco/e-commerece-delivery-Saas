import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { CustomerApp } from "./CustomerApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <CustomerApp />
    </ErrorBoundary>
  </StrictMode>,
);
