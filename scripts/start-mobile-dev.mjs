import { spawn } from "node:child_process";
import os from "node:os";

const PORT = process.env.VITE_DEV_PORT || "5173";
const BACKEND_PORT = process.env.VITE_BACKEND_PORT || "4000";
const NGROK_ALLOWED_HOSTS = [
  ".ngrok-free.dev",
  ".ngrok-free.app",
  ".ngrok.app",
];

const getLocalIPv4List = () => {
  const nets = os.networkInterfaces();
  const addresses = [];
  Object.values(nets).forEach((items = []) => {
    items.forEach((item) => {
      if (item.family === "IPv4" && !item.internal) {
        addresses.push(item.address);
      }
    });
  });
  return addresses;
};

const localIps = getLocalIPv4List();
const primaryIp = process.env.VITE_DEV_HOST || localIps[0] || "localhost";
const configuredAllowedHosts = String(
  process.env.VITE_DEV_ALLOWED_HOSTS || "",
)
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const allowedHosts = Array.from(
  new Set([
    "localhost",
    "127.0.0.1",
    primaryIp,
    ...localIps,
    ...NGROK_ALLOWED_HOSTS,
    ...configuredAllowedHosts,
  ]),
).join(",");
const viteArgs = ["vite", "--host", "0.0.0.0", "--port", PORT];
const isWindows = process.platform === "win32";
const windowsShell = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";

console.log("\nCOHAN mobile dev server");
console.log("────────────────────────");
console.log(`Local:   http://localhost:${PORT}`);
localIps.forEach((ip) => console.log(`Phone:   http://${ip}:${PORT}`));
console.log(`API:     /graphql (same origin) → http://127.0.0.1:${BACKEND_PORT}/graphql`);
console.log("\nĐiện thoại và máy tính phải chung Wi-Fi khi dùng địa chỉ Phone.");
console.log("Backend phải đang chạy trên máy tính trước khi mở trang trên điện thoại.");
console.log("HMR đã tắt để camera native không làm tải lại trang khi quay về trình duyệt.");
console.log("AR HTTPS: chạy `ngrok http 5173`; hostname ngrok được chấp nhận tự động.\n");

const child = spawn(
  isWindows ? windowsShell : "npx",
  isWindows ? ["/d", "/s", "/c", "npx", ...viteArgs] : viteArgs,
  {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      VITE_API_URL: "/graphql",
      VITE_DEV_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      VITE_DEV_BIND_HOST: "0.0.0.0",
      VITE_DEV_HOST: primaryIp,
      VITE_DEV_ALLOWED_HOSTS: allowedHosts,
      VITE_DEV_INFER_REQUEST_HOST: "true",
      VITE_DEV_HMR: "false",
    },
  },
);

child.on("error", (error) => {
  console.error(`Không thể khởi động Vite: ${error.message}`);
  console.error("Chạy tạm lệnh: npx vite --host 0.0.0.0 --port 5173");
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
