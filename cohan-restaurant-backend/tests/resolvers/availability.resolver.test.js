const modelMocks = vi.hoisted(() => ({
  AvailabilityRegistrationWindow: {
    create: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  StaffAvailabilitySubmission: {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
  },
  Staff: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("availability resolver", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates availability window successfully", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.create.mockResolvedValue({ _id: "w1", status: "draft" });
    const res = await mutation.createAvailabilityWindow(null, { input: { restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), openAt: new Date(), closeAt: new Date() } }, { user: { id: "u1", roles: ["manager"], restaurantId: "r1" } });
    expect(res._id).toBe("w1");
  });

  it("handles duplicate window by returning existing", async () => {
    const { createOrGetAvailabilityRegistrationWindow } = await import("../../src/services/availability/availabilityRegistrationWindow.service.js");
    modelMocks.AvailabilityRegistrationWindow.create.mockRejectedValue({ code: 11000 });
    modelMocks.AvailabilityRegistrationWindow.findOne.mockResolvedValue({ _id: "existing" });
    const res = await createOrGetAvailabilityRegistrationWindow({ restaurantId: "r1", periodStart: "2026-05-01", periodEnd: "2026-05-07" }, "u1");
    expect(res._id).toBe("existing");
  });

  it("stores part-time weekly availability slots", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), status: "open", openAt: new Date(Date.now()-1000), closeAt: new Date(Date.now()+100000), lateChangeRequiresApproval: true });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ submissionType: "weekly_availability", slots: [{ status: "available" }] });
    const res = await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "part_time", submissionType: "weekly_availability", slots: [{ date: new Date(), shiftType: "morning", status: "available" }] } }, { user: { id: "e1", roles: [], restaurantId: "r1" } });
    expect(res.slots[0].status).toBe("available");
  });

  it("stores full-time unavailable exception", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), status: "open", openAt: new Date(Date.now()-1000), closeAt: new Date(Date.now()+100000), lateChangeRequiresApproval: true });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ submissionType: "unavailable_exception", slots: [{ status: "unavailable" }] });
    const res = await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "full_time", submissionType: "unavailable_exception", slots: [{ date: new Date(), shiftType: "evening", status: "unavailable" }] } }, { user: { id: "e1", roles: [], restaurantId: "r1" } });
    expect(res.slots[0].status).toBe("unavailable");
  });

  it("blocks direct submit after close when late change is disabled", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", status: "closed", openAt: new Date(Date.now()-100000), closeAt: new Date(Date.now()-1000), lateChangeRequiresApproval: false });
    await expect(mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", submissionType: "weekly_availability", slots: [] } }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("AVAILABILITY_WINDOW_CLOSED");
  });

  it("allows manager in scope to open close and cancel availability window", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    const deadline = new Date("2026-06-15T12:00:00.000Z");
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", closeAt: deadline });
    modelMocks.AvailabilityRegistrationWindow.findByIdAndUpdate
      .mockResolvedValueOnce({ _id: "w1", status: "open" })
      .mockResolvedValueOnce({ _id: "w1", status: "closed", closeAt: deadline, closedBy: "m1" })
      .mockResolvedValueOnce({ _id: "w1", status: "cancelled", cancelledBy: "m1", cancelReason: "ops" });

    const ctx = { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } };
    const openRes = await mutation.openAvailabilityWindow(null, { id: "w1" }, ctx);
    const closeRes = await mutation.closeAvailabilityWindow(null, { id: "w1" }, ctx);
    const cancelRes = await mutation.cancelAvailabilityWindow(null, { id: "w1", reason: "ops" }, ctx);

    expect(openRes.status).toBe("open");
    expect(closeRes.status).toBe("closed");
    expect(cancelRes.status).toBe("cancelled");
    expect(modelMocks.AvailabilityRegistrationWindow.findById).toHaveBeenCalledTimes(3);
  });

  it("blocks manager outside restaurant scope for open close and cancel", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r2" });

    const ctx = { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } };
    await expect(mutation.openAvailabilityWindow(null, { id: "w1" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(mutation.closeAvailabilityWindow(null, { id: "w1" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(mutation.cancelAvailabilityWindow(null, { id: "w1", reason: "x" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.AvailabilityRegistrationWindow.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("returns AVAILABILITY_WINDOW_NOT_FOUND for open close and cancel", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue(null);

    const ctx = { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } };
    await expect(mutation.openAvailabilityWindow(null, { id: "missing" }, ctx)).rejects.toThrow("AVAILABILITY_WINDOW_NOT_FOUND");
    await expect(mutation.closeAvailabilityWindow(null, { id: "missing" }, ctx)).rejects.toThrow("AVAILABILITY_WINDOW_NOT_FOUND");
    await expect(mutation.cancelAvailabilityWindow(null, { id: "missing", reason: "x" }, ctx)).rejects.toThrow("AVAILABILITY_WINDOW_NOT_FOUND");
  });

  it("closeAvailabilityWindow keeps configured closeAt deadline", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    const deadline = new Date("2026-06-20T10:00:00.000Z");
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", closeAt: deadline });
    modelMocks.AvailabilityRegistrationWindow.findByIdAndUpdate.mockResolvedValue({ _id: "w1", status: "closed", closeAt: deadline, closedBy: "m1" });

    const ctx = { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } };
    const res = await mutation.closeAvailabilityWindow(null, { id: "w1" }, ctx);

    expect(res.closeAt).toEqual(deadline);
    expect(modelMocks.AvailabilityRegistrationWindow.findByIdAndUpdate).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({
        $set: expect.objectContaining({ status: "closed", closedBy: "m1" }),
      }),
      { new: true },
    );
    expect(modelMocks.AvailabilityRegistrationWindow.findByIdAndUpdate.mock.calls[0][1].$set.closeAt).toBeUndefined();
  });

  it("allows staff to view their own submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });
    modelMocks.StaffAvailabilitySubmission.findOne.mockResolvedValue({ _id: "s1", employeeId: "e1" });

    const res = await query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e1" }, { user: { id: "e1", roles: [], restaurantId: "r1" } });

    expect(res._id).toBe("s1");
    expect(modelMocks.StaffAvailabilitySubmission.findOne).toHaveBeenCalledWith({ availabilityWindowId: "w1", employeeId: "e1" });
  });

  it("blocks staff from viewing another employee submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });

    await expect(query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e2" }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

  it("allows manager in restaurant scope to view employee submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });
    modelMocks.StaffAvailabilitySubmission.findOne.mockResolvedValue({ _id: "s2", employeeId: "e2" });

    const res = await query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e2" }, { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } });

    expect(res._id).toBe("s2");
  });

  it("blocks user outside restaurant scope", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r2" });

    await expect(query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e1" }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("blocks staff from listing all submissions", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "r1" }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

  it("blocks HR and accountant from availability window admin mutations", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    const input = { restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), openAt: new Date(), closeAt: new Date() };
    await expect(mutation.createAvailabilityWindow(null, { input }, { user: { id: "h1", userType: "HR", restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN");
    await expect(mutation.createAvailabilityWindow(null, { input }, { user: { id: "a1", roleName: "accountant", restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

  it("allows HR but blocks accountant from submission list", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.StaffAvailabilitySubmission.find.mockResolvedValue([{ _id: "s1" }]);
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "r1" }, { user: { id: "h1", userType: "hr", restaurantId: "r1" } })).resolves.toEqual([{ _id: "s1" }]);
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "r1" }, { user: { id: "a1", roleName: "accountant", restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

});
