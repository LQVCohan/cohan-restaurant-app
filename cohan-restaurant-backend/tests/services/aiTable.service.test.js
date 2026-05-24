import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/aiTable.service.js";

const allowedTypes = ["standard", "booth", "vip", "outdoor", "bar", "private"];
const overlap = (a, b, gap = 0) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
const avgNearestDistance = (tables) => tables.reduce((sum, t, idx) => {
  let nearest = Infinity;
  tables.forEach((o, j) => { if (idx !== j) nearest = Math.min(nearest, Math.hypot(t.x - o.x, t.y - o.y)); });
  return sum + (Number.isFinite(nearest) ? nearest : 0);
}, 0) / Math.max(1, tables.length);

describe("aiTable.service layout engine v3", () => {
  it("compact small restaurant room is not oversized", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 8, vip: 0, group: 0 }, objects: { door: 1, window: 2, cashier: 1, kitchen: 1, wc: 1, plant: 2, wall: 4 } } }, 0);
    expect(out.tables.length).toBe(8);
    const room = out.meta.zones.roomBounds;
    expect(room.w).toBeLessThanOrEqual(760);
    expect(room.h).toBeLessThanOrEqual(560);
    out.decor.forEach((d) => {
      if (d.type === "wall" || d.type === "door" || d.type === "window") return;
      expect(d.x).toBeGreaterThanOrEqual(room.x);
      expect(d.y).toBeGreaterThanOrEqual(room.y);
      expect(d.x + d.w).toBeLessThanOrEqual(room.x + room.w);
      expect(d.y + d.h).toBeLessThanOrEqual(room.y + room.h);
    });
  });
  it("standard eight tables form two balanced clusters", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 8 }, objects: { door: 1, window: 2, cashier: 1, kitchen: 1, wc: 1, plant: 2, wall: 4 } } }, 0);
    const aisle = out.meta.zones.mainAisle;
    const left = out.tables.filter((t) => t.x + 30 < aisle.x).length;
    const right = out.tables.length - left;
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    expect(left).toBeGreaterThanOrEqual(3);
    expect(right).toBeGreaterThanOrEqual(3);
    expect(out.tables.some((t) => __testables.isInAisle({ ...t, w: 60, h: 60 }, aisle))).toBe(false);
  });
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
  it("cashier stays inside and supports entrance flow", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 8 }, objects: { door: 1, cashier: 1 } } }, 0);
    const room = out.meta.zones.roomBounds;
    const door = out.decor.find((d) => d.type === "door");
    const cashier = out.decor.find((d) => d.type === "cashier");
    expect(door && cashier).toBeTruthy();
    expect(cashier.x).toBeGreaterThanOrEqual(room.x + 20);
    expect(cashier.y).toBeGreaterThanOrEqual(room.y + 20);
    expect(cashier.x + cashier.w).toBeLessThanOrEqual(room.x + room.w - 20);
    expect(cashier.y + cashier.h).toBeLessThanOrEqual(room.y + room.h - 20);
    expect(Math.hypot(cashier.x - door.x, cashier.y - door.y)).toBeLessThan(220);
    expect(__testables.isInAisle(cashier, out.meta.zones.mainAisle)).toBe(false);
  });
  it("door and windows align to room edge", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 6 }, objects: { door: 1, window: 3, wall: 4 } } }, 4);
    const room = out.meta.zones.roomBounds;
    const nearEdge = (r) => {
      const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
      return Math.min(Math.abs(cx - room.x), Math.abs(cx - (room.x + room.w)), Math.abs(cy - room.y), Math.abs(cy - (room.y + room.h))) < 20;
    };
    const door = out.decor.find((d) => d.type === "door");
    const windows = out.decor.filter((d) => d.type === "window");
    expect(nearEdge(door)).toBe(true);
    expect(windows.every((w) => nearEdge(w))).toBe(true);
  });
  it("door and windows may overlap wall without wall overlap penalty", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "balanced",
      components: { tables: { standard: 6 }, objects: { wall: 4, door: 1, window: 2 } },
    }, 4);
    const room = out.meta.zones.roomBounds;
    const nearEdge = (r) => {
      const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
      return Math.min(Math.abs(cx - room.x), Math.abs(cx - (room.x + room.w)), Math.abs(cy - room.y), Math.abs(cy - (room.y + room.h))) < 20;
    };
    const door = out.decor.find((d) => d.type === "door");
    const windows = out.decor.filter((d) => d.type === "window");
    expect(nearEdge(door)).toBe(true);
    expect(windows.every((w) => nearEdge(w))).toBe(true);
    expect(out.meta.scoreBreakdown.wallOverlapPenalty).toBe(0);
  });

  it("service objects stay out of main dining center", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 10 }, objects: { kitchen: 1, wc: 1, buffet: 1 } } }, 0);
    const center = out.meta.zones.mainDining;
    const centerRect = { x: center.x + center.w * 0.3, y: center.y + center.h * 0.3, w: center.w * 0.4, h: center.h * 0.4 };
    const services = out.decor.filter((d) => ["kitchen", "wc", "buffet"].includes(d.type));
    expect(services.some((d) => overlap(d, centerRect))).toBe(false);
    services.forEach((s) => out.tables.forEach((t) => expect(overlap(s, { x: t.x, y: t.y, w: t.type === "vip" ? 72 : 60, h: t.type === "vip" ? 72 : 60 })).toBe(false)));
  });
  it("service zone near edge and not inside dining center", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 10 }, objects: { kitchen: 1, wc: 1, buffet: 1 } } }, 6);
    const services = out.decor.filter((d) => ["kitchen", "wc", "buffet"].includes(d.type));
    services.forEach((s) => {
      expect(__testables.isInAisle(s, out.meta.zones.mainAisle)).toBe(false);
      out.tables.forEach((t) => expect(overlap(s, { x: t.x, y: t.y, w: t.type === "vip" ? 72 : 60, h: t.type === "vip" ? 72 : 60 })).toBe(false));
    });
  });
  it("service zone is separated from guest tables", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 8 }, objects: { kitchen: 1, wc: 1 } } }, 5);
    const room = out.meta.zones.roomBounds;
    const services = out.decor.filter((d) => ["kitchen", "wc"].includes(d.type));
    services.forEach((s) => {
      expect(s.x).toBeGreaterThanOrEqual(room.x + 12);
      expect(s.y).toBeGreaterThanOrEqual(room.y + 12);
      expect(s.x + s.w).toBeLessThanOrEqual(room.x + room.w - 12);
      expect(s.y + s.h).toBeLessThanOrEqual(room.y + room.h - 12);
      expect(__testables.isInAisle(s, out.meta.zones.mainAisle)).toBe(false);
      out.tables.forEach((t) => expect(overlap(s, { x: t.x, y: t.y, w: 60, h: 60 })).toBe(false));
    });
    expect(out.meta.scoreBreakdown.serviceTableProximityPenalty).toBeLessThanOrEqual(30);
  });
  it("service in serviceZone near edge should not create high serviceIsolationPenalty", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 10 }, objects: { kitchen: 1, wc: 1, buffet: 1 } } }, 1);
    expect(out.meta.scoreBreakdown.serviceIsolationPenalty).toBeLessThan(80);
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
  it("plants have safe decorative placement", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 8 }, objects: { plant: 2, wall: 4 } } }, 1);
    const room = out.meta.zones.roomBounds;
    const plants = out.decor.filter((d) => d.type === "plant");
    const walls = out.decor.filter((d) => d.type === "wall");
    plants.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(room.x + 18);
      expect(p.y).toBeGreaterThanOrEqual(room.y + 18);
      expect(p.x + p.w).toBeLessThanOrEqual(room.x + room.w - 18);
      expect(p.y + p.h).toBeLessThanOrEqual(room.y + room.h - 18);
      expect(walls.some((w) => overlap(p, w))).toBe(false);
      expect(__testables.isInAisle(p, out.meta.zones.mainAisle)).toBe(false);
    });
  });
  it("no non-wall decor overlaps wall", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 8 }, objects: { wall: 4, door: 1, window: 2, cashier: 1, kitchen: 1, wc: 1, buffet: 1, plant: 2 } } }, 3);
    const walls = out.decor.filter((d) => d.type === "wall");
    const nonWall = out.decor.filter((d) => d.type !== "wall");
    nonWall.forEach((item) => {
      if (item.type === "door" || item.type === "window") return;
      expect(walls.some((w) => overlap(item, w))).toBe(false);
    });
  });

  it("output uses valid GraphQL table types", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { twoSeat: 2, fourSeat: 2, group: 2, vip: 2, standard: 1 }, objects: {} } }, 1);
    expect(out.tables.every((t) => allowedTypes.includes(t.type))).toBe(true);
  });
  it("balanced table distribution", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 12 }, objects: {} } }, 2);
    const aisle = out.meta.zones.mainAisle;
    let sideA = 0; let sideB = 0;
    out.tables.forEach((t) => {
      if (aisle.orientation === "vertical") {
        if (t.x + 30 < aisle.x) sideA += 1; else sideB += 1;
      } else if (t.y + 30 < aisle.y) sideA += 1; else sideB += 1;
    });
    expect(Math.abs(sideA - sideB)).toBeLessThanOrEqual(4);
    expect(out.meta.scoreBreakdown.aislePenalty).toBeLessThan(100);
  });
  it("wall frame remains aligned to roomBounds even when windows exist", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", components: { tables: { standard: 6 }, objects: { door: 1, window: 3, wall: 4 } } }, 4);
    const room = out.meta.zones.roomBounds;
    const walls = out.decor.filter((d) => d.type === "wall");
    expect(walls.length).toBeGreaterThanOrEqual(4);
    expect(walls.some((w) => Math.abs(w.y - room.y) <= 1 && w.w >= room.w - 2)).toBe(true);
    expect(walls.some((w) => Math.abs((w.y + w.h) - (room.y + room.h)) <= 1 && w.w >= room.w - 2)).toBe(true);
    expect(walls.some((w) => Math.abs(w.x - room.x) <= 1 && w.h >= room.h - 2)).toBe(true);
    expect(walls.some((w) => Math.abs((w.x + w.w) - (room.x + room.w)) <= 1 && w.h >= room.h - 2)).toBe(true);
    const windows = out.decor.filter((d) => d.type === "window");
    const nearEdge = (r) => {
      const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
      return Math.min(Math.abs(cx - room.x), Math.abs(cx - (room.x + room.w)), Math.abs(cy - room.y), Math.abs(cy - (room.y + room.h))) < 20;
    };
    expect(windows.every((w) => nearEdge(w))).toBe(true);
  });

  it("clamps total tables to 200 and adds warning", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "capacity",
      components: { tables: { standard: 250 }, objects: {} },
    });
    expect(out.tables.length).toBeLessThanOrEqual(200);
    expect(out.meta.warnings.some((w) => w.includes("giới hạn còn 200"))).toBe(true);
  });
  it("default layout payload produces all tables and all decor inside room", () => {
    const out = __testables.generateRuleBasedLayout({ goal: "balanced", tableCount: 8, selectedComponents: ["wall", "plant", "door", "cashier", "kitchen", "wc"] }, 2);
    const room = out.meta.zones.roomBounds;
    out.tables.forEach((t) => {
      const w = t.type === "vip" ? 72 : 60;
      const h = t.type === "vip" ? 72 : 60;
      expect(t.x).toBeGreaterThanOrEqual(room.x);
      expect(t.y).toBeGreaterThanOrEqual(room.y);
      expect(t.x + w).toBeLessThanOrEqual(room.x + room.w);
      expect(t.y + h).toBeLessThanOrEqual(room.y + room.h);
    });
    out.decor.forEach((d) => {
      if (d.type === "door" || d.type === "window" || d.type === "wall") return;
      expect(d.x).toBeGreaterThanOrEqual(room.x);
      expect(d.y).toBeGreaterThanOrEqual(room.y);
      expect(d.x + d.w).toBeLessThanOrEqual(room.x + room.w);
      expect(d.y + d.h).toBeLessThanOrEqual(room.y + room.h);
    });
  });
});
