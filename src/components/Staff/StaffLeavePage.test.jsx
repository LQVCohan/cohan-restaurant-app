import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StaffLeavePage from "./StaffLeavePage";

const captures = vi.hoisted(() => ({ formProps: null, listProps: null }));

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
    default: (props) => {
      captures.listProps = props;
      return <div data-testid="leave-list" />;
    },
  }),
);

vi.mock("@/components/common/Modal", () => {
  const Modal = ({ children }) => <>{children}</>;
  Modal.Body = ({ children }) => <>{children}</>;
  return { default: Modal };
});

describe("StaffLeavePage", () => {
  it("keeps one history panel and passes guided self-service scope to the form", () => {
    const { container } = render(<StaffLeavePage />);

    expect(captures.listProps.title).toBe("Đơn nghỉ phép của tôi");
    expect(captures.listProps.subtitle).toBe("Tạo đơn mới và theo dõi trạng thái duyệt");
    expect(captures.listProps.headerAction).toBeTruthy();
    expect(container.querySelector(".staff-leave-hero")).not.toBeInTheDocument();
    expect(container.querySelector(".staff-leave-guide")).not.toBeInTheDocument();

    expect(captures.formProps.restaurantId).toBe("restaurant-active");
    expect(captures.formProps.selfServiceEmployeeId).toBe("staff-1");
    expect(captures.formProps.stepByStep).toBe(true);
    expect(captures.formProps.compact).toBe(true);
  });
});
