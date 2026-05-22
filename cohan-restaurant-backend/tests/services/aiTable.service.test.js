import { describe, expect, it } from "vitest";
import { __testables } from "../../src/services/ai/aiTable.service.js";

const allowedTypes = ["standard", "booth", "vip", "outdoor", "bar", "private"];

const overlap = (a, b, gap = 0) =>
  a.x < b.x + b.w + gap &&
  a.x + a.w + gap > b.x &&
  a.y < b.y + b.h + gap &&
  a.y + a.h + gap > b.y;

const avgNearestDistance = (tables) => {
  if (!tables.length) return 0;
  return (
    tables.reduce((sum, t, idx) => {
      let nearest = Infinity;
      tables.forEach((o, j) => {
        if (idx === j) return;
        const d = Math.hypot(t.x - o.x, t.y - o.y);
        nearest = Math.min(nearest, d);
      });
      return sum + (Number.isFinite(nearest) ? nearest : 0);
    }, 0) / tables.length
  );
};

describe("aiTable.service layout engine", () => {
  it("does not auto-add 8 standard tables when components payload exists", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "balanced",
      components: { tables: { standard: 0, vip: 2 }, objects: {} },
      startX: 0,
      startY: 0,
    });
    expect(out.tables).toHaveLength(2);
  });

  it("generates only valid GraphQL table types", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "balanced",
      components: {
        tables: { twoSeat: 2, fourSeat: 2, group: 2, vip: 2, standard: 1 },
        objects: {},
      },
      startX: 0,
      startY: 0,
    });
    expect(out.tables.every((t) => allowedTypes.includes(t.type))).toBe(true);
  });

  it("clamps total tables over 200 and returns warning", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "capacity",
      components: { tables: { standard: 250 }, objects: {} },
      startX: 0,
      startY: 0,
    });
    expect(out.tables.length).toBeLessThanOrEqual(200);
    expect(out.meta.warnings.some((w) => w.includes("giới hạn còn 200"))).toBe(true);
  });

  it("avoids overlap with currentItems", () => {
    const current = [{ x: 0, y: 0, w: 120, h: 120, isRealTable: false }];
    const out = __testables.generateRuleBasedLayout({
      goal: "balanced",
      components: { tables: { standard: 5 }, objects: { plant: 1 } },
      startX: 0,
      startY: 0,
      currentItems: current,
    });
    const blocked = { x: 0, y: 0, w: 120, h: 120 };
    const allNew = [
      ...out.tables.map((t) => ({ x: t.x, y: t.y, w: 60, h: 60 })),
      ...out.decor.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h })),
    ];
    expect(allNew.some((r) => overlap(r, blocked))).toBe(false);
  });

  it("keeps vip separated in vip goal", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "vip",
      components: { tables: { standard: 8, vip: 2 }, objects: {} },
      startX: 0,
      startY: 0,
    });
    const vip = out.tables.filter((t) => t.type === "vip");
    const normal = out.tables.filter((t) => t.type !== "vip");
    const avgVipToStandard =
      vip.reduce((sum, v) => {
        const nearest = normal.reduce((min, n) => Math.min(min, Math.hypot(v.x - n.x, v.y - n.y)), Infinity);
        return sum + nearest;
      }, 0) / Math.max(1, vip.length);
    expect(avgVipToStandard).toBeGreaterThan(90);
  });

  it("places cashier near door", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "balanced",
      components: { tables: { standard: 6 }, objects: { door: 1, cashier: 1, kitchen: 1 } },
      startX: 10,
      startY: 10,
    });
    const door = out.decor.find((d) => d.type === "door");
    const cashier = out.decor.find((d) => d.type === "cashier");
    const kitchen = out.decor.find((d) => d.type === "kitchen");
    expect(door && cashier).toBeTruthy();
    const dDoor = Math.hypot(cashier.x - door.x, cashier.y - door.y);
    if (kitchen) {
      const dKitchen = Math.hypot(cashier.x - kitchen.x, cashier.y - kitchen.y);
      expect(dDoor).toBeLessThan(dKitchen);
    } else {
      expect(dDoor).toBeLessThan(180);
    }
  });

  it("spacious has larger nearest-table distance than capacity", () => {
    const payloadBase = {
      components: { tables: { standard: 12, fourSeat: 4, twoSeat: 2 }, objects: {} },
      startX: 0,
      startY: 0,
    };
    const compact = __testables.generateRuleBasedLayout({ ...payloadBase, goal: "capacity" });
    const spacious = __testables.generateRuleBasedLayout({ ...payloadBase, goal: "spacious" });
    expect(avgNearestDistance(spacious.tables)).toBeGreaterThan(avgNearestDistance(compact.tables));
  });

  it("places full requested tables in normal space", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "balanced",
      components: {
        tables: { standard: 8, vip: 2, twoSeat: 4, fourSeat: 4, group: 2 },
        objects: { plant: 4, door: 1, cashier: 1 },
      },
      startX: 100,
      startY: 100,
    });
    expect(out.tables.length).toBe(20);
  });

  it("supports wall custom width from placement function", () => {
    const out = __testables.generateRuleBasedLayout({
      goal: "balanced",
      components: { tables: { standard: 6 }, objects: { wall: 2 } },
      startX: 0,
      startY: 0,
    });
    const walls = out.decor.filter((d) => d.type === "wall");
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.some((w) => w.w > 200)).toBe(true);
  });

  it("emits warning when not all requested tables can be placed", () => {
    const requested = 45;
    const blocking = Array.from({ length: 500 }).map((_, i) => ({
      x: -420 + (i % 25) * 56,
      y: -420 + Math.floor(i / 25) * 56,
      w: 56,
      h: 56,
      isRealTable: true,
    }));
    const out = __testables.generateRuleBasedLayout({
      goal: "capacity",
      components: { tables: { standard: 40, vip: 5 }, objects: {} },
      startX: 0,
      startY: 0,
      currentItems: blocking,
    });
    if (out.tables.length < requested) {
      expect(out.meta.warnings.some((w) => w.includes("Chỉ đặt được"))).toBe(true);
    } else {
      expect(out.tables.length).toBe(requested);
    }
  });
});
