import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  PaymentSession: { find: vi.fn() },
  PaymentTransaction: { find: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

function findResult(rows) {
  return { limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }) };
}

describe("reconciliationMatching.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.PaymentSession.find.mockReturnValue(findResult([]));
    modelMocks.PaymentTransaction.find.mockReturnValue(findResult([]));
  });

  it("does not fuzzy query when bank description has no reliable token", async () => {
    const { findReconciliationCandidates, chooseAutoMatch } = await import("../../src/services/finance/reconciliationMatching.service.js");
    const result = await findReconciliationCandidates({ restaurantId: "64b000000000000000000001", amount: 100000, transferContent: "", description: "" });
    expect(result.reason).toBe("no_reliable_reference_token");
    expect(result.candidates).toEqual([]);
    expect(chooseAutoMatch(result.candidates)).toBeNull();
    expect(modelMocks.PaymentSession.find).not.toHaveBeenCalled();
    expect(modelMocks.PaymentTransaction.find).not.toHaveBeenCalled();
  });

  it("scores exact reference and amount match at 100 confidence", async () => {
    const { findReconciliationCandidates, chooseAutoMatch } = await import("../../src/services/finance/reconciliationMatching.service.js");
    modelMocks.PaymentSession.find.mockReturnValueOnce(findResult([{ _id: "ps1", reference: "PAYREF123456", amount: 250000, createdAt: new Date() }]));
    const result = await findReconciliationCandidates({ restaurantId: "64b000000000000000000001", amount: 250000, transferContent: "PAYREF123456", occurredAt: new Date() });
    const best = chooseAutoMatch(result.candidates);
    expect(best).toEqual(expect.objectContaining({ kind: "PaymentSession", confidence: 100, reason: expect.stringContaining("exact_reference") }));
  });
});
