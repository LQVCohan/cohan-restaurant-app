import { describe, expect, it } from "vitest";

import {
  getGraphQLErrorCode,
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

  it("returns empty code for non-graphql errors", () => {
    const error = new Error("Backend down");

    expect(getGraphQLErrorCode(error)).toBe("");
    expect(isForbiddenError(error)).toBe(false);
    expect(isUnauthenticatedError(error)).toBe(false);
  });
});
