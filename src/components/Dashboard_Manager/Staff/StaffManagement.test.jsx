import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffManagement from "./StaffManagement";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn(), useLocation: () => ({ search: "" }) };
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
    getManageableRestaurants: vi.fn().mockResolvedValue([]),
    getManageableRestaurantIds: vi.fn().mockResolvedValue([]),
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
      <button onClick={() => onPageChange("attendance")}>Chấm công</button>
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
  StaffActionConfirmModal: () => null,
  StaffAvatarModal: () => null,
}));

describe("StaffManagement navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/manager#staff");
  });

  it("responds to manager:navigation-query and opens attendance subpage", async () => {
    render(<StaffManagement />);

    window.history.replaceState(
      null,
      "",
      "/manager?staffPage=attendance&attendanceTab=off_schedule#staff",
    );

    window.dispatchEvent(
      new CustomEvent("manager:navigation-query", {
        detail: {
          page: "staff",
          query: {
            staffPage: "attendance",
            attendanceTab: "off_schedule",
          },
        },
      }),
    );

    expect(await screen.findByText("Attendance Page")).toBeInTheDocument();
  });

  it("renders the staff reports page when the reports tab is selected", async () => {
    render(<StaffManagement />);

    expect(screen.getByText("Employee Dashboard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));

    expect(await screen.findByText("Staff Reports Rendered")).toBeInTheDocument();
  });
});
