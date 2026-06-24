import { spawn } from "node:child_process";
import os from "node:os";

const PORT = process.env.VITE_DEV_PORT || "5173";

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
const allowedHosts = Array.from(new Set(["localhost", "127.0.0.1", primaryIp, ...localIps])).join(",");

console.log("\nCOHAN mobile dev server");
console.log("────────────────────────");
console.log(`Local:   http://localhost:${PORT}`);
localIps.forEach((ip) => console.log(`Phone:   http://${ip}:${PORT}`));
console.log("\nĐiện thoại và máy tính phải chung Wi-Fi.");
console.log("Lưu ý: xem 3D có thể test qua LAN HTTP, nhưng camera/AR WebXR thường cần HTTPS/secure context.");
console.log("Khi cần test AR thật, dùng HTTPS/tunnel và mở cùng URL trên điện thoại.\n");

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "--host", "0.0.0.0", "--port", PORT],
  {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      VITE_DEV_BIND_HOST: "0.0.0.0",
      VITE_DEV_HOST: primaryIp,
      VITE_DEV_ALLOWED_HOSTS: allowedHosts,
      VITE_DEV_ORIGIN: `http://${primaryIp}:${PORT}`,
      VITE_DEV_HMR_PROTOCOL: process.env.VITE_DEV_HMR_PROTOCOL || "ws",
      VITE_DEV_HMR_CLIENT_PORT: PORT,
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
