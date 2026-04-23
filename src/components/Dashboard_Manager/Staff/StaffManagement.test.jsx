import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffManagement from "./StaffManagement";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: () => ({
      data: { leaveRequests: [] },
      loading: false,
      error: null,
    }),
  };
});

vi.mock("@/context/AuthContext", async () => {
  const ReactActual = await vi.importActual("react");
  return {
    AuthContext: ReactActual.createContext({
      user: { id: "manager-1" },
    }),
  };
});

vi.mock("../../../hooks/useStaffManagement", () => ({
  default: () => ({
    staffList: [],
    createStaff: vi.fn(),
    updateStaff: vi.fn(),
    softDeleteStaff: vi.fn(),
    setStaffEmploymentStatus: vi.fn(),
    setStaffAccountStatus: vi.fn(),
    setFilters: vi.fn(),
    staffListLoading: false,
  }),
}));

vi.mock("../../../hooks/useTime", () => ({
  useTime: () => ({
    currentTime: "08:00",
    currentDate: "2026-04-23",
  }),
}));

vi.mock("../../../hooks/useRestaurant", () => ({
  useRestaurant: () => ({
    getManagedRestaurants: vi.fn().mockResolvedValue([]),
    getManagedRestaurantIds: vi.fn().mockResolvedValue([]),
    loading: false,
  }),
}));

vi.mock("./components/Header", () => ({
  default: () => <div>Staff Header</div>,
}));

vi.mock("./components/PageNavigation", () => ({
  default: ({ onPageChange }) => (
    <div>
      <button onClick={() => onPageChange("dashboard")}>Dashboard</button>
      <button onClick={() => onPageChange("reports")}>Báo cáo</button>
    </div>
  ),
}));

vi.mock("./components/EmployeeDashboard", () => ({
  default: () => <div>Employee Dashboard</div>,
}));

vi.mock("./components/Attendance", () => ({
  default: () => <div>Attendance Page</div>,
}));

vi.mock("./components/LeaveManagement", () => ({
  default: () => <div>Leave Management</div>,
}));

vi.mock("./components/Schedule", () => ({
  default: () => <div>Schedule Page</div>,
}));

vi.mock("./components/Reports", () => ({
  default: () => <div>Staff Reports Rendered</div>,
}));

vi.mock("./components/modals", () => ({
  AddEmployeeModal: () => null,
  EditEmployeeModal: () => null,
  WorkHistoryModal: () => null,
}));

describe("StaffManagement reports tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the staff reports page when the reports tab is selected", async () => {
    render(<StaffManagement />);

    expect(screen.getByText("Employee Dashboard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));

    expect(await screen.findByText("Staff Reports Rendered")).toBeInTheDocument();
  });
});
