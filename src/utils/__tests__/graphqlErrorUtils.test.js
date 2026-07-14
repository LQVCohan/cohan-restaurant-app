import { describe, expect, it } from "vitest";

import {
  getGraphQLErrorCode,
  getGraphQLErrorMessage,
  isForbiddenError,
  isUnauthenticatedError,
} from "../graphqlErrorUtils";

describe("graphqlErrorUtils", () => {
  it("reads FORBIDDEN from graphQLErrors", () => {
    const error = {
      graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }],
    };

    expect(getGraphQLErrorCode(error)).toBe("FORBIDDEN");
    expect(isForbiddenError(error)).toBe(true);
  });

  it("reads business codes from Apollo CombinedGraphQLErrors.errors", () => {
    const error = {
      errors: [
        {
          message: "Khách đến sớm",
          extensions: { code: "RESERVATION_CHECK_IN_TOO_EARLY" },
        },
      ],
    };

    expect(getGraphQLErrorCode(error)).toBe(
      "RESERVATION_CHECK_IN_TOO_EARLY",
    );
    expect(getGraphQLErrorMessage(error)).toBe("Khách đến sớm");
  });

  it("prefers the nested payment business message over the generic wrapper", () => {
    const error = {
      name: "CombinedGraphQLErrors",
      message: "GraphQL request failed",
      errors: [
        {
          message:
            "Không thể thanh toán khi còn món chưa phục vụ xong.",
        },
      ],
    };

    expect(getGraphQLErrorMessage(error, "Thanh toán thất bại.")).toBe(
      "Không thể thanh toán khi còn món chưa phục vụ xong.",
    );
  });

  it("reads UNAUTHENTICATED from network error payload", () => {
    const error = {
      networkError: {
        result: {
          errors: [{ extensions: { code: "UNAUTHENTICATED" } }],
        },
      },
    };

    expect(getGraphQLErrorCode(error)).toBe("UNAUTHENTICATED");
    expect(isUnauthenticatedError(error)).toBe(true);
  });

  it("reads codes nested under cause", () => {
    const error = {
      cause: {
        errors: [{ extensions: { code: "TABLE_SESSION_CONFLICT" } }],
      },
    };

    expect(getGraphQLErrorCode(error)).toBe("TABLE_SESSION_CONFLICT");
  });

  it("returns empty code for non-graphql errors", () => {
    const error = new Error("Backend down");

    expect(getGraphQLErrorCode(error)).toBe("");
    expect(getGraphQLErrorMessage(error)).toBe("Backend down");
    expect(isForbiddenError(error)).toBe(false);
    expect(isUnauthenticatedError(error)).toBe(false);
  });
});
