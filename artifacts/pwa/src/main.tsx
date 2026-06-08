import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeDb } from "./db/index";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`)
      .catch(() => {});
  });
} else if ("serviceWorker" in navigator) {
  // Unregister any stale service workers in dev mode
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister();
  });
}

initializeDb().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);
