import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Disable SW + clear caches to avoid stale builds (fixes "No such app" from old cached API URL)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
}

if ("caches" in window) {
  caches
    .keys()
    .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
