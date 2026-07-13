import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const read = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const modal = read(
  "src/components/Dashboard_Manager/POS/components/modals/SplitTableModal.jsx",
);
const dock = read(
  "src/components/Dashboard_Manager/POS/components/pos/TableOrderSplitDock.jsx",
);
const layout = read(
  "src/components/Dashboard_Manager/POS/components/pos/POSLayout.jsx",
);
const styles = read(
  "src/components/Dashboard_Manager/POS/components/modals/SplitTableModal.module.scss",
);

describe("POS standalone table order split UI", () => {
  it("exposes source, target and item selection steps", () => {
    expect(modal).toContain("Bàn cần tách");
    expect(modal).toContain("Bàn nhận món tách");
    expect(modal).toContain("Chọn món chuyển sang bàn mới");
    expect(modal).toContain("selectedItems");
    expect(modal).toContain("Đợt gọi món");
  });

  it("supports restoring the persisted split", () => {
    expect(modal).toContain("ACTIVE_TABLE_ORDER_SPLIT");
    expect(modal).toContain("REVERT_TABLE_ORDER_SPLIT");
    expect(modal).toContain("Gộp lại như cũ");
    expect(modal).toContain("canRevert");
  });

  it("mounts the action in the active POS table workspace", () => {
    expect(dock).toContain("Tách / gộp order");
    expect(dock).toContain("selectTableForOrder");
    expect(layout).toContain("TableOrderSplitDock");
    expect(styles).toContain(".revertCard");
    expect(styles).toContain(".orderList");
  });
});
