import fs from "node:fs";
import path from "node:path";

const fixturePath = path.resolve("tests/fixtures/test-seed-data.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const requiredSections = ["accounts", "restaurants", "menus", "categories", "menuItems", "promotions"];
for (const section of requiredSections) {
  if (!Array.isArray(fixture[section]) || fixture[section].length === 0) {
    throw new Error(`Missing test fixture section: ${section}`);
  }
}

if (process.argv.includes("--reset-plan")) {
  console.log("reset:test-db is intentionally a documented dry-run for now.");
  console.log("Use a dedicated MongoDB test database, then apply tests/fixtures/test-seed-data.json with a project-specific importer.");
  process.exit(0);
}

console.log(`Validated test seed fixture: ${fixturePath}`);
console.log(`Accounts: ${fixture.accounts.map((account) => account.email).join(", ")}`);
console.log(`Restaurants: ${fixture.restaurants.length}; menu items: ${fixture.menuItems.length}; promotions: ${fixture.promotions.length}`);
console.log("No database writes were performed. See docs/TESTING_GUIDE.md before importing into a test database.");
