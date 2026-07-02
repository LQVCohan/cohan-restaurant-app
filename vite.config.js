import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const aiKnowledgeNoticeMessageGuardPlugin = () => ({
  name: "ai-knowledge-notice-message-guard",
  enforce: "pre",
  transform(code, id) {
    const filePath = id.split("?")[0];
    const targetPath = path.join(
      "src",
      "components",
      "Dashboard_Manager",
      "Customer",
      "AiChatbotKnowledgePage.jsx",
    );
    if (!path.normalize(filePath).endsWith(targetPath)) return null;

    const unsafeSnippet = `      const actionMessage = await action();
      setNotice(actionMessage || successMessage);`;
    const safeSnippet = `      const actionMessage = await action();
      setNotice(
        typeof actionMessage === "string" && actionMessage.trim()
          ? actionMessage
          : successMessage,
      );`;

    if (!code.includes(unsafeSnippet)) return null;
    return {
      code: code.replace(unsafeSnippet, safeSnippet),
      map: null,
    };
  },
});

const staffPerformanceMonthRangeGuardPlugin = () => ({
  name: "staff-performance-month-range-guard",
  enforce: "pre",
  transform(code, id) {
    const filePath = id.split("?")[0];
    const targetPath = path.join("src", "components", "Dashboard_Manager", "Staff", "components", "Performance", "StaffPerformancePage.jsx");
    if (!path.normalize(filePath).endsWith(targetPath)) return null;
    if (code.includes("const getMonthRange =")) return null;

    const marker = "const ADJUSTMENT_TOLERANCE = 0.01;";
    const helper = [
      "const formatDateInputValue = (date) => {",
      "  const year = date.getFullYear();",
      "  const month = String(date.getMonth() + 1).padStart(2, \"0\");",
      "  const day = String(date.getDate()).padStart(2, \"0\");",
      "  return year + \"-\" + month + \"-\" + day;",
      "};",
      "",
      "const getMonthRange = (baseDate = new Date()) => {",
      "  const year = baseDate.getFullYear();",
      "  const month = baseDate.getMonth();",
      "  return {",
      "    periodStart: formatDateInputValue(new Date(year, month, 1)),",
      "    periodEnd: formatDateInputValue(new Date(year, month + 1, 0)),",
      "  };",
      "};",
      "",
    ].join("\n");

    if (!code.includes(marker)) return null;
    return {
      code: code.replace(marker, helper + marker),
      map: null,
    };
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Explicit process env from scripts/start-mobile-dev.mjs must win over .env files.
  const mergedEnv = { ...env, ...process.env };

  const devBindHost = mergedEnv.VITE_DEV_BIND_HOST || "127.0.0.1";
  const devHost = mergedEnv.VITE_DEV_HOST || "localhost";
  const devOrigin =
    mergedEnv.VITE_DEV_ORIGIN || `http://${devHost}:${mergedEnv.VITE_DEV_PORT || "5173"}`;
  const devPort = toNumber(mergedEnv.VITE_DEV_PORT, 5173);
  const devHmrProtocol = mergedEnv.VITE_DEV_HMR_PROTOCOL || "ws";
  const devHmrClientPort = toNumber(mergedEnv.VITE_DEV_HMR_CLIENT_PORT, devPort);
  const devBackendUrl =
    mergedEnv.VITE_DEV_BACKEND_URL ||
    `http://127.0.0.1:${mergedEnv.VITE_BACKEND_PORT || "4000"}`;
  const allowedHosts = (mergedEnv.VITE_DEV_ALLOWED_HOSTS || devHost)
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  return {
    plugins: [aiKnowledgeNoticeMessageGuardPlugin(), staffPerformanceMonthRangeGuardPlugin(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData:
            `@use "@/styles/_variables.scss" as *; ` +
            `@use "@/styles/_mixins.scss" as *; ` +
            `@use "@/styles/_tokens.scss" as *;`,
        },
      },
    },
    server: {
      host: devBindHost,
      port: devPort,
      allowedHosts,
      origin: devOrigin,
      hmr: {
        protocol: devHmrProtocol,
        host: devHost,
        port: devPort,
        clientPort: devHmrClientPort,
      },
      proxy: {
        "/graphql": {
          target: devBackendUrl,
          changeOrigin: true,
        },
        "/api": {
          target: devBackendUrl,
          changeOrigin: true,
        },
        "/uploads": {
          target: devBackendUrl,
          changeOrigin: true,
        },
        "/socket.io": {
          target: devBackendUrl,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
