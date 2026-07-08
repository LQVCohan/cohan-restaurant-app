import fs from "node:fs";

const path = "tests/e2e/smoke/graphqlMocks.js";
const source = fs.readFileSync(path, "utf8");
const search = `    case "GetRestaurants":
    case "ScopedRestaurants":`;
const replacement = `    case "GetRestaurants":
    case "AuthBusinessContext":
    case "ScopedRestaurants":`;

if (!source.includes(search)) {
  throw new Error("Auth business context smoke mock anchor no longer matches.");
}

fs.writeFileSync(path, source.replace(search, replacement));
fs.rmSync("scripts/apply-auth-business-context-smoke-mock.mjs");
fs.rmSync(".github/workflows/apply-auth-business-context-smoke-mock.yml");
console.log("Applied AuthBusinessContext smoke mock alias.");
