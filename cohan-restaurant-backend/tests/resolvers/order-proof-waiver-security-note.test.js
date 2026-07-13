import { describe, expect, it } from "vitest";

import {
  isOrderItemProofWaived,
} from "../../src/services/orderProofRules.service.js";

describe("order proof waiver trust boundary", () => {
  it("does not treat missing or disabled waiver entries as approval", () => {
    const item = { _id: "item-1" };

    expect(isOrderItemProofWaived(item, {})).toBe(false);
    expect(
      isOrderItemProofWaived(item, {
        "item-1": { waived: false, source: "staff_customer_confirmation" },
      }),
    ).toBe(false);
  });
});
