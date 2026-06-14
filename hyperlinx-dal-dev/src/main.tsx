import React from "react";
import { createRoot } from "react-dom/client";
import DALApp from "./dal/DALApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DALApp />
  </React.StrictMode>
);
