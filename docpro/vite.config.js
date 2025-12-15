import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: "./",        // ✅ IMPORTANT for Electron (file://) + packaged apps
  plugins: [react()],
});
