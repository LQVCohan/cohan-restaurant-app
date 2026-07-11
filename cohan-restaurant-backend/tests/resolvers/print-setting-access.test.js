import { beforeEach, describe, expect, it, vi } from "vitest";

const permissionMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  PrintSetting: {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
  Restaurant: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => permissionMocks);
vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");
  const isValidObjectId = (value) => typeof value === "string" && value.startsWith("valid-");
  return {
    ...actual,
    default: { ...actual.default, isValidObjectId },
    isValidObjectId,
  };
});

const queryResult = (value) => ({ lean: vi.fn().mockResolvedValue(value) });

const baseSetting = (overrides = {}) => ({
  _id: "ps1",
  restaurantId: "valid-r1",
  printers: [
    {
      id: "p1",
      name: "Máy bếp",
      ip: "192.168.1.20",
      type: "thermal",
      location: "kitchen",
      status: "configured",
    },
  ],
  stations: { kitchen: ["p1"] },
  templates: [
    { key: "kitchen", name: "Phiếu bếp", enabled: true, content: "{{orderCode}}" },
    { key: "receipt", name: "Hóa đơn", enabled: true, content: "{{orderCode}}" },
  ],
  jobs: [],
  ...overrides,
});

describe("printSetting permission and queue integrity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.requireRestaurantPermission.mockResolvedValue(true);
    modelMocks.Restaurant.findById.mockReturnValue(queryResult({ _id: "valid-r1" }));
    modelMocks.PrintSetting.findOne.mockReturnValue(queryResult(baseSetting()));
    modelMocks.PrintSetting.create.mockResolvedValue({
      toObject: vi.fn().mockReturnValue(baseSetting()),
    });
    modelMocks.PrintSetting.findOneAndUpdate.mockReturnValue(queryResult(baseSetting()));
    modelMocks.PrintSetting.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
  });

  it("requires print.read for the scoped settings query", async () => {
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    const ctx = { user: { id: "manager-1" } };

    const result = await resolver.Query.printSettings(
      null,
      { restaurantId: "valid-r1" },
      ctx,
    );

    expect(permissionMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      ctx,
      "valid-r1",
      "print.read",
    );
    expect(result).toEqual(expect.objectContaining({ restaurantId: "valid-r1" }));
  });

  it("rejects an invalid restaurant id before permission and database calls", async () => {
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    await expect(
      resolver.Query.printSettings(null, { restaurantId: "bad-id" }, { user: { id: "m1" } }),
    ).rejects.toThrow("Invalid restaurantId");

    expect(permissionMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Restaurant.findById).not.toHaveBeenCalled();
  });

  it("requires print.write for configuration and queue mutations", async () => {
    permissionMocks.requireRestaurantPermission.mockRejectedValue(new Error("FORBIDDEN_PRINT_WRITE"));
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");
    const ctx = { user: { id: "viewer-1" } };

    await expect(
      resolver.Mutation.upsertPrintSettings(
        null,
        { input: { restaurantId: "valid-r1", printers: [] } },
        ctx,
      ),
    ).rejects.toThrow("FORBIDDEN_PRINT_WRITE");
    await expect(
      resolver.Mutation.enqueuePrintJob(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            printerId: "p1",
            printType: "manual_test",
          },
        },
        ctx,
      ),
    ).rejects.toThrow("FORBIDDEN_PRINT_WRITE");
    await expect(
      resolver.Mutation.retryPrintJob(
        null,
        { input: { restaurantId: "valid-r1", jobId: "j1" } },
        ctx,
      ),
    ).rejects.toThrow("FORBIDDEN_PRINT_WRITE");
    await expect(
      resolver.Mutation.updatePrintJobStatus(
        null,
        { input: { restaurantId: "valid-r1", jobId: "j1", status: "completed" } },
        ctx,
      ),
    ).rejects.toThrow("FORBIDDEN_PRINT_WRITE");
    await expect(
      resolver.Mutation.testPrint(
        null,
        { input: { restaurantId: "valid-r1", printerId: "p1" } },
        ctx,
      ),
    ).rejects.toThrow("FORBIDDEN_PRINT_WRITE");

    expect(permissionMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      ctx,
      "valid-r1",
      "print.write",
    );
    expect(modelMocks.PrintSetting.updateOne).not.toHaveBeenCalled();
    expect(modelMocks.PrintSetting.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("sanitizes station assignments during settings upsert", async () => {
    modelMocks.PrintSetting.findOneAndUpdate.mockReturnValue(
      queryResult(baseSetting({ stations: { kitchen: ["p1"] } })),
    );
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    await resolver.Mutation.upsertPrintSettings(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          printers: [
            { id: "p1", name: "Máy bếp", ip: "192.168.1.20" },
            { id: "", name: "Không hợp lệ" },
          ],
          stations: { kitchen: ["p1", "missing-printer", "p1"] },
        },
      },
      { user: { id: "manager-1" } },
    );

    const payload = modelMocks.PrintSetting.findOneAndUpdate.mock.calls[0][1].$set;
    expect(payload.stations.kitchen).toEqual(["p1"]);
  });

  it("rejects a manual job for a printer outside the restaurant configuration", async () => {
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    await expect(
      resolver.Mutation.enqueuePrintJob(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            printerId: "unknown-printer",
            printType: "manual_test",
          },
        },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("Configured printer not found");

    expect(modelMocks.PrintSetting.updateOne).not.toHaveBeenCalled();
  });

  it("appends a validated print job atomically without rewriting the queue", async () => {
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    const job = await resolver.Mutation.enqueuePrintJob(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          printerId: "p1",
          stationId: "kitchen",
          printType: "manual_test",
          templateKey: "kitchen",
        },
      },
      { user: { id: "manager-1" } },
    );

    expect(job).toEqual(expect.objectContaining({ printerId: "p1", status: "pending" }));
    const update = modelMocks.PrintSetting.updateOne.mock.calls[0][1];
    expect(update.$push.jobs).toEqual(expect.objectContaining({
      $position: 0,
      $slice: 300,
      $each: [expect.objectContaining({ printerId: "p1" })],
    }));
    expect(update.$set).not.toHaveProperty("jobs");
  });

  it("retries only failed jobs with a positional atomic update", async () => {
    const failedJob = {
      id: "j-failed",
      printType: "order_confirmed",
      status: "failed",
      retryCount: 1,
      items: [{ name: "Món bếp" }],
      createdAt: "2026-07-11T00:00:00.000Z",
    };
    modelMocks.PrintSetting.findOne.mockReturnValue(
      queryResult(baseSetting({ jobs: [failedJob] })),
    );
    modelMocks.PrintSetting.findOneAndUpdate.mockReturnValue(
      queryResult(baseSetting({
        jobs: [{ ...failedJob, status: "pending", retryCount: 2, error: null }],
      })),
    );
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    const retried = await resolver.Mutation.retryPrintJob(
      null,
      { input: { restaurantId: "valid-r1", jobId: "j-failed" } },
      { user: { id: "manager-1" } },
    );

    expect(retried).toEqual(expect.objectContaining({
      id: "j-failed",
      status: "pending",
      retryCount: 2,
      items: [{ name: "Món bếp" }],
    }));
    const [filter, update] = modelMocks.PrintSetting.findOneAndUpdate.mock.calls[0];
    expect(filter.jobs.$elemMatch).toEqual({ id: "j-failed", status: "failed" });
    expect(update.$set["jobs.$.status"]).toBe("pending");
    expect(update.$inc["jobs.$.retryCount"]).toBe(1);
    expect(update.$set).not.toHaveProperty("jobs");
  });

  it("rejects retry for a job that is not failed", async () => {
    modelMocks.PrintSetting.findOne.mockReturnValue(
      queryResult(baseSetting({
        jobs: [{ id: "j-pending", printType: "receipt", status: "pending" }],
      })),
    );
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    await expect(
      resolver.Mutation.retryPrintJob(
        null,
        { input: { restaurantId: "valid-r1", jobId: "j-pending" } },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("Only failed print jobs can be retried");
  });

  it("records a simulated configuration check without claiming hardware is online", async () => {
    modelMocks.PrintSetting.findOneAndUpdate.mockReturnValue(
      queryResult(baseSetting({
        printers: [{
          id: "p1",
          name: "Máy bếp",
          ip: "192.168.1.20",
          status: "configured",
        }],
      })),
    );
    const resolver = await import("../../graphql/resolvers/printSetting/index.js");

    const job = await resolver.Mutation.testPrint(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          printerId: "p1",
          draftIp: "192.168.1.50",
        },
      },
      { user: { id: "manager-1" } },
    );

    const update = modelMocks.PrintSetting.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set["printers.$.status"]).toBe("configured");
    expect(job.payload).toEqual(expect.objectContaining({
      simulated: true,
      hardwareHandshake: false,
    }));
  });
});
