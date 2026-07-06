import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useTable3DModels from "./useTable3DModels";

const { localCatalog } = vi.hoisted(() => ({
  localCatalog: [
    {
      key: "demo-table",
      label: "Bàn demo",
      tableType: "rect-4-seat",
      capacity: 4,
    },
  ],
}));

vi.mock("@/config/table3dCatalog", () => ({
  LOCAL_TABLE_3D_CATALOG: localCatalog,
  normalizeCatalogItem: (item) => item,
  TABLE_3D_PUBLIC_CATALOG_URL: "",
}));

describe("useTable3DModels", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("uses the local catalog without making an empty remote request", async () => {
    const { result } = renderHook(() => useTable3DModels());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.models).toEqual(localCatalog);
    expect(result.current.error).toBe("");
  });
});
