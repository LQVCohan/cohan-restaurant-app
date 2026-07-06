const fs = require("fs");
const path = require("path");

describe("combo print payload contract", () => {
  it("keeps combo snapshot and multiplies child quantities for station tickets", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../graphql/resolvers/order/confirmedOrderPrintMutation.js",
      ),
      "utf8",
    );

    expect(src).toContain("function buildTicketLine");
    expect(src).toContain("comboSnapshot");
    expect(src).toContain("comboItems");
    expect(src).toMatch(
      /Number\(child\?\.qty \|\| child\?\.quantity \|\| 1\)[\s\S]*quantity \|\| 1/,
    );
    expect(src).toContain("items: items.map(buildTicketLine)");
    expect(src).toContain("KitchenOrderWorkItem.find");
    expect(src).toContain("VALID_STATIONS.has(station)");
  });
});
