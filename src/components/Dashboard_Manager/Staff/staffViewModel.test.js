import { describe, expect, it } from "vitest";
import { formatStaffAddress, mapStaffToEmployee } from "./staffViewModel";

describe("staff view model", () => {
  it("flattens a structured GraphQL address before rendering employee details", () => {
    const employee = mapStaffToEmployee({
      id: "staff-new",
      fullName: "Phương Anh",
      status: "active",
      employmentStatus: "WORKING",
      address: {
        line1: "Quận 1",
        ward: "Bến Nghé",
        city: "TP. Hồ Chí Minh",
      },
    });

    expect(employee.name).toBe("Phương Anh");
    expect(employee.address).toBe("Quận 1, Bến Nghé, TP. Hồ Chí Minh");
    expect(typeof employee.address).toBe("string");
  });

  it("keeps string addresses and normalizes missing list fields", () => {
    expect(formatStaffAddress("  Quận 3  ")).toBe("Quận 3");

    const employee = mapStaffToEmployee({
      _id: "staff-legacy",
      name: "Nhân viên cũ",
      workingDays: null,
    });

    expect(employee.id).toBe("staff-legacy");
    expect(employee.workingDays).toEqual([]);
  });
});
