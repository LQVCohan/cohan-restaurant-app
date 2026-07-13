import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMocks = vi.hoisted(() => ({
  validatePublicTableOrderSessionAccess: vi.fn(),
}));
const bootstrapMocks = vi.hoisted(() => ({
  ensurePublicTableSessionForAccess: vi.fn(),
}));
const paymentMocks = vi.hoisted(() => ({
  publicRequestTablePayment: vi.fn(),
  publicCallStaffForTable: vi.fn(),
}));

vi.mock("../../src/services/publicTableOrderAccess.service.js", () => accessMocks);
vi.mock("../../src/services/publicTableSessionBootstrap.service.js", () => bootstrapMocks);
vi.mock("../../graphql/resolvers/payment/publicTablePaymentMutation.js", () => ({
  default: paymentMocks,
}));
vi.mock("../../graphql/resolvers/shared/tableOrderSessionCookies.js", () => ({
  withTableOrderSessionCookieCredentials: vi.fn((ctx) => ctx),
}));

describe("PublicTableAccessGuardMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bootstrapMocks.ensurePublicTableSessionForAccess.mockResolvedValue({ id: "session-1" });
    paymentMocks.publicCallStaffForTable.mockResolvedValue({ ok: true });
  });

  it("lets a valid printed QR call staff before device confirmation", async () => {
    const input = {
      restaurantId: "restaurant-1",
      tableId: "table-1",
      token: "printed-token",
    };
    const { PublicTableAccessGuardMutation } = await import(
      "../../graphql/resolvers/payment/publicTableAccessGuardMutation.js"
    );

    await expect(
      PublicTableAccessGuardMutation.publicCallStaffForTable(
        null,
        { input },
        { request: {} },
        null,
      ),
    ).resolves.toEqual({ ok: true });

    expect(bootstrapMocks.ensurePublicTableSessionForAccess).toHaveBeenCalledWith(input);
    expect(accessMocks.validatePublicTableOrderSessionAccess).not.toHaveBeenCalled();
  });
});
