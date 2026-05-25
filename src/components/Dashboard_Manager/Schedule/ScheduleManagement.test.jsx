import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScheduleManagement from "./ScheduleManagement";

let mockMeData;
let mockRestaurantData;
let mockStaffData;
let mockShiftsData;
let mockDeclinedShiftAcksData;
let mockDeclinedShiftAcksError;
let mockDeclinedShiftAcksLoading;
let capturedDeclinedShiftAckVariables;
let mockAvailabilityWindowsData;
let mockAvailabilitySubmissionsData;
let mockManagerShiftAttendancesData;
let mutationSpy;
let lazyQuerySpy;
const getFirstShiftCard = async () => {
  const shiftCards = await screen.findAllByRole("button", {
    name: /Xem chi tiết ca/i,
  });
  return shiftCards[0];
};

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  const safeResult = { data: null, loading: false, error: null, refetch: vi.fn() };

  return {
    ...actual,
    useQuery: vi.fn((query, queryOptions) => {
      const body = query?.loc?.source?.body || "";

      if (body.includes("query Me")) {
        return { data: mockMeData, loading: false, error: null };
      }

      if (body.includes("query AllRestaurants")) {
        return { data: mockRestaurantData, loading: false, error: null };
      }

      if (body.includes("query StaffList")) {
        return { data: mockStaffData, loading: false, error: null };
      }

      if (body.includes("query StaffShifts")) {
        return {
          data: mockShiftsData,
          loading: false,
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        };
      }
      if (body.includes("query ShiftAcknowledgements")) {
        capturedDeclinedShiftAckVariables = queryOptions?.variables;
        return {
          data: mockDeclinedShiftAcksData,
          loading: mockDeclinedShiftAcksLoading,
          error: mockDeclinedShiftAcksError,
          refetch: vi.fn(),
        };
      }
      if (body.includes("query ScheduleAvailabilityWindows")) {
        return {
          data: mockAvailabilityWindowsData,
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (body.includes("query ScheduleAvailabilitySubmissions")) {
        return {
          data: mockAvailabilitySubmissionsData,
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (body.includes("query ManagerShiftAttendances")) {
        return {
          data: mockManagerShiftAttendancesData,
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (body.includes("query SchedulePublication")) return safeResult;
      if (body.includes("query ScheduleAcknowledgementSummary")) return safeResult;
      if (body.includes("query ManagerRestaurants")) return safeResult;
      if (body.includes("query ManagerScheduleWeekAvailabilitySubmissions")) return safeResult;
      if (body.includes("query ScheduleChangeLogs")) return safeResult;

      return safeResult;
    }),
    useLazyQuery: vi.fn(() => [lazyQuerySpy, { loading: false, error: null, data: null, called: false }]),
    useMutation: vi.fn((mutation) => {
      const body = mutation?.loc?.source?.body || "";
      if (body.includes("mutation ApplyAutoSchedule")) {
        return [mutationSpy, { loading: false, error: null, data: null }];
      }
      return [mutationSpy, { loading: false, error: null, data: null }];
    }),
  };
});

describe("ScheduleManagement", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-04-20T08:00:00.000Z"));
    lazyQuerySpy = vi.fn().mockResolvedValue({ data: null });
    mutationSpy = vi.fn().mockResolvedValue({});
    mockMeData = {
      me: {
        id: "manager-1",
        roleName: "owner",
        restaurantForStaff: "restaurant-1",
        refRestaurants: [{ id: "restaurant-1", name: "Chi nhánh A" }],
      },
    };
    mockRestaurantData = null;
    mockStaffData = {
      staffList: [
        {
          id: "staff-1",
          fullName: "Lan Manager",
          employeeCode: "MN001",
          department: "management",
          employmentStatus: "working",
          workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
          baseSalary: 13000000,
        },
        {
          id: "staff-2",
          fullName: "Minh Server",
          employeeCode: "SV001",
          department: "service",
          employmentStatus: "working",
          workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
          baseSalary: 8000000,
        },
      ],
    };
    mockShiftsData = {
      staffShifts: [
        {
          id: "shift-row-1",
          employeeId: "staff-1",
          employeeName: "Lan Manager",
          restaurantId: "restaurant-1",
          shiftType: "morning",
          startTime: "2026-04-20T06:00:00.000Z",
          endTime: "2026-04-20T14:00:00.000Z",
          status: "scheduled",
          notes: "Ca quản lý đầu tuần",
        },
      ],
    };
    mockDeclinedShiftAcksData = {
      shiftAcknowledgements: [
        {
          id: "ack-1",
          shiftId: "shift-row-1",
          employeeId: "staff-1",
          employeeName: "Lan Manager",
          employeeCode: "MN001",
          shiftType: "morning",
          shiftStartTime: "2026-04-20T06:00:00.000Z",
          shiftEndTime: "2026-04-20T14:00:00.000Z",
          reasonCategory: "sick",
          reason: "Bị ốm",
          declineClassification: "unknown",
        },
      ],
    };
    mockDeclinedShiftAcksError = null;
    mockDeclinedShiftAcksLoading = false;
    capturedDeclinedShiftAckVariables = null;
    mockAvailabilityWindowsData = {
      availabilityWindows: [],
    };
    mockAvailabilitySubmissionsData = {
      availabilitySubmissions: [],
    };
    mockManagerShiftAttendancesData = {
      managerShiftAttendances: [],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });


  it("does not crash when schedule quality summary reads staff shifts", () => {
    mockShiftsData = undefined;

    expect(() => render(<ScheduleManagement />)).not.toThrow();
    expect(screen.getByText("Chất lượng lịch tuần")).toBeInTheDocument();
  });

  it("keeps the staff schedule tab in read-only mode", async () => {
    render(<ScheduleManagement readOnly />);

    expect(screen.getByText("Thông Tin Ca Làm Việc")).toBeInTheDocument();
    const readOnlyPublishButton = screen.queryByRole("button", { name: /Công bố lịch/i });
    if (readOnlyPublishButton) {
      expect(readOnlyPublishButton).toBeDisabled();
    } else {
      expect(readOnlyPublishButton).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /\+ Sáng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chia ca tự động/i })).not.toBeInTheDocument();

    const shiftCard = await getFirstShiftCard();
    fireEvent.click(shiftCard);

    expect(screen.getByDisplayValue("Ca quản lý đầu tuần")).toBeDisabled();
    expect(screen.queryByText("Thêm nhân sự")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xóa Ca/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lưu ghi chú/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đóng/i })).toBeInTheDocument();
  });

  it("creates a real shift payload from the add-shift modal", async () => {
    mockShiftsData = { staffShifts: [] };

    render(<ScheduleManagement />);
    mutationSpy.mockClear();

    fireEvent.click(screen.getAllByRole("button", { name: /Tạo ca Sáng/i })[0]);
    const modal = await waitFor(() => {
      const node = document.body.querySelector(".modal-container");
      expect(node).toBeTruthy();
      return node;
    });
    const selectableStaff = within(modal).getByText("Lan Manager").closest(".staff-item");
    expect(selectableStaff).toBeTruthy();
    fireEvent.click(selectableStaff);
    fireEvent.click(within(modal).getByRole("button", { name: /Lưu\s*&\s*Tạo\s*Lịch|Lưu|Tạo lịch|Tạo ca/i }));

    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    const createCall = mutationSpy.mock.calls.find(
      ([arg]) => arg?.variables?.input?.shiftType === "MORNING",
    )?.[0];
    expect(createCall).toBeTruthy();

    expect(createCall.variables.input.employeeId).toBe("staff-1");
    expect(createCall.variables.input.restaurantId).toBe("restaurant-1");
    expect(createCall.variables.input.shiftType).toBe("MORNING");
    expect(createCall.variables.input.status).toBe("scheduled");
    expect(new Date(createCall.variables.input.startTime).toString()).not.toBe("Invalid Date");
    expect(new Date(createCall.variables.input.endTime).toString()).not.toBe("Invalid Date");
  });

  it("deletes a shift group through the detail modal", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ScheduleManagement />);

    const shiftCard = await getFirstShiftCard();
    fireEvent.click(shiftCard);
    mutationSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Xóa Ca|Xóa ca|Xóa nhóm ca/i }));

    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalled();
    const deleteCall = mutationSpy.mock.calls.find(([arg]) => arg?.variables?.shiftId === "shift-row-1")?.[0];
    expect(deleteCall).toEqual({
      variables: { shiftId: "shift-row-1" },
    });
  });

  it("updates start and end time for the whole grouped shift", async () => {
    render(<ScheduleManagement />);

    const shiftCard = await getFirstShiftCard();
    fireEvent.click(shiftCard);
    const modal = await waitFor(() => {
      const node = document.body.querySelector(".modal-container");
      expect(node).toBeTruthy();
      return node;
    });
    mutationSpy.mockClear();
    fireEvent.click(within(modal).getByRole("button", { name: /Đổi giờ ca|Cập nhật giờ/i }));
    fireEvent.change(screen.getByLabelText(/Giờ bắt đầu/i), { target: { value: "07:30" } });
    fireEvent.change(screen.getByLabelText(/Giờ kết thúc/i), { target: { value: "15:30" } });
    fireEvent.change(screen.getByLabelText(/Lý do thay đổi/i), { target: { value: "Điều chỉnh vận hành" } });
    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra & lưu/i }));

    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    const updateCall = mutationSpy.mock.calls.find(
      ([arg]) => arg?.variables?.shiftId === "shift-row-1" && arg?.variables?.input?.startTime,
    )?.[0];
    expect(updateCall).toBeTruthy();

    expect(updateCall.variables.shiftId).toBe("shift-row-1");
    expect(updateCall.variables.input).toEqual(
      expect.objectContaining({
        startTime: expect.any(String),
        endTime: expect.any(String),
      })
    );
    expect(new Date(updateCall.variables.input.endTime).getTime()).toBeGreaterThan(
      new Date(updateCall.variables.input.startTime).getTime()
    );
  });

  it("shows a validation message when start and end time are identical", async () => {
    render(<ScheduleManagement />);

    const shiftCard = await getFirstShiftCard();
    fireEvent.click(shiftCard);
    const modal = await waitFor(() => {
      const node = document.body.querySelector(".modal-container");
      expect(node).toBeTruthy();
      return node;
    });
    mutationSpy.mockClear();
    fireEvent.click(within(modal).getByRole("button", { name: /Đổi giờ ca|Cập nhật giờ/i }));
    fireEvent.change(screen.getByLabelText(/Giờ bắt đầu/i), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText(/Giờ kết thúc/i), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText(/Lý do thay đổi/i), { target: { value: "Điều chỉnh vận hành" } });
    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra & lưu/i }));

    expect(await screen.findByText("Giờ kết thúc phải khác giờ bắt đầu.")).toBeInTheDocument();
    expect(mutationSpy).not.toHaveBeenCalled();
  });

  it("renders compact publish modal summary and keeps footer actions visible", async () => {
    render(<ScheduleManagement />);

    const publishTrigger = screen
      .getAllByRole("button", { name: /Công bố lịch|Công bố lại/i })
      .find((button) => !button.hasAttribute("disabled"));
    expect(publishTrigger).toBeTruthy();
    fireEvent.click(publishTrigger);

    const modal = await waitFor(() => {
      const node = document.body.querySelector(".modal-container");
      expect(node).toBeTruthy();
      return node;
    });

    expect(within(modal).getByText("Xác nhận công bố lịch")).toBeInTheDocument();
    expect(within(modal).getByText("Phạm vi")).toBeInTheDocument();
    expect(within(modal).getByText("Trạng thái hiện tại")).toBeInTheDocument();
    expect(within(modal).getByText("Số nhóm ca")).toBeInTheDocument();
    expect(within(modal).getByText("Tổng phân công")).toBeInTheDocument();
    expect(
      within(modal).getByText("Tôi đã kiểm tra các cảnh báo và xác nhận công bố lịch.")
    ).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Hủy" })).toBeInTheDocument();
    const publishButton = within(modal).getByRole("button", { name: "Công bố lịch" });
    expect(publishButton).toBeDisabled();

    fireEvent.click(within(modal).getByRole("checkbox"));
    expect(publishButton).not.toBeDisabled();
  });

  it("hides decline review action buttons in read-only mode", () => {
    render(<ScheduleManagement readOnly />);
    expect(screen.queryByRole("button", { name: "Chấp nhận lý do" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Không duyệt lý do" })).not.toBeInTheDocument();
    expect(screen.getByText("Chế độ chỉ xem: không thể duyệt lý do từ chối.")).toBeInTheDocument();
  });

  it("unknown decline shows both review buttons", () => {
    render(<ScheduleManagement />);
    expect(screen.getByRole("button", { name: "Chấp nhận lý do" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Không duyệt lý do" })).toBeInTheDocument();
  });

  it("does not show raw IDs as primary display when enriched fields are available", () => {
    render(<ScheduleManagement />);
    expect(screen.getByText(/Ca bị từ chối \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Nhân viên:/)).toBeInTheDocument();
    expect(screen.getByText(/Lan Manager - MN001/)).toBeInTheDocument();
    expect(screen.getByText("Lý do: Bị ốm")).toBeInTheDocument();
    expect(screen.queryByText("Ca: shift-row-1")).not.toBeInTheDocument();
  });

  it("valid decline hides review buttons and shows open shift CTA", () => {
    mockDeclinedShiftAcksData.shiftAcknowledgements[0].declineClassification = "valid";
    render(<ScheduleManagement />);
    expect(screen.queryByRole("button", { name: "Chấp nhận lý do" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Không duyệt lý do" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở ca để xử lý" })).toBeInTheDocument();
  });

  it("invalid decline hides review buttons and shows expected assignment helper", () => {
    mockDeclinedShiftAcksData.shiftAcknowledgements[0].declineClassification = "invalid";
    render(<ScheduleManagement />);
    expect(screen.queryByRole("button", { name: "Chấp nhận lý do" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Không duyệt lý do" })).not.toBeInTheDocument();
    expect(screen.getByText("Nhân viên vẫn được kỳ vọng đi làm ca này.")).toBeInTheDocument();
  });

  it("late decline hides review buttons", () => {
    mockDeclinedShiftAcksData.shiftAcknowledgements[0].declineClassification = "late";
    render(<ScheduleManagement />);
    expect(screen.queryByRole("button", { name: "Chấp nhận lý do" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Không duyệt lý do" })).not.toBeInTheDocument();
    expect(screen.getByText("Từ chối muộn - không thể duyệt lại trong màn này.")).toBeInTheDocument();
  });

  it("clicking accept reason triggers valid review mutation", async () => {
    render(<ScheduleManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Chấp nhận lý do" }));
    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    expect(mutationSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        variables: { input: { acknowledgementId: "ack-1", classification: "valid" } },
      }),
    );
  });

  it("clicking reject reason triggers invalid review mutation", async () => {
    render(<ScheduleManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Không duyệt lý do" }));
    await waitFor(() => expect(mutationSpy).toHaveBeenCalled());
    expect(mutationSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        variables: { input: { acknowledgementId: "ack-1", classification: "invalid" } },
      }),
    );
  });

  it("hides declined panel when acknowledgement query returns empty", () => {
    mockDeclinedShiftAcksData = { shiftAcknowledgements: [] };
    render(<ScheduleManagement />);
    expect(screen.queryByText(/Ca bị từ chối \(0\)/)).not.toBeInTheDocument();
  });

  it("shows GraphQL error for declined acknowledgement query", () => {
    mockDeclinedShiftAcksData = undefined;
    mockDeclinedShiftAcksError = new Error("FORBIDDEN_SCOPE");
    render(<ScheduleManagement />);
    expect(screen.getByText(/Không thể tải ca bị từ chối: FORBIDDEN_SCOPE/)).toBeInTheDocument();
  });

  it("updates declined acknowledgement query period when changing week", () => {
    render(<ScheduleManagement />);
    const firstPeriodStart = capturedDeclinedShiftAckVariables?.periodStart;
    fireEvent.click(screen.getByRole("button", { name: /Sau/i }));
    expect(capturedDeclinedShiftAckVariables?.periodStart).not.toBe(firstPeriodStart);
    expect(capturedDeclinedShiftAckVariables?.periodEnd).toBeTruthy();
  });

  it("opens finalized availability modal", async () => {
    mockAvailabilityWindowsData = {
      availabilityWindows: [
        {
          id: "window-finalized",
          status: "closed",
          effectiveStatus: "closed",
          periodStart: "2026-04-20T00:00:00.000Z",
          periodEnd: "2026-04-26T23:59:59.000Z",
          registrationMode: "manual",
        },
      ],
    };
    render(<ScheduleManagement />);
    fireEvent.click(screen.getByRole("button", { name: /Lịch rảnh đã chốt/i }));
    const modal = await waitFor(() => {
      const node = document.body.querySelector(".modal-container");
      expect(node).toBeTruthy();
      return node;
    });
    expect(modal.textContent).toMatch(/Đăng ký lịch nhân viên|Tuần áp dụng|Lịch rảnh đã chốt/i);
  });

  it("renders board section before availability panel", () => {
    const { container } = render(<ScheduleManagement />);
    const board = container.querySelector(".schedule-board");
    const availabilityPanel = container.querySelector(".schedule-availability-panel");
    expect(board).toBeTruthy();
    expect(availabilityPanel).toBeTruthy();
    expect(board.compareDocumentPosition(availabilityPanel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("collapsed availability by default for closed-like window status", async () => {
    mockAvailabilityWindowsData = {
      availabilityWindows: [
        {
          id: "window-1",
          status: "closed",
          effectiveStatus: "closed",
          periodStart: "2026-04-27T00:00:00.000Z",
          periodEnd: "2026-05-03T23:59:59.000Z",
          registrationMode: "manual",
        },
      ],
    };
    render(<ScheduleManagement />);
    await screen.findByRole("button", { name: /Lịch rảnh đã chốt/i });
    expect(
      screen.queryByText("Quản lý thời gian nhân viên đăng ký khả dụng trước khi xếp lịch."),
    ).not.toBeInTheDocument();
  });

  it("manual collapse/expand toggle still works for availability panel", async () => {
    mockAvailabilityWindowsData = {
      availabilityWindows: [
        {
          id: "window-2",
          status: "open",
          effectiveStatus: "open",
          periodStart: "2026-04-27T00:00:00.000Z",
          periodEnd: "2026-05-03T23:59:59.000Z",
          registrationMode: "manual",
        },
      ],
    };
    render(<ScheduleManagement />);
    const collapseBtn = await screen.findByRole("button", {
      name: "Thu gọn đăng ký lịch nhân viên",
    });
    fireEvent.click(collapseBtn);
    expect(await screen.findByRole("button", { name: "Mở rộng" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở rộng" }));
    expect(
      await screen.findByRole("button", { name: "Thu gọn đăng ký lịch nhân viên" }),
    ).toBeInTheDocument();
  });

  it("resets manual availability collapse when changing week context", async () => {
    mockAvailabilityWindowsData = {
      availabilityWindows: [
        {
          id: "window-week-1",
          status: "open",
          effectiveStatus: "open",
          periodStart: "2026-04-27T00:00:00.000Z",
          periodEnd: "2026-05-03T23:59:59.000Z",
          registrationMode: "manual",
        },
      ],
    };
    render(<ScheduleManagement />);
    fireEvent.click(await screen.findByRole("button", { name: "Thu gọn đăng ký lịch nhân viên" }));
    expect(await screen.findByRole("button", { name: "Mở rộng" })).toBeInTheDocument();

    mockAvailabilityWindowsData = {
      availabilityWindows: [
        {
          id: "window-week-2",
          status: "open",
          effectiveStatus: "open",
          periodStart: "2026-05-04T00:00:00.000Z",
          periodEnd: "2026-05-10T23:59:59.000Z",
          registrationMode: "manual",
        },
      ],
    };
    fireEvent.click(screen.getByRole("button", { name: /Sau/i }));
    expect(
      await screen.findByRole("button", { name: "Thu gọn đăng ký lịch nhân viên" }),
    ).toBeInTheDocument();
  });

  it("shows inline error for synthetic attendance rows instead of opening modal", async () => {
    mockManagerShiftAttendancesData = {
      managerShiftAttendances: [
        {
          id: "shift-1",
          employeeId: "staff-1",
          status: "scheduled",
          checkInAt: null,
          checkOutAt: null,
          employeeName: "Lan Manager",
          employeeCode: "MN001",
          shiftStartTime: "2026-04-20T06:00:00.000Z",
          shiftEndTime: "2026-04-20T14:00:00.000Z",
          shiftType: "morning",
          isLate: false,
          reviewNote: null,
        },
      ],
    };
    render(<ScheduleManagement />);
    fireEvent.click(await screen.findByRole("button", { name: "Ghi chú xử lý" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Ca chưa có bản ghi chấm công; hãy yêu cầu nhân viên check-in hoặc tạo điều chỉnh chấm công.",
      ),
    ).toBeInTheDocument();
  });

  it("opens attendance review modal and submits note without window.prompt", async () => {
    mockManagerShiftAttendancesData = {
      managerShiftAttendances: [
        {
          id: "attendance-1",
          employeeId: "staff-1",
          status: "checked_in",
          checkInAt: "2026-04-20T06:20:00.000Z",
          checkOutAt: null,
          employeeName: "Lan Manager",
          employeeCode: "MN001",
          shiftStartTime: "2026-04-20T06:00:00.000Z",
          shiftEndTime: "2026-04-20T07:00:00.000Z",
          shiftType: "morning",
          isLate: true,
          reviewNote: "Manager review: Đã nhắc nhân viên đi đúng giờ.",
        },
      ],
    };
    render(<ScheduleManagement />);
    mutationSpy.mockClear();

    fireEvent.click(await screen.findByRole("button", { name: /Đã ghi chú \(1\)/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Ghi chú xử lý" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Đã ghi chú xử lý")).toBeInTheDocument();
    expect(screen.getByText(/Ghi chú trước đó:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(await screen.findByText("Ghi chú xử lý cần tối thiểu 5 ký tự.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nhập ghi chú xử lý..."), {
      target: { value: "Đã nhắc nhở nhân viên." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));

    await waitFor(() =>
      expect(mutationSpy).toHaveBeenCalledWith({
        variables: { attendanceId: "attendance-1", note: "Đã nhắc nhở nhân viên." },
      }),
    );
  });
  it("filters attendance issues by review note status", async () => {
    mockManagerShiftAttendancesData = {
      managerShiftAttendances: [
        {
          id: "attendance-unreviewed",
          employeeId: "staff-1",
          status: "checked_in",
          checkInAt: "2026-04-20T06:10:00.000Z",
          checkOutAt: null,
          employeeName: "Lan Manager",
          employeeCode: "MN001",
          shiftStartTime: "2026-04-20T06:00:00.000Z",
          shiftEndTime: "2026-04-20T07:00:00.000Z",
          shiftType: "morning",
          isLate: true,
          reviewNote: null,
        },
        {
          id: "attendance-reviewed",
          employeeId: "staff-2",
          status: "checked_in",
          checkInAt: "2026-04-20T06:15:00.000Z",
          checkOutAt: null,
          employeeName: "Minh Server",
          employeeCode: "SV001",
          shiftStartTime: "2026-04-20T06:00:00.000Z",
          shiftEndTime: "2026-04-20T07:00:00.000Z",
          shiftType: "morning",
          isLate: true,
          reviewNote: "Đã nhắc nhở trước đó.",
        },
      ],
    };

    render(<ScheduleManagement />);

    expect(await screen.findByRole("button", { name: /Cần xử lý \(1\)/i })).toBeInTheDocument();
    expect(screen.getByText(/MN001/i)).toBeInTheDocument();
    expect(screen.queryByText(/SV001/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Đã ghi chú \(1\)/i }));
    expect(await screen.findByText(/SV001/i)).toBeInTheDocument();
    expect(screen.getByText("Đã ghi chú xử lý")).toBeInTheDocument();
    expect(screen.queryByText(/MN001/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tất cả \(2\)/i }));
    expect(await screen.findByText(/MN001/i)).toBeInTheDocument();
    expect(screen.getByText(/SV001/i)).toBeInTheDocument();
  });


});
