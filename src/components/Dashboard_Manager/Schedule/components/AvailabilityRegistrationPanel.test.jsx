import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AvailabilityRegistrationPanel from "./AvailabilityRegistrationPanel";

const baseProps = {
  selectedRestaurantId: "restaurant-1",
  nextWeekStart: "2026-05-11T00:00:00.000Z",
  nextWeekEnd: "2026-05-17T23:59:59.000Z",
  targetWeekStart: new Date("2026-05-11T00:00:00.000Z"),
  targetWeekEnd: new Date("2026-05-17T23:59:59.000Z"),
  availabilityWindow: {
    id: "window-1",
    status: "draft",
    registrationMode: "manual",
    periodStart: "2026-05-11T00:00:00.000Z",
    periodEnd: "2026-05-17T23:59:59.000Z",
    openAt: "2026-05-04T09:00:00.000Z",
    closeAt: "2026-05-10T18:00:00.000Z",
    targetEmploymentTypes: ["part_time"],
    allowFullTimeUnavailableException: true,
  },
  submissions: [],
  loading: false,
  error: null,
  onCreateWindow: vi.fn(),
  onOpenWindow: vi.fn(),
  onCloseWindow: vi.fn(),
  reopenBlockedReason: "",
  availabilityPolicy: {
    availabilityRegistrationMode: "manual",
    availabilityOpenDayOffset: -7,
    availabilityOpenTime: "09:00",
    availabilityCloseDayOffset: -1,
    availabilityCloseTime: "18:00",
    lateChangeRequiresApproval: true,
  },
  onUpdateAvailabilityPolicy: vi.fn(),
};

describe("AvailabilityRegistrationPanel", () => {
  it("renders setup button and modal with 2 modes", () => {
    render(<AvailabilityRegistrationPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Thiết lập đăng ký" }));

    expect(screen.getByText("Thiết lập đăng ký lịch nhân viên")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Thủ công" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tự động" })).toBeInTheDocument();
  });

  it("saves auto mode with expected policy input", async () => {
    const onUpdateAvailabilityPolicy = vi.fn().mockResolvedValue(undefined);
    render(
      <AvailabilityRegistrationPanel
        {...baseProps}
        onUpdateAvailabilityPolicy={onUpdateAvailabilityPolicy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Thiết lập đăng ký" }));
    fireEvent.change(screen.getByDisplayValue("Thủ công"), { target: { value: "auto" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));

    expect(onUpdateAvailabilityPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        availabilityRegistrationMode: "auto",
        availabilityOpenDayOffset: -7,
        availabilityOpenTime: "09:00",
        availabilityCloseDayOffset: -1,
        availabilityCloseTime: "18:00",
      }),
    );
  });


  it("renders late-change setting and options in policy modal", () => {
    render(<AvailabilityRegistrationPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Thiết lập đăng ký" }));

    expect(screen.getByText("Thay đổi sau khi đóng đăng ký")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cho phép gửi yêu cầu chờ duyệt" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Không cho gửi sau khi đóng" })).toBeInTheDocument();
  });

  it("saves lateChangeRequiresApproval false", () => {
    const onUpdateAvailabilityPolicy = vi.fn().mockResolvedValue(undefined);
    render(<AvailabilityRegistrationPanel {...baseProps} onUpdateAvailabilityPolicy={onUpdateAvailabilityPolicy} />);

    fireEvent.click(screen.getByRole("button", { name: "Thiết lập đăng ký" }));
    fireEvent.change(screen.getByDisplayValue("Cho phép gửi yêu cầu chờ duyệt"), { target: { value: "no" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));

    expect(onUpdateAvailabilityPolicy).toHaveBeenCalledWith(expect.objectContaining({ lateChangeRequiresApproval: false }));
  });

  it("shows summary rule when late change is blocked", () => {
    render(
      <AvailabilityRegistrationPanel
        {...baseProps}
        availabilityPolicy={{ ...baseProps.availabilityPolicy, lateChangeRequiresApproval: false }}
      />,
    );

    expect(screen.getByText(/Thay đổi sau khi đóng: Không cho gửi/i)).toBeInTheDocument();
  });

  it("disables manual actions in auto mode", () => {
    render(
      <AvailabilityRegistrationPanel
        {...baseProps}
        availabilityWindow={{ ...baseProps.availabilityWindow, registrationMode: "auto", status: "open" }}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Mở( lại)? đăng ký/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đóng đăng ký" })).toBeDisabled();
  });

  it("renders pending late-change section and confirms approve flow in modal", async () => {
    const onReviewSubmission = vi.fn().mockResolvedValue(undefined);
    render(
      <AvailabilityRegistrationPanel
        {...baseProps}
        submissions={[{
          id: "sub-1",
          employeeId: "e1",
          employmentType: "part_time",
          status: "late_change_requested",
          submittedAt: "2026-05-01T00:00:00.000Z",
          slots: [],
          pendingSlots: [{ date: "2026-05-12T00:00:00.000Z", shiftType: "morning", status: "available", note: "" }],
        }]}
        onReviewSubmission={onReviewSubmission}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Xem đăng ký/i }));
    expect(screen.getByText("Yêu cầu thay đổi muộn")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Duyệt thay đổi" }));
    const modalHeading = screen.getByRole("heading", { name: /Duyệt thay đổi muộn/i });
    const modal = modalHeading.closest(".availability-review-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText("Lịch rảnh hiện tại")).toBeInTheDocument();
    expect(within(modal).getByText("Yêu cầu thay đổi muộn")).toBeInTheDocument();

    fireEvent.click(within(modal).getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(onReviewSubmission).toHaveBeenCalledWith("sub-1", true, "");
    });
  });

  it("renders pending late-change section and validates reject flow in modal", async () => {
    const onReviewSubmission = vi.fn().mockResolvedValue(undefined);
    render(
      <AvailabilityRegistrationPanel
        {...baseProps}
        submissions={[{
          id: "sub-1",
          employeeId: "e1",
          employmentType: "part_time",
          status: "late_change_requested",
          submittedAt: "2026-05-01T00:00:00.000Z",
          slots: [],
          pendingSlots: [{ date: "2026-05-12T00:00:00.000Z", shiftType: "morning", status: "available", note: "" }],
        }]}
        onReviewSubmission={onReviewSubmission}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Xem đăng ký/i }));
    fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));

    const modalHeading = screen.getByRole("heading", { name: /Từ chối thay đổi muộn/i });
    const modal = modalHeading.closest(".availability-review-modal");
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText("Lý do từ chối *")).toBeInTheDocument();

    fireEvent.click(within(modal).getByRole("button", { name: "Xác nhận" }));

    expect(within(modal).getByText("Vui lòng nhập lý do từ chối.")).toBeInTheDocument();
    expect(onReviewSubmission).not.toHaveBeenCalled();

    fireEvent.change(within(modal).getByRole("textbox"), { target: { value: "Không phù hợp nhu cầu ca." } });
    fireEvent.click(within(modal).getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(onReviewSubmission).toHaveBeenCalledWith("sub-1", false, "Không phù hợp nhu cầu ca.");
    });
  });

  it("shows only one primary CTA when no window and reminder is active", () => {
    render(
      <AvailabilityRegistrationPanel
        {...baseProps}
        availabilityWindow={null}
        shouldRemindNextWeekRegistration
      />,
    );
    expect(screen.getByRole("button", { name: "Mở đăng ký tuần tới" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở đăng ký tuần sau" })).not.toBeInTheDocument();
  });

  it("shows open label for draft and reopen label for closed", () => {
    const { rerender } = render(<AvailabilityRegistrationPanel {...baseProps} availabilityWindow={{ ...baseProps.availabilityWindow, status: "draft" }} />);
    expect(screen.getByRole("button", { name: "Mở đăng ký" })).toBeInTheDocument();
    rerender(<AvailabilityRegistrationPanel {...baseProps} availabilityWindow={{ ...baseProps.availabilityWindow, status: "closed" }} />);
    expect(screen.getByRole("button", { name: "Mở lại đăng ký" })).toBeInTheDocument();
  });

});
