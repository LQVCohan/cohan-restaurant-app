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

  it("wraps a local backend panorama URL in the spherical viewer", () => {
    expect(
      buildTableVrViewerUrl("/uploads/table-panorama.jpg", {
        tableId: "table-2",
        returnTo: "/booking/r1",
      }),
    ).toBe(
      "/vr/table/table-2?openedInNewTab=1&returnTo=%2Fbooking%2Fr1&src=%2Fuploads%2Ftable-panorama.jpg",
    );
  });

  it("does not rewrite external viewer links that are not image files", () => {
    expect(
      buildTableVrViewerUrl("https://example.com/panorama", {
        tableId: "table-2",
        returnTo: "/manager#tables",
      }),
    ).toBe("https://example.com/panorama");
  });

  it("opens the image-backed viewer in a new noopener tab", () => {
    const openWindow = vi.fn();
    openTableVrViewerInNewTab("/uploads/table-2.jpg", {
      tableId: "table-2",
      returnTo: "/manager#tables",
      openWindow,
    });

    expect(openWindow).toHaveBeenCalledWith(
      "/vr/table/table-2?openedInNewTab=1&returnTo=%2Fmanager%23tables&src=%2Fuploads%2Ftable-2.jpg",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("parses popup mode, image source and rejects unsafe return locations", () => {
    expect(
      getTableVrViewerNavigation(
        "?openedInNewTab=1&returnTo=%2Fbooking%2Fr1%3Ffloor%3D1&src=%2Fuploads%2Ftable.jpg",
      ),
    ).toEqual({
      openedInNewTab: true,
      returnTo: "/booking/r1?floor=1",
      imageUrl: "/uploads/table.jpg",
    });
    expect(sanitizeTableVrReturnTo("//evil.example/path")).toBe("");
  });
});
