import { describe, expect, it } from "vitest";
import Invoice from "../../models/invoice.model.js";
import PaymentReconciliation from "../../models/payment-reconciliation.model.js";
import PaymentRefund from "../../models/payment-refund.model.js";
import Reservation from "../../models/reservation.model.js";

describe("payment transaction model references", () => {
  it("points every payment relation to the registered Transaction model", () => {
    expect(Invoice.schema.path("refTransactionId").options.ref).toBe("Transaction");
    expect(Reservation.schema.path("depositTxnId").options.ref).toBe("Transaction");
    expect(PaymentRefund.schema.path("paymentTransactionId").options.ref).toBe(
      "Transaction",
    );
    expect(
      PaymentReconciliation.schema.path("candidatePaymentTransactionIds").caster
        .options.ref,
    ).toBe("Transaction");
  });
});
