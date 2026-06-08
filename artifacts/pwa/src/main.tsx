import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeDb } from "./db/index";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`)
      .catch(() => {});
  });
}

initializeDb().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);
