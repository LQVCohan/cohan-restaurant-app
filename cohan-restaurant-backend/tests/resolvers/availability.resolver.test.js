const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(),
}));

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
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    updateMany: vi.fn(),
  },
  Staff: { findById: vi.fn() },
  Restaurant: { exists: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({
  getSchedulingPolicy: vi.fn().mockResolvedValue({
    availabilityRegistrationPolicy: {
      availabilityRegistrationMode: "manual",
      availabilityOpenDayOffset: -7,
      availabilityOpenTime: "00:00",
      availabilityCloseDayOffset: -5,
      availabilityCloseTime: "23:59",
    },
  }),
}));

describe("availability resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restaurantScopeMocks.canAccessRestaurant.mockReset();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
    modelMocks.Restaurant.exists.mockResolvedValue(true);
  });

  it("creates availability window successfully", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.create.mockResolvedValue({ _id: "w1", status: "draft" });
    const res = await mutation.createAvailabilityWindow(null, { input: { restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), openAt: new Date(), closeAt: new Date() } }, { user: { id: "u1", roles: ["manager"], restaurantId: "r1" } });
    expect(res._id).toBe("w1");
  });

  it("defaults and overrides lateChangeRequiresApproval on createAvailabilityWindow", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.create.mockResolvedValue({ _id: "w-policy" });

    await mutation.createAvailabilityWindow(null, { input: { restaurantId: "r1", periodStart: new Date(), periodEnd: new Date() } }, { user: { id: "u1", roles: ["manager"], restaurantId: "r1" } });
    expect(modelMocks.AvailabilityRegistrationWindow.create.mock.calls[0][0].lateChangeRequiresApproval).toBe(true);

    await mutation.createAvailabilityWindow(null, { input: { restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), lateChangeRequiresApproval: false } }, { user: { id: "u1", roles: ["manager"], restaurantId: "r1" } });
    expect(modelMocks.AvailabilityRegistrationWindow.create.mock.calls[1][0].lateChangeRequiresApproval).toBe(false);
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
    const res = await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "part_time", submissionType: "weekly_availability", slots: [{ date: new Date(), shiftType: "morning", status: "available" }] } }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } });
    expect(res.slots[0].status).toBe("available");
  });

  it("stores full-time unavailable exception", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), status: "open", openAt: new Date(Date.now()-1000), closeAt: new Date(Date.now()+100000), lateChangeRequiresApproval: true });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ submissionType: "unavailable_exception", slots: [{ status: "unavailable" }] });
    const res = await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "full_time", submissionType: "unavailable_exception", slots: [{ date: new Date(), shiftType: "evening", status: "unavailable" }] } }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } });
    expect(res.slots[0].status).toBe("unavailable");
  });

  it("blocks direct submit after close when late change is disabled", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", status: "closed", openAt: new Date(Date.now()-100000), closeAt: new Date(Date.now()-1000), lateChangeRequiresApproval: false });
    await expect(mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "part_time", submissionType: "weekly_availability", slots: [] } }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } })).rejects.toThrow("AVAILABILITY_WINDOW_CLOSED");
  });

  it("marks closed-window submit as late_change_requested when enabled", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({
      _id: "w1",
      restaurantId: "r1",
      status: "closed",
      openAt: new Date(Date.now() - 100000),
      closeAt: new Date(Date.now() - 1000),
      lateChangeRequiresApproval: true,
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-07T23:59:59.999Z"),
    });
    modelMocks.StaffAvailabilitySubmission.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ status: "late_change_requested" });

    const res = await mutation.submitStaffAvailability(
      null,
      {
        input: {
          availabilityWindowId: "w1",
          employeeId: "e1",
          employmentType: "part_time",
          submissionType: "weekly_availability",
          slots: [],
        },
      },
      { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } },
    );

    expect(res.status).toBe("late_change_requested");
    expect(modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mock.calls[0][1].$set.status).toBe("late_change_requested");
  });

  it("sets previousStatusBeforeLateChange from existing locked submission", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({
      _id: "w1",
      restaurantId: "r1",
      status: "closed",
      openAt: new Date(Date.now() - 100000),
      closeAt: new Date(Date.now() - 1000),
      lateChangeRequiresApproval: true,
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-07T23:59:59.999Z"),
    });
    modelMocks.StaffAvailabilitySubmission.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ status: "locked" }),
    });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ status: "late_change_requested" });

    await mutation.submitStaffAvailability(
      null,
      {
        input: {
          availabilityWindowId: "w1",
          employeeId: "e1",
          employmentType: "part_time",
          submissionType: "weekly_availability",
          slots: [],
        },
      },
      { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } },
    );

    expect(
      modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mock.calls[0][1].$set
        .previousStatusBeforeLateChange,
    ).toBe("locked");
  });

  it("rejecting late change restores previous official status and keeps official slots", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.StaffAvailabilitySubmission.findById.mockResolvedValue({
      _id: "s1",
      restaurantId: "r1",
      status: "late_change_requested",
      previousStatusBeforeLateChange: "locked",
      slots: [{ date: new Date(), shiftType: "morning", status: "available" }],
      pendingSlots: [{ date: new Date(), shiftType: "evening", status: "available" }],
    });
    modelMocks.StaffAvailabilitySubmission.findByIdAndUpdate.mockResolvedValue({ _id: "s1", status: "locked" });
    const res = await mutation.reviewStaffAvailabilitySubmission(null, { input: { id: "s1", status: "rejected", reviewNote: "x" } }, { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } });
    expect(res.status).toBe("locked");
    expect(modelMocks.StaffAvailabilitySubmission.findByIdAndUpdate).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ $set: expect.objectContaining({ status: "locked", pendingSlots: [], previousStatusBeforeLateChange: null }) }),
      { new: true },
    );
  });

  it("rejecting late change without official slots marks submission rejected", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.StaffAvailabilitySubmission.findById.mockResolvedValue({
      _id: "s2",
      restaurantId: "r1",
      status: "late_change_requested",
      previousStatusBeforeLateChange: null,
      slots: [],
      pendingSlots: [{ date: new Date(), shiftType: "evening", status: "available" }],
    });
    modelMocks.StaffAvailabilitySubmission.findByIdAndUpdate.mockResolvedValue({ _id: "s2", status: "rejected" });
    const res = await mutation.reviewStaffAvailabilitySubmission(null, { input: { id: "s2", status: "rejected" } }, { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } });
    expect(res.status).toBe("rejected");
  });

  it("blocks submission when window is used_for_schedule or cancelled", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;

    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValueOnce({
      _id: "w1",
      restaurantId: "r1",
      status: "used_for_schedule",
      lateChangeRequiresApproval: true,
    });
    await expect(
      mutation.submitStaffAvailability(
        null,
        { input: { availabilityWindowId: "w1", employeeId: "e1", submissionType: "weekly_availability", slots: [] } },
        { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } },
      ),
    ).rejects.toThrow("AVAILABILITY_WINDOW_LOCKED_FOR_SCHEDULE");

    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValueOnce({
      _id: "w2",
      restaurantId: "r1",
      status: "cancelled",
      lateChangeRequiresApproval: true,
    });
    await expect(
      mutation.submitStaffAvailability(
        null,
        { input: { availabilityWindowId: "w2", employeeId: "e1", submissionType: "weekly_availability", slots: [] } },
        { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } },
      ),
    ).rejects.toThrow("AVAILABILITY_WINDOW_CANCELLED");
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
    expect(modelMocks.StaffAvailabilitySubmission.updateMany).toHaveBeenCalledTimes(1);
  });

  it("allows manager when BrandMembership grants restaurant access", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.create.mockResolvedValue({ _id: "w2", status: "draft" });

    const user = { id: "m2", roles: ["manager"] };
    const res = await mutation.createAvailabilityWindow(
      null,
      { input: { restaurantId: "r2", periodStart: new Date(), periodEnd: new Date(), openAt: new Date(), closeAt: new Date() } },
      { user },
    );

    expect(res._id).toBe("w2");
    expect(restaurantScopeMocks.canAccessRestaurant).toHaveBeenCalledWith(user, "r2");
  });

  it("blocks manager when BrandMembership denies restaurant access", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValueOnce(false);

    await expect(
      mutation.createAvailabilityWindow(
        null,
        { input: { restaurantId: "r2", periodStart: new Date(), periodEnd: new Date(), openAt: new Date(), closeAt: new Date() } },
        { user: { id: "m2", roles: ["manager"] } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("blocks manager outside restaurant scope for open close and cancel", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(false);
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

  it("closeAvailabilityWindow sets closedAt and locks submitted/approved submissions", async () => {
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
        $set: expect.objectContaining({ status: "closed", closedBy: "m1", closedAt: expect.any(Date) }),
      }),
      { new: true },
    );
    expect(modelMocks.StaffAvailabilitySubmission.updateMany).toHaveBeenCalledWith(
      { availabilityWindowId: "w1", status: { $in: ["submitted", "approved"] } },
      { $set: { status: "locked", lockedAt: expect.any(Date) } },
    );
  });

  it("allows staff to view their own submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });
    modelMocks.StaffAvailabilitySubmission.findOne.mockResolvedValue({ _id: "s1", employeeId: "e1" });

    const res = await query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e1" }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } });

    expect(res._id).toBe("s1");
    expect(modelMocks.StaffAvailabilitySubmission.findOne).toHaveBeenCalledWith({ availabilityWindowId: "w1", employeeId: "e1" });
  });

  it("blocks staff from viewing another employee submission", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1" });

    await expect(query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e2" }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } })).rejects.toThrow("FORBIDDEN");
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
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValueOnce(false);
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r2" });

    await expect(query.staffAvailabilitySubmission(null, { windowId: "w1", employeeId: "e1" }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } })).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("blocks staff from listing all submissions", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "r1" }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

  it("blocks HR and accountant from availability window admin mutations", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    const input = { restaurantId: "r1", periodStart: new Date(), periodEnd: new Date(), openAt: new Date(), closeAt: new Date() };
    await expect(mutation.createAvailabilityWindow(null, { input }, { user: { id: "h1", userType: "HR", restaurantForStaff: "r1" } })).rejects.toThrow("FORBIDDEN");
    await expect(mutation.createAvailabilityWindow(null, { input }, { user: { id: "a1", roleName: "accountant", restaurantForStaff: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

  it("allows HR but blocks accountant from submission list", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    modelMocks.StaffAvailabilitySubmission.find.mockResolvedValue([{ _id: "s1" }]);
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "r1" }, { user: { id: "h1", userType: "hr", restaurantForStaff: "r1" } })).resolves.toEqual([{ _id: "s1" }]);
    await expect(query.staffAvailabilitySubmissions(null, { windowId: "w1", restaurantId: "r1" }, { user: { id: "a1", roleName: "accountant", restaurantForStaff: "r1" } })).rejects.toThrow("FORBIDDEN");
  });

  it("blocks HR and accountant outside restaurant scope from list", async () => {
    const query = (await import("../../graphql/resolvers/availability/query.js")).default;
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValueOnce(false);
    await expect(
      query.staffAvailabilitySubmissions(
        null,
        { windowId: "w1", restaurantId: "r1" },
        { user: { id: "h1", userType: "hr", restaurantForStaff: "r2" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(
      query.staffAvailabilitySubmissions(
        null,
        { windowId: "w1", restaurantId: "r1" },
        { user: { id: "a1", roleName: "accountant", restaurantForStaff: "r2" } },
      ),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("writes pending slots for closed late-change submit without overwriting official slots", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.AvailabilityRegistrationWindow.findById.mockResolvedValue({ _id: "w1", restaurantId: "r1", status: "closed", openAt: new Date(Date.now()-1000), closeAt: new Date(Date.now()-1000), lateChangeRequiresApproval: true, periodStart: new Date(), periodEnd: new Date() });
    modelMocks.StaffAvailabilitySubmission.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mockResolvedValue({ status: "late_change_requested" });
    await mutation.submitStaffAvailability(null, { input: { availabilityWindowId: "w1", employeeId: "e1", employmentType: "part_time", submissionType: "weekly_availability", slots: [{ date: new Date(), shiftType: "morning", status: "available" }] } }, { user: { id: "e1", roleName: "staff", restaurantForStaff: "r1" } });
    const update = modelMocks.StaffAvailabilitySubmission.findOneAndUpdate.mock.calls.at(-1)[1];
    expect(update.$set.pendingSlots).toHaveLength(1);
    expect(update.$set.status).toBe("late_change_requested");
    expect(update.$set.slots).toBeUndefined();
  });

  it("approves late change by copying pendingSlots into slots and clearing pending fields", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.StaffAvailabilitySubmission.findById.mockResolvedValue({ _id: "s1", restaurantId: "r1", status: "late_change_requested", submissionType: "weekly_availability", pendingSubmissionType: "weekly_availability", pendingSubmittedAt: new Date(), pendingSlots: [{ date: new Date(), shiftType: "morning", status: "available" }] });
    modelMocks.StaffAvailabilitySubmission.findByIdAndUpdate.mockResolvedValue({ _id: "s1", status: "approved" });
    const res = await mutation.reviewStaffAvailabilitySubmission(null, { input: { id: "s1", status: "approved" } }, { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } });
    expect(res.status).toBe("approved");
    const set = modelMocks.StaffAvailabilitySubmission.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(set.slots).toHaveLength(1);
    expect(set.pendingSlots).toEqual([]);
  });

  it("rejects late change without copying pendingSlots and clears pending fields", async () => {
    const mutation = (await import("../../graphql/resolvers/availability/mutation.js")).default;
    modelMocks.StaffAvailabilitySubmission.findById.mockResolvedValue({ _id: "s2", restaurantId: "r1", status: "late_change_requested", pendingSlots: [{ date: new Date(), shiftType: "morning", status: "available" }] });
    modelMocks.StaffAvailabilitySubmission.findByIdAndUpdate.mockResolvedValue({ _id: "s2", status: "rejected" });
    const res = await mutation.reviewStaffAvailabilitySubmission(null, { input: { id: "s2", status: "rejected" } }, { user: { id: "m1", roles: ["manager"], restaurantId: "r1" } });
    expect(res.status).toBe("rejected");
    const set = modelMocks.StaffAvailabilitySubmission.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(set.slots).toBeUndefined();
    expect(set.pendingSlots).toEqual([]);
  });
});
