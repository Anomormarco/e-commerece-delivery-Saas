import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { StoreApp } from "./StoreApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreApp />
  </StrictMode>,
);
