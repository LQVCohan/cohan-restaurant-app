import { describe, expect, it, vi } from "vitest";

import { clearStaleTableIdentity } from "./TableOrderRouteExperience";

describe("clearStaleTableIdentity", () => {
  it("removes the prior customer identity for the scanned table", () => {
    const removeItem = vi.fn();
    const restaurantId = "64b000000000000000000001";
    const tableId = "64b000000000000000000002";

    clearStaleTableIdentity(`/table/${restaurantId}/${tableId}`, { removeItem });

    expect(removeItem).toHaveBeenNthCalledWith(
      1,
      `cohan:table-order:identity-choice:${restaurantId}:${tableId}`,
    );
    expect(removeItem).toHaveBeenNthCalledWith(
      2,
      `cohan:table-order:identity-token:${restaurantId}:${tableId}`,
    );
  });

  it("does not touch storage outside a valid table route", () => {
    const removeItem = vi.fn();

    clearStaleTableIdentity("/restaurants", { removeItem });

    expect(removeItem).not.toHaveBeenCalled();
  });
});
