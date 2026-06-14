import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = [
  "src/components/Staff",
  "src/components/communication",
  "src/layouts",
];

const bannedTokens = [
  "#ff6600",
  "rgba(255, 102, 0",
  "#f59e0b",
  "#d97706",
  "#fef3c7",
  "#ff7a1a",
  "#8a623d",
  "#735032",
  "#eadccd",
  "#fbf7ef",
  "#f6efe4",
  "#fff9f0",
  "#fffaf2",
  "#fff1e3",
  "#c7631f",
  "#9f4516",
  "rgba(138, 98, 61",
  "rgba(125, 91, 56",
  "rgba(79, 55, 33",
  "rgba(199, 99, 31",
  "rgba(188, 116, 36",
  "$noti-orange",
  "$noti-green: #ff6600",
];

const targetFile = (filePath) => {
  if (filePath.startsWith("src/layouts/")) return /^Staff.*\.scss$/.test(filePath.split("/").pop() || "");
  return /\.(scss|jsx|js)$/.test(filePath);
};

const walk = (dir) => {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) results.push(...walk(fullPath));
    else if (targetFile(fullPath)) results.push(fullPath);
  }
  return results;
};

const hits = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const content = readFileSync(file, "utf8");
    const lowerContent = content.toLowerCase();
    for (const token of bannedTokens) {
      const needle = token.toLowerCase();
      if (lowerContent.includes(needle)) {
        hits.push(`${relative(process.cwd(), file)}: ${token}`);
      }
    }
  }
}

if (hits.length) {
  console.error("Staff theme color check failed. Banned tokens found:");
  for (const hit of hits) console.error(`- ${hit}`);
  process.exit(1);
}

console.log("Staff theme color check passed.");
