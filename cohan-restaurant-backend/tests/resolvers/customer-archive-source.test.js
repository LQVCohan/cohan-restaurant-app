import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(here, "../../graphql/resolvers/user/customerArchive.js"),
  "utf8",
);

describe("restaurant-scoped customer archive", () => {
  it("moves restaurant membership without changing account status", () => {
    expect(source).toContain("$pull: { customerRestaurants: rid }");
    expect(source).not.toContain("$pull: { refRestaurants: rid }");
    expect(source).not.toContain("$addToSet: { refRestaurants: rid }");
    expect(source).toContain("archivedRestaurants");
    expect(source).not.toContain("status: \"inactive\"");
  });

  it("requires the explicit confirmation phrase", () => {
    expect(source).toContain("AN TOAN BO KHACH HANG");
    expect(source).toContain("Invalid confirmation text");
  });
});
