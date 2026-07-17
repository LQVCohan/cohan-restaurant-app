import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STAFF_SCAN_URL,
  isLegacyStaffScannerLocation,
  isStaffScannerLocation,
  navigateWithinApp,
} from "./installStaffReservationQrScannerEntry";

describe("staff reservation QR scanner navigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/staff/dashboard");
  });

  it("uses a protected staff route for the scanner", () => {
    expect(STAFF_SCAN_URL).toBe("/staff/orders?scanner=reservation");
    expect(
      isStaffScannerLocation({
        pathname: "/staff/orders",
        search: "?scanner=reservation",
      }),
    ).toBe(true);
    expect(
      isStaffScannerLocation({ pathname: "/scan-table", search: "?source=staff" }),
    ).toBe(false);
  });

  it("recognizes the legacy public scanner URL for migration", () => {
    expect(
      isLegacyStaffScannerLocation({
        pathname: "/scan-table",
        search: "?source=staff",
      }),
    ).toBe(true);
    expect(
      isLegacyStaffScannerLocation({ pathname: "/scan-table", search: "" }),
    ).toBe(false);
  });

  it("navigates in the same document so the in-memory staff session is retained", () => {
    const onPopState = vi.fn();
    window.addEventListener("popstate", onPopState);

    expect(navigateWithinApp(STAFF_SCAN_URL)).toBe(true);
    expect(window.location.pathname).toBe("/staff/orders");
    expect(window.location.search).toBe("?scanner=reservation");
    expect(onPopState).toHaveBeenCalledTimes(1);

    window.removeEventListener("popstate", onPopState);
  });

  it("does not intercept navigation to another origin", () => {
    const currentPath = `${window.location.pathname}${window.location.search}`;

    expect(navigateWithinApp("https://example.com/staff/orders")).toBe(false);
    expect(`${window.location.pathname}${window.location.search}`).toBe(currentPath);
  });
});
