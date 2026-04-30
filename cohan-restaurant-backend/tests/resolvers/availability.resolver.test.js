const modelMocks = vi.hoisted(() => ({
  AvailabilityWindow: {
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
    modelMocks.AvailabilityWindow.create.mockResolvedValue({ _id: "w1", status: "draft" });
    const res = await mutation.createAvailabilityWindow(null, { input: { restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), openAt: new Date(), closeAt: new Date() } }, { user: { id: "u1", roles: ["manager"], restaurantId: "r1" } });
    expect(res._id).toBe("w1");
  });

  it("handles duplicate window by returning existing", async () => {
    const { createOrGetAvailabilityWindow } = await import("../../src/services/availability/availabilityWindow.service.js");
    modelMocks.AvailabilityWindow.create.mockRejectedValue({ code: 11000 });
    modelMocks.AvailabilityWindow.findOne.mockResolvedValue({ _id: "existing" });
    const res = await createOrGetAvailabilityWindow({ restaurantId: "r1", periodStart: "2026-05-01", periodEnd: "2026-05-07" }, "u1");
    expect(res._id).toBe("existing");
  });

  it("stores part-time weekly availability slots", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), status: "open", openAt: new Date(Date.now()-1000), closeAt: new Date(Date.now()+100000), lateChangeRequiresApproval: true });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ submissionType: "weekly_availability", slots: [{ status: "available" }] });
    const res = await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "part_time", submissionType: "weekly_availability", slots: [{ date: new Date(), shiftType: "morning", status: "available" }] } }, { user: { id: "e1", roles: [], restaurantId: "r1" } });
    expect(res.slots[0].status).toBe("available");
  });

  it("stores full-time unavailable exception", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), status: "open", openAt: new Date(Date.now()-1000), closeAt: new Date(Date.now()+100000), lateChangeRequiresApproval: true });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ submissionType: "unavailable_exception", slots: [{ status: "unavailable" }] });
    const res = await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "full_time", submissionType: "unavailable_exception", slots: [{ date: new Date(), shiftType: "evening", status: "unavailable" }] } }, { user: { id: "e1", roles: [], restaurantId: "r1" } });
    expect(res.slots[0].status).toBe("unavailable");
  });

  it("blocks direct submit after close when late change is disabled", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", status: "closed", openAt: new Date(Date.now()-100000), closeAt: new Date(Date.now()-1000), lateChangeRequiresApproval: false });
    await expect(mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", submissionType: "weekly_availability", slots: [] } }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("AVAILABILITY_WINDOW_CLOSED");
  });

  it("allows staff to view their own submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });
    modelMocks.StaffAvailabilitySubmission.findOne.mockResolvedValue({ _id: "s1", employeeId: "e1" });

    const res = await query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e1" }, { user: { id: "e1", roles: [], restaurantId: "r1" } });

    expect(res._id).toBe("s1");
    expect(modelMocks.StaffAvailabilitySubmission.findOne).toHaveBeenCalledWith({ availabilityWindowId: "w1", employeeId: "e1" });
  });

  it("blocks staff from viewing another employee submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });

    await expect(query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e2" }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

  it("allows manager in restaurant scope to view employee submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });
    modelMocks.StaffAvailabilitySubmission.findOne.mockResolvedValue({ _id: "s2", employeeId: "e2" });

    const res = await query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e2" }, { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } });

    expect(res._id).toBe("s2");
  });

  it("blocks user outside restaurant scope", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r2" });

    await expect(query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e1" }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("blocks staff from listing all submissions", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "r1" }, { user: { id: "e1", roles: [], restaurantId: "r1" } })).rejects.toThrow("FORBIDDEN");
  });
});
