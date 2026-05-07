import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isValidOffPremiseSessionForType } from "../../../../../context/PosContext";

const rightPanelPath = path.resolve(
  process.cwd(),
  "src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx",
);

describe("POS off-premise hotfix regression guards", () => {
  it("RightPanel has no direct clearDraft references", () => {
    const source = fs.readFileSync(rightPanelPath, "utf8");
    expect(source.includes("clearDraft(")).toBe(false);
    expect(source.includes("clearDraft?.(")).toBe(false);
  });

  it("RightPanel saveDisabled no longer blocks on missing off-premise code", () => {
    const source = fs.readFileSync(rightPanelPath, "utf8");
    expect(source.includes("(isOffPremise && !currentOrderCode)")).toBe(false);
    expect(source).toMatch(/const saveDisabled = saving \|\| !hasItems \|\| newItems\.length === 0;/);
  });

  it("session guard rejects stale TAKE code for delivery", () => {
    const valid = isValidOffPremiseSessionForType({
      type: "delivery",
      currentOrderType: "delivery",
      currentTable: { isVirtual: true, type: "delivery" },
      currentOrderCode: "TAKE-20260507-000001",
    });
    expect(valid).toBe(false);
  });

  it("session guard rejects stale SHIP code for takeaway", () => {
    const valid = isValidOffPremiseSessionForType({
      type: "takeaway",
      currentOrderType: "takeaway",
      currentTable: { isVirtual: true, type: "takeaway" },
      currentOrderCode: "SHIP-20260507-000001",
    });
    expect(valid).toBe(false);
  });

  it("session guard accepts matching virtual session", () => {
    const valid = isValidOffPremiseSessionForType({
      type: "delivery",
      currentOrderType: "delivery",
      currentTable: { isVirtual: true, type: "delivery" },
      currentOrderCode: "SHIP-20260507-000001",
    });
    expect(valid).toBe(true);
  });
});
