import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StaffLeavePage from "./StaffLeavePage";

const captures = vi.hoisted(() => ({ formProps: null }));

vi.mock("@/context/AuthContext", async () => {
  const ReactActual = await vi.importActual("react");
  return {
    AuthContext: ReactActual.createContext({
      user: {
        id: "staff-1",
        fullName: "Nhân viên A",
        restaurantForStaff: { id: "restaurant-active" },
      },
      restaurants: [],
    }),
  };
});

vi.mock("@/hooks/useLeaveManagement", () => ({
  useLeaveManagement: () => ({
    leaveRequests: [],
    submitLeaveRequest: vi.fn(),
    loading: false,
    error: null,
    isMutating: false,
  }),
}));

vi.mock(
  "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestForm",
  () => ({
    default: (props) => {
      captures.formProps = props;
      return <div data-testid="leave-form" />;
    },
  }),
);

vi.mock(
  "@/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveRequestsList",
  () => ({
    default: () => <div data-testid="leave-list" />,
  }),
);

vi.mock("@/components/common/Modal", () => {
  const Modal = ({ children }) => <>{children}</>;
  Modal.Body = ({ children }) => <>{children}</>;
  return { default: Modal };
});

describe("StaffLeavePage", () => {
  it("passes the authenticated staff scope and guided mode to the leave form", () => {
    render(<StaffLeavePage />);

    expect(captures.formProps.restaurantId).toBe("restaurant-active");
    expect(captures.formProps.selfServiceEmployeeId).toBe("staff-1");
    expect(captures.formProps.stepByStep).toBe(true);
    expect(captures.formProps.compact).toBe(true);
  });
});
