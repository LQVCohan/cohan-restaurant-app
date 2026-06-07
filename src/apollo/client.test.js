import { describe, it, expect, beforeEach, vi } from "vitest";
import { gql } from "@apollo/client";
import { getRefreshUrl } from "@/lib/apiBaseUrl";
import { apolloClient } from "./client";
import { SESSION_ACCESS_TOKEN_KEY, clearAuth } from "@/lib/authStorage";

describe("apollo client auth helpers", () => {
  beforeEach(() => {
    clearAuth();
    localStorage.clear();
    sessionStorage.clear();
    apolloClient.clearStore();
  });

  it("uses backend api base url", () => {
    expect(getRefreshUrl()).toBe("http://localhost:4000/api/auth/refresh");
  });

  it("attaches Authorization from a session-restored getToken value", async () => {
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, "restored-access-token");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { me: { id: "user-1" } } }),
      headers: { get: () => "application/json" },
    });

    await apolloClient.query({
      query: gql`
        query TestAuthHeader {
          me {
            id
          }
        }
      `,
      fetchPolicy: "no-cache",
    });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.authorization).toBe("Bearer restored-access-token");
  });
});
