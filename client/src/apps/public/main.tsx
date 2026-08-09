import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { PublicApp } from "./PublicApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PublicApp />
  </StrictMode>,
);
