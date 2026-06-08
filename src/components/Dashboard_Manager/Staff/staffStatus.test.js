import {
  getStaffActionAvailability,
  getStaffDetailStatusInfo,
  getStaffListStatus,
  normalizeAccountStatus,
  normalizeEmploymentStatus,
} from "./staffStatus";

describe("staffStatus helpers", () => {
  it("keeps blocked accounts in the inactive bucket without treating them as resigned", () => {
    const accountStatus = normalizeAccountStatus("blocked");
    const employmentStatus = normalizeEmploymentStatus("WORKING");

    expect(
      getStaffListStatus({
        accountStatus,
        employmentStatus,
      }),
    ).toBe("inactive");

    expect(
      getStaffDetailStatusInfo({
        accountStatus,
        employmentStatus,
      }),
    ).toEqual(
      expect.objectContaining({
        key: "blocked",
        color: "danger",
      }),
    );

    expect(
      getStaffActionAvailability({
        accountStatus,
        employmentStatus,
      }),
    ).toEqual({
      canSetOnLeave: false,
      canSetWorking: false,
      canSetResigned: true,
      canLock: false,
      canUnlock: true,
    });
  });

  it("keeps leave state separate from account lock state", () => {
    const accountStatus = normalizeAccountStatus("active");
    const employmentStatus = normalizeEmploymentStatus("ON_LEAVE");

    expect(
      getStaffListStatus({
        accountStatus,
        employmentStatus,
      }),
    ).toBe("break");

    expect(
      getStaffActionAvailability({
        accountStatus,
        employmentStatus,
      }),
    ).toEqual({
      canSetOnLeave: false,
      canSetWorking: true,
      canSetResigned: true,
      canLock: true,
      canUnlock: false,
    });
  });
});
