import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { CourierApp } from "./CourierApp";

document.documentElement.dataset.deliverhubApp = "courier-session-flow-v25";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <CourierApp />
    </ErrorBoundary>
  </StrictMode>,
);
