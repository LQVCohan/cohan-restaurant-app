import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚠️ Nếu bạn đổi sang link loca.lt khác, cập nhật biến này cho khớp

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // ❌ KHÔNG thêm alias thủ công cho @apollo/client
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
    host: true,
    port: 5173,
    allowedHosts: [
      "intersubjective-unenterprisingly-jemma.ngrok-free.dev",
      /.*\.ngrok(-free)?\.(app|dev)$/, // regex bao gồm cả .app và .dev
    ],
    origin: "https://intersubjective-unenterprisingly-jemma.ngrok-free.dev",
    hmr: {
      host: "intersubjective-unenterprisingly-jemma.ngrok-free.dev",
      protocol: "wss",
      clientPort: 443,
    },
  },

  optimizeDeps: {
    include: [
      "@fortawesome/fontawesome-svg-core",
      "@fortawesome/free-solid-svg-icons",
      "@fortawesome/react-fontawesome",
      "chart.js/auto",
      "@apollo/client", // 👉 thêm nếu gặp lỗi useMutation/useQuery
    ],
  },
});
