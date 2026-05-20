import { describe, expect, it } from "vitest";
import {
  filterTableRows,
  filterTablesByFloor,
  getRawTableById,
  getTableDisplayCapacity,
  getTableDisplayCode,
  getTableDisplayType,
  getTableFloorId,
  normalizeTableSearch,
  sortTableRowsByNumber,
} from "./tableManagementDisplay";

describe("tableManagementDisplay", () => {
  it("getTableDisplayCode supports raw/mapped, trim, and missing", () => {
    expect(getTableDisplayCode({ code: "A1" })).toBe("A1");
    expect(getTableDisplayCode({ number: "B2" })).toBe("B2");
    expect(getTableDisplayCode({ code: "  C3  " })).toBe("C3");
    expect(getTableDisplayCode({})).toBe("");
  });

  it("getTableDisplayCapacity supports raw/mapped and missing", () => {
    expect(getTableDisplayCapacity({ capacity: 6 })).toBe(6);
    expect(getTableDisplayCapacity({ seats: 4 })).toBe(4);
    expect(getTableDisplayCapacity({})).toBe(0);
  });

  it("getTableDisplayType supports raw/mapped and missing", () => {
    expect(getTableDisplayType({ type: "vip" })).toBe("vip");
    expect(getTableDisplayType({ area: "outdoor" })).toBe("outdoor");
    expect(getTableDisplayType({})).toBe("standard");
  });

  it("getRawTableById matches string/number id and returns null when missing", () => {
    const raws = [{ id: 1, code: "A1" }, { id: "2", code: "A2" }];
    expect(getRawTableById(raws, "1")).toEqual({ id: 1, code: "A1" });
    expect(getRawTableById(raws, 2)).toEqual({ id: "2", code: "A2" });
    expect(getRawTableById(raws, 3)).toBeNull();
  });

  it("getTableFloorId and filterTablesByFloor support mixed floor shapes", () => {
    const tables = [
      { number: "A1", floorId: "f1" },
      { number: "A2", floorId: { id: "f2" } },
      { number: "A3", floor: { _id: "f3" } },
    ];
    expect(getTableFloorId(tables[0])).toBe("f1");
    expect(getTableFloorId(tables[1])).toBe("f2");
    expect(getTableFloorId(tables[2])).toBe("f3");
    expect(filterTablesByFloor(tables, "f2").map((t) => t.number)).toEqual(["A2"]);
  });

  it("normalizeTableSearch removes accents, collapses spaces, lowercases", () => {
    expect(normalizeTableSearch(" Bàn Á  01 ")).toBe("ban a 01");
  });

  it("filterTableRows applies search/status/area and does not mutate", () => {
    const source = [
      { number: "A1", status: "available", area: "standard" },
      { number: "A 1", status: "reserved", area: "vip" },
      { number: "B2", status: "available", area: "vip" },
    ];
    const snapshot = JSON.stringify(source);

    expect(filterTableRows(source, { searchQuery: "a1" }).map((t) => t.number)).toEqual([
      "A1",
      "A 1",
    ]);
    expect(filterTableRows(source, { searchQuery: "a 1" }).map((t) => t.number)).toEqual([
      "A1",
      "A 1",
    ]);
    expect(
      filterTableRows(source, { status: "available" }).map((t) => t.number)
    ).toEqual(["A1", "B2"]);
    expect(filterTableRows(source, { area: "vip" }).map((t) => t.number)).toEqual([
      "A 1",
      "B2",
    ]);
    expect(
      filterTableRows(source, {
        searchQuery: "a1",
        status: "reserved",
        area: "vip",
      }).map((t) => t.number)
    ).toEqual(["A 1"]);

    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it("sortTableRowsByNumber sorts naturally and does not mutate", () => {
    const source = [{ number: "A10" }, { number: "A2" }, { number: "A1" }];
    const snapshot = JSON.stringify(source);
    expect(sortTableRowsByNumber(source).map((t) => t.number)).toEqual(["A1", "A2", "A10"]);
    expect(JSON.stringify(source)).toBe(snapshot);
  });
});
