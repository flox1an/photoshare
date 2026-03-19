import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Disable Node.js 25+ experimental Web Storage API so jsdom's
    // localStorage implementation (which supports .clear()) is used instead.
    // Node's --experimental-webstorage provides a global `localStorage` that
    // overwrites jsdom's and is missing .clear() without --localstorage-file.
    execArgv: ["--no-experimental-webstorage"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
