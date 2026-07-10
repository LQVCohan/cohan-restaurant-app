import { describe, expect, it, vi } from "vitest";

import {
  __testables,
  setTableOrderSessionCookies,
  withTableOrderSessionCookieCredentials,
} from "../../graphql/resolvers/shared/tableOrderSessionCookies.js";

const tableId = "64b000000000000000000002";

describe("tableOrderSessionCookies", () => {
  it("uses a distinct cookie pair for each table", () => {
    expect(__testables.tokenCookieName(tableId)).toBe(
      `cohan_table_order_session_${tableId}`,
    );
    expect(__testables.deviceCookieName(tableId)).toBe(
      `cohan_table_order_device_${tableId}`,
    );
    expect(__testables.tokenCookieName("invalid")).toBe("");
  });

  it("sets HttpOnly session and device cookies for the verified table", () => {
    const setCookie = vi.fn();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const written = setTableOrderSessionCookies(
      { reply: { setCookie } },
      {
        tableId,
        orderSessionToken: "signed-session-token",
        deviceId: "table-device-11111111-2222-4333-8444-555555555555",
        expiresAt,
      },
    );

    expect(written).toBe(true);
    expect(setCookie).toHaveBeenCalledTimes(2);
    expect(setCookie).toHaveBeenNthCalledWith(
      1,
      `cohan_table_order_session_${tableId}`,
      "signed-session-token",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      }),
    );
    expect(setCookie).toHaveBeenNthCalledWith(
      2,
      `cohan_table_order_device_${tableId}`,
      "table-device-11111111-2222-4333-8444-555555555555",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("injects only the requested table cookie pair into session validation", () => {
    const next = withTableOrderSessionCookieCredentials(
      {
        request: {
          headers: { origin: "http://localhost:5173" },
          cookies: {
            [`cohan_table_order_session_${tableId}`]: "table-2-token",
            [`cohan_table_order_device_${tableId}`]: "table-2-device",
            cohan_table_order_session_64b000000000000000000009: "other-token",
          },
        },
      },
      tableId,
    );

    expect(next.request.headers).toMatchObject({
      origin: "http://localhost:5173",
      "x-table-order-session": "table-2-token",
      "x-table-order-device": "table-2-device",
    });
    expect(next.request.headers["x-table-order-session"]).not.toBe(
      "other-token",
    );
  });
});
