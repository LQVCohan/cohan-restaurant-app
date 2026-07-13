import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const read = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const resolver = read(
  "graphql/resolvers/order/tableOrderSplit.js",
);
const model = read(
  "models/table-order-split-session.model.js",
);
const schema = read("graphql/schema/base.graphql");
const orderIndex = read("graphql/resolvers/order/index.js");

describe("standalone table order split contract", () => {
  it("persists a reversible DB mapping for whole orders and partial items", () => {
    expect(model).toContain("wholeOrderMoves");
    expect(model).toContain("itemMoves");
    expect(model).toContain("sourceOrderSnapshots");
    expect(model).toContain("cleanupAt");
    expect(resolver).toContain("TableOrderSplitSession.create");
    expect(resolver).toContain("revertTableOrderSplit");
  });

  it("keeps separate order batches and remaps kitchen work items", () => {
    expect(resolver).toContain("ORDER_KIND.SPLIT_BILL");
    expect(resolver).toContain("originOrderId");
    expect(resolver).toContain("originParentOrderId");
    expect(resolver).toContain("KitchenOrderWorkItem.bulkWrite");
    expect(resolver).toContain("targetOrder.items[moveIndex]");
  });

  it("blocks unsafe split and revert conditions", () => {
    expect(resolver).toContain("TABLE_ORDER_SPLIT_MUST_KEEP_BOTH_TABLES");
    expect(resolver).toContain("TABLE_ORDER_SPLIT_TARGET_BUSY");
    expect(resolver).toContain("TABLE_ORDER_SPLIT_PAYMENT_LOCKED");
    expect(resolver).toContain("TABLE_ORDER_SPLIT_REVERT_TARGET_CHANGED");
    expect(resolver).toContain("TABLE_ORDER_SPLIT_REVERT_TARGET_BUSY");
  });

  it("registers GraphQL operations in the order resolver", () => {
    expect(schema).toContain("splitTableOrder(input: SplitTableOrderInput!)");
    expect(schema).toContain("revertTableOrderSplit");
    expect(schema).toContain("activeTableOrderSplit");
    expect(orderIndex).toContain("TableOrderSplitMutation");
    expect(orderIndex).toContain("TableOrderSplitQuery");
  });
});
