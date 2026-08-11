import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { CourierApp } from "./CourierApp";

document.documentElement.dataset.deliverhubApp = "courier-session-flow-v10";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CourierApp />
  </StrictMode>,
);
