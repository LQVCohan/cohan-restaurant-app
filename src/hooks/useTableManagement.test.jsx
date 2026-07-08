import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import useTableManagement from "./useTableManagement";

const mocks = vi.hoisted(() => ({
  showNotification: vi.fn(),
  refetch: vi.fn(),
  mergeMutation: vi.fn(),
  splitMutation: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

vi.mock("./useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.showNotification }),
}));

const getOperationName = (document) =>
  document?.definitions?.find((definition) => definition?.name?.value)?.name
    ?.value;

describe("useTableManagement merge and split feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    useQuery.mockReturnValue({
      data: { tables: [] },
      loading: false,
      error: null,
      refetch: mocks.refetch,
    });
    useMutation.mockImplementation((document) => {
      const operationName = getOperationName(document);
      if (operationName === "MergeTables") return [mocks.mergeMutation];
      if (operationName === "SplitTables") return [mocks.splitMutation];
      return [vi.fn()];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps successful merge and split results when the follow-up refresh fails", async () => {
    mocks.refetch.mockRejectedValue(new Error("refresh failed"));
    mocks.mergeMutation.mockResolvedValue({
      data: {
        mergeTables: {
          joinGroupId: "group-1",
          anchorId: "table-a1",
          tableIds: ["table-a1", "table-a2"],
          mergedTableId: "table-merged",
          mergedTableCode: "A1+A2",
        },
      },
    });
    mocks.splitMutation.mockResolvedValue({
      data: {
        splitTables: {
          ok: true,
          unmergedTableIds: ["table-a1", "table-a2"],
        },
      },
    });

    const { result } = renderHook(() =>
      useTableManagement({ restaurantId: "restaurant-1" }),
    );

    let mergeResult;
    await act(async () => {
      mergeResult = await result.current.mergeTables({
        tableIds: ["table-a1", "table-a2"],
        anchorId: "table-a1",
      });
    });

    expect(mergeResult).toMatchObject({
      mergedTableId: "table-merged",
      mergedTableCode: "A1+A2",
    });
    expect(mocks.showNotification).toHaveBeenCalledWith(
      "Đã ghép bàn thành A1+A2.",
      "success",
    );

    let splitResult;
    await act(async () => {
      splitResult = await result.current.splitTables({
        joinGroupId: "group-1",
        mode: "ALL",
      });
    });

    expect(splitResult).toEqual({
      ok: true,
      unmergedTableIds: ["table-a1", "table-a2"],
    });
    expect(mocks.showNotification).toHaveBeenCalledWith(
      "Đã tách bàn thành công.",
      "success",
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
  });

  it("still rejects a real merge mutation error without showing success", async () => {
    mocks.mergeMutation.mockRejectedValue(new Error("merge rejected"));

    const { result } = renderHook(() =>
      useTableManagement({ restaurantId: "restaurant-1" }),
    );

    await act(async () => {
      await expect(
        result.current.mergeTables({
          tableIds: ["table-a1", "table-a2"],
          anchorId: "table-a1",
        }),
      ).rejects.toThrow("merge rejected");
    });

    expect(mocks.showNotification).not.toHaveBeenCalled();
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
});
