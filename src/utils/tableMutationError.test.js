import { describe, expect, it } from "vitest";
import { mapTableMutationError } from "./tableMutationError";

describe("mapTableMutationError", () => {
  it("maps TABLE_HAS_ACTIVE_RESERVATION to Vietnamese-friendly message", () => {
    const error = {
      graphQLErrors: [
        { extensions: { code: "TABLE_HAS_ACTIVE_RESERVATION" } },
      ],
    };

    expect(mapTableMutationError(error)).toBe(
      "Không thể trả bàn về trống vì còn đặt chỗ hoạt động."
    );
  });

  it("maps TABLE_HAS_ACTIVE_ORDERS to Vietnamese-friendly message", () => {
    const error = {
      graphQLErrors: [{ extensions: { code: "TABLE_HAS_ACTIVE_ORDERS" } }],
    };

    expect(mapTableMutationError(error)).toBe(
      "Không thể trả bàn về trống vì còn order hoạt động."
    );
  });

  it("falls back to raw error message when no known code", () => {
    const error = { message: "Custom backend message" };

    expect(mapTableMutationError(error)).toBe("Custom backend message");
  });
});
