import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default defineConfig({
  ...viteConfig,
  test: {
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}", "cohan-restaurant-backend/tests/**/*.{test,spec}.{js,ts}"],
    environment: "node",
  },
});
