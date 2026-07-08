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
    const { container } = renderPage();

    expect(screen.getByRole("heading", { name: "Quản lý loại bàn" })).toBeInTheDocument();
    expect(screen.getByText("Loại hệ thống: 6")).toBeInTheDocument();
    expect(container.querySelectorAll(".ttm-type-card")).toHaveLength(6);
    expect(screen.getByRole("button", { name: /standard.*Trong nhà.*1 bàn/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /booth.*Booth.*0 bàn/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vip.*VIP.*1 bàn/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /outdoor.*Ngoài trời.*0 bàn/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bar.*Bar.*0 bàn/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /private.*Riêng.*0 bàn/i })).toBeInTheDocument();

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
