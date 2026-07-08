import fs from "node:fs";

const files = [
  "tests/e2e/smoke/ai-handoff-features.spec.js",
  "tests/e2e/smoke/manager-payroll.spec.js",
];

for (const path of files) {
  const source = fs.readFileSync(path, "utf8");
  const search = `    case "GetRestaurants":\n    case "ScopedRestaurants":`;
  const indentedSearch = `      case "GetRestaurants":\n      case "ScopedRestaurants":`;

  if (source.includes(search)) {
    fs.writeFileSync(
      path,
      source.replace(
        search,
        `    case "GetRestaurants":\n    case "AuthBusinessContext":\n    case "ScopedRestaurants":`,
      ),
    );
    continue;
  }

  if (source.includes(indentedSearch)) {
    fs.writeFileSync(
      path,
      source.replace(
        indentedSearch,
        `      case "GetRestaurants":\n      case "AuthBusinessContext":\n      case "ScopedRestaurants":`,
      ),
    );
    continue;
  }

  throw new Error(`AuthBusinessContext anchor no longer matches ${path}`);
}

fs.rmSync("scripts/apply-manager-smoke-auth-context.mjs");
fs.rmSync(".github/workflows/apply-manager-smoke-auth-context.yml");
console.log("Applied manager AuthBusinessContext smoke aliases.");
