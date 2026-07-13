import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTableVrViewerUrl,
  getTableVrViewerNavigation,
  openTableVrViewerInNewTab,
  sanitizeTableVrReturnTo,
} from "./tableVrNavigation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tableVrNavigation", () => {
  it("marks internal table viewers as popup tabs and preserves a safe return route", () => {
    expect(
      buildTableVrViewerUrl("/vr/table/table-1", {
        returnTo: "/booking/restaurant-1?floor=2#map",
      }),
    ).toBe(
      "/vr/table/table-1?openedInNewTab=1&returnTo=%2Fbooking%2Frestaurant-1%3Ffloor%3D2%23map",
    );
  });

  it("does not rewrite external 360 links", () => {
    expect(
      buildTableVrViewerUrl("https://example.com/panorama", {
        returnTo: "/manager#tables",
      }),
    ).toBe("https://example.com/panorama");
  });

  it("opens the viewer in a new noopener tab", () => {
    const openWindow = vi.fn();
    openTableVrViewerInNewTab("/vr/table/table-2", {
      returnTo: "/manager#tables",
      openWindow,
    });

    expect(openWindow).toHaveBeenCalledWith(
      "/vr/table/table-2?openedInNewTab=1&returnTo=%2Fmanager%23tables",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("parses popup mode and rejects unsafe return locations", () => {
    expect(
      getTableVrViewerNavigation(
        "?openedInNewTab=1&returnTo=%2Fbooking%2Fr1%3Ffloor%3D1",
      ),
    ).toEqual({
      openedInNewTab: true,
      returnTo: "/booking/r1?floor=1",
    });
    expect(sanitizeTableVrReturnTo("//evil.example/path")).toBe("");
  });
});
