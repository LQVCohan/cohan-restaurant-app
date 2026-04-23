import { describe, expect, it } from "vitest";
import { print } from "graphql";
import { QUERY_ATTENDANCE_PAGE } from "./useAttendanceManagement";
import { Q_LEAVE_PAGE } from "./useLeaveManagement";

const getStaffListSelection = (documentNode) => {
  const query = print(documentNode);
  const match = query.match(/staffList\s*\{([\s\S]*?)\n\s*\}/);
  return match?.[1] || "";
};

describe("staff avatar query contract", () => {
  it("attendance page queries avatarUrl, not avatar, on User", () => {
    const selection = getStaffListSelection(QUERY_ATTENDANCE_PAGE);

    expect(selection).toContain("avatarUrl");
    expect(selection).not.toMatch(/\bavatar\b/);
  });

  it("leave page queries avatarUrl, not avatar, on User", () => {
    const selection = getStaffListSelection(Q_LEAVE_PAGE);

    expect(selection).toContain("avatarUrl");
    expect(selection).not.toMatch(/\bavatar\b/);
  });
});
