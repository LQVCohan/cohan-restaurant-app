const fs = require("fs");
const path = require("path");

describe("combo print payload contract", () => {
  it("keeps combo snapshot and multiplies child quantities for print jobs", () => {
    const src = fs.readFileSync(path.join(__dirname, "../graphql/resolvers/order/mutation.js"), "utf8");
    expect(src).toContain("function buildPrintItemLine");
    expect(src).toContain("comboSnapshot");
    expect(src).toContain("comboItems");
    expect(src).toMatch(/Number\(child\?\.qty \|\| child\?\.quantity \|\| 1\)[\s\S]*quantity \|\| 1/);
    expect(src).toContain("items: (items || []).map(buildPrintItemLine)");
  });
});
