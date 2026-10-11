import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so static hosting works on GitHub Pages project paths and other roots.
  base: "./",
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:4173" } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
