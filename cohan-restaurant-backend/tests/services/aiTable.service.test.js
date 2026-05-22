import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/aiTable.service.js";

const allowedTypes = ["standard", "booth", "vip", "outdoor", "bar", "private"];
const overlap = (a, b, gap = 0) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
const avgNearestDistance = (tables) => tables.reduce((sum, t, idx) => {
  let nearest = Infinity;
  tables.forEach((o, j) => { if (idx !== j) nearest = Math.min(nearest, Math.hypot(t.x - o.x, t.y - o.y)); });
  return sum + (Number.isFinite(nearest) ? nearest : 0);
}, 0) / Math.max(1, tables.length);

describe("aiTable.service layout engine v2", () => {
  it("main aisle is not blocked", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 12, vip: 2 }, objects: { door: 1, cashier: 1, kitchen: 1, plant: 2 } } }, 1);
    expect(out.meta.scoreBreakdown.aislePenalty).toBeLessThanOrEqual(20);
    const aisle = out.meta.zones.mainAisle;
    const tableRects = out.tables.map((t) => ({ x: t.x, y: t.y, w: t.type === "vip" ? 72 : 60, h: t.type === "vip" ? 72 : 60 }));
    expect(tableRects.some((r) => __testables.isInAisle(r, aisle))).toBe(false);
  });

  it("VIP stays in vip zone with vip goal", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "vip", components: { tables: { standard: 10, vip: 3 }, objects: { kitchen: 1, wc: 1 } } }, 3);
    const vip = out.tables.filter((t) => t.type === "vip");
    const std = out.tables.filter((t) => t.type !== "vip");
    const avgVipToStd = vip.reduce((s, v) => s + std.reduce((m, n) => Math.min(m, Math.hypot(v.x - n.x, v.y - n.y)), Infinity), 0) / Math.max(1, vip.length);
    expect(avgVipToStd).toBeGreaterThan(90);
    const kitchen = out.decor.find((d) => d.type === "kitchen");
    if (kitchen) expect(vip.every((v) => Math.hypot(v.x - kitchen.x, v.y - kitchen.y) > 140)).toBe(true);
  });

  it("cashier is near door and not blocking aisle", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 8 }, objects: { door: 1, cashier: 1 } } }, 2);
    const door = out.decor.find((d) => d.type === "door");
    const cashier = out.decor.find((d) => d.type === "cashier");
    expect(door && cashier).toBeTruthy();
    expect(Math.hypot(cashier.x - door.x, cashier.y - door.y)).toBeLessThan(260);
    expect(__testables.isInAisle(cashier, out.meta.zones.mainAisle)).toBe(false);
  });

  it("service objects stay out of main dining center", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 10 }, objects: { kitchen: 1, wc: 1, buffet: 1 } } }, 0);
    const center = out.meta.zones.mainDining;
    const centerRect = { x: center.x + center.w * 0.3, y: center.y + center.h * 0.3, w: center.w * 0.4, h: center.h * 0.4 };
    const services = out.decor.filter((d) => ["kitchen", "wc", "buffet"].includes(d.type));
    expect(services.some((d) => overlap(d, centerRect))).toBe(false);
    services.forEach((s) => out.tables.forEach((t) => expect(overlap(s, { x: t.x, y: t.y, w: t.type === "vip" ? 72 : 60, h: t.type === "vip" ? 72 : 60 })).toBe(false)));
  });

  it("spacious has larger nearest-table distance than capacity", () => {
    const payloadBase = { components: { tables: { standard: 12, fourSeat: 4, twoSeat: 2 }, objects: {} }, startX: 0, startY: 0 };
    const compact = __testables.generateRuleBasedLayout({ ...payloadBase, goal: "capacity" }, 0);
    const spacious = __testables.generateRuleBasedLayout({ ...payloadBase, goal: "spacious" }, 0);
    expect(avgNearestDistance(spacious.tables)).toBeGreaterThan(avgNearestDistance(compact.tables));
  });

  it("currentItems still respected", () => {
    const current = [{ x: 0, y: 0, w: 120, h: 120, isRealTable: false }];
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 5 }, objects: { plant: 1 } }, currentItems: current }, 0);
    const blocked = { x: 0, y: 0, w: 120, h: 120 };
    const allNew = [...out.tables.map((t) => ({ x: t.x, y: t.y, w: 60, h: 60 })), ...out.decor.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h }))];
    expect(allNew.some((r) => overlap(r, blocked))).toBe(false);
  });

  it("legacy payload still works", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", tableCount: 8, selectedComponents: ["wall", "plant", "door"] }, 1);
    expect(out.tables.length).toBe(8);
    expect(out.decor.some((d) => d.type === "wall")).toBe(true);
    expect(out.decor.some((d) => d.type === "plant")).toBe(true);
    expect(out.decor.some((d) => d.type === "door")).toBe(true);
  });

  it("output uses valid GraphQL table types", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { twoSeat: 2, fourSeat: 2, group: 2, vip: 2, standard: 1 }, objects: {} } }, 1);
    expect(out.tables.every((t) => allowedTypes.includes(t.type))).toBe(true);
  });
});
