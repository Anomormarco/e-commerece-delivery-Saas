import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { StoreApp } from "./StoreApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreApp />
    </ErrorBoundary>
  </StrictMode>,
);
