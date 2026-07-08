import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import useTableManagement from "./useTableManagement";
import { TABLE_CUSTOMER_SOCKET_EVENT } from "./useSocketOrder";

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

describe("useTableManagement merge, split and realtime refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetch.mockImplementation(() => {
      throw new Error("refetch must stay caller-owned");
    });

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

  it("returns successful merge and split results without invoking refetch", async () => {
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
    expect(mocks.refetch).not.toHaveBeenCalled();
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

  it("refetches only when the table customer update belongs to this restaurant", async () => {
    mocks.refetch.mockResolvedValue({ data: { tables: [] } });
    renderHook(() => useTableManagement({ restaurantId: "restaurant-1" }));

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(TABLE_CUSTOMER_SOCKET_EVENT, {
          detail: {
            event: {
              type: "TABLE_CUSTOMER_UPDATED",
              restaurantId: "restaurant-1",
            },
          },
        }),
      );
      await Promise.resolve();
    });

    expect(mocks.refetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(TABLE_CUSTOMER_SOCKET_EVENT, {
          detail: {
            event: {
              type: "TABLE_CUSTOMER_UPDATED",
              restaurantId: "restaurant-2",
            },
          },
        }),
      );
      await Promise.resolve();
    });

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
