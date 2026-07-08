import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";

const mocks = vi.hoisted(() => ({
  updateTable: vi.fn(),
  refetchTables: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/hooks/useTableManagement", () => ({
  default: () => ({
    tables: [
      {
        id: "table-a1",
        code: "A1",
        type: "standard",
        capacity: 4,
        floorLevel: 1,
        status: "available",
      },
      {
        id: "table-vip-2",
        code: "VIP-02",
        type: "vip",
        capacity: 6,
        floorLevel: 2,
        status: "occupied",
      },
    ],
    tablesLoading: false,
    tablesError: null,
    updateTable: mocks.updateTable,
    refetchTables: mocks.refetchTables,
  }),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));

vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ title, stats = [] }) => (
    <header>
      <h1>{title}</h1>
      {stats.map((stat) => (
        <span key={stat.id}>{stat.label}: {stat.value}</span>
      ))}
    </header>
  ),
}));

import TableTypeManagementPage from "./TableTypeManagementPage";

const renderPage = () =>
  render(
    <AuthContext.Provider
      value={{ restaurants: [{ id: "restaurant-1", name: "Cơ sở trung tâm" }] }}
    >
      <TableTypeManagementPage />
    </AuthContext.Provider>,
  );

describe("TableTypeManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.updateTable.mockResolvedValue({ id: "table-a1", type: "vip" });
    mocks.refetchTables.mockResolvedValue({ data: {} });
  });

  it("shows all fixed types and persists a table type change", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Quản lý loại bàn" })).toBeInTheDocument();
    expect(screen.getByText("Loại hệ thống: 6")).toBeInTheDocument();
    expect(screen.getByText("Trong nhà")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("Booth")).toBeInTheDocument();
    expect(screen.getByText("Ngoài trời")).toBeInTheDocument();
    expect(screen.getByText("Bar")).toBeInTheDocument();
    expect(screen.getByText("Riêng")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Loại bàn A1" }), {
      target: { value: "vip" },
    });

    await waitFor(() => {
      expect(mocks.updateTable).toHaveBeenCalledWith({ id: "table-a1", type: "vip" });
      expect(mocks.refetchTables).toHaveBeenCalled();
      expect(mocks.notify).toHaveBeenCalledWith(
        "Đã chuyển bàn A1 sang loại VIP.",
        "success",
      );
    });
  });
});
