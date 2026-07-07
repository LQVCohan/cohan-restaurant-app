import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.resolve(here, relative), "utf8");

describe("refRestaurants recent-history contract", () => {
  it("archive keeps refRestaurants and uses customerRestaurants for operational membership", () => {
    const source = read("../../graphql/resolvers/user/customerArchive.js");
    expect(source).toContain("customerRestaurants: rid");
    expect(source).not.toContain("$pull: { refRestaurants");
    expect(source).not.toContain("$addToSet: { refRestaurants");
  });

  it("customer list uses customerRestaurants instead of refRestaurants", () => {
    const source = read("../../graphql/resolvers/user/query.js");
    expect(source).toContain("customerRestaurants: { $in:");
    expect(source).not.toMatch(/const restaurantScopeCond = \{ refRestaurants/);
  });

  it("notification reviewer lookup does not route by refRestaurants", () => {
    const source = read("../../src/services/notification/notificationWorkflow.service.js");
    expect(source).toContain("BrandMembership.find");
    expect(source).not.toContain("refRestaurants");
  });

  it("migration defaults to dry-run safe mode in documented usage", () => {
    const source = read("../../scripts/migration/normalizeRefRestaurantsRecentHistory.js");
    expect(source).toContain("--dry-run");
    expect(source).toContain("dryRun");
  });
});
