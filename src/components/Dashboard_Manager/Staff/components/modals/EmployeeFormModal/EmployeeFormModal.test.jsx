import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmployeeFormModal from "./EmployeeFormModal";

const testMocks = vi.hoisted(() => ({
  showNotification: vi.fn(),
  getLegalSalaryReference: vi.fn(async () => ({
    year: 2026,
    decreeName: "Ref",
    decreeUrl: "https://example.com/decree",
    articleUrl: "https://example.com/article",
    probationRuleUrl: "https://example.com/probation",
    monthlyMinimum: 5_310_000,
    hourlyMinimum: 25_500,
    isLive: false,
  })),
}));

vi.mock("../../../../../common/Modal", () => ({
  default: ({
    isOpen,
    children,
    onClose,
    closeOnOverlayClick = true,
  }) =>
    isOpen ? (
      <div>
        <button
          type="button"
          onClick={() => {
            if (closeOnOverlayClick) onClose?.();
          }}
        >
          Overlay
        </button>
        {children}
      </div>
    ) : null,
}));

vi.mock("../../../../../common/LoadingSpinner", () => ({
  default: () => <div>loading</div>,
}));

vi.mock("../../../../../../hooks/useNotification", () => ({
  useNotification: () => ({
    showNotification: testMocks.showNotification,
  }),
}));

vi.mock("../../../../../../utils/legalSalaryReference", async () => {
  const actual = await vi.importActual(
    "../../../../../../utils/legalSalaryReference",
  );
  return {
    ...actual,
    getLegalSalaryReference: testMocks.getLegalSalaryReference,
  };

  it("blocks submit when roleList has not loaded", async () => {
    const onSubmit = vi.fn(async () => ({ id: "staff-1" }));
    render(<ModalHarness onSubmit={onSubmit} roleList={[]} />);

    fireEvent.change(screen.getByPlaceholderText("Nguyễn Văn A"), {
      target: { value: "Nguyen Test" },
    });
    fireEvent.change(screen.getByLabelText("Nhà hàng chính"), {
      target: { value: "rest-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("Danh sách vai trò chưa tải xong. Vui lòng thử lại sau vài giây."),
    ).toBeInTheDocument();
  });

  it("blocks submit when selected roleSlug host is missing from roleList", async () => {
    const onSubmit = vi.fn(async () => ({ id: "staff-1" }));
    render(
      <ModalHarness
        onSubmit={onSubmit}
        roleList={[{ id: "r-server", slug: "server", name: "Server" }]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Nguyễn Văn A"), {
      target: { value: "Nguyen Test" },
    });
    fireEvent.change(screen.getByLabelText("Nhà hàng chính"), {
      target: { value: "rest-1" },
    });
    fireEvent.change(screen.getByLabelText("Vai trò"), {
      target: { value: "host" },
    });

    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Vai trò đã chọn chưa được cấu hình trong hệ thống. Vui lòng seed roles hoặc chọn vai trò khác.",
      ),
    ).toBeInTheDocument();
  });

  it("does not close modal when clicking overlay", () => {
    render(<ModalHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Overlay" }));

    expect(screen.getByRole("heading", { name: /thêm nhân viên mới/i })).toBeInTheDocument();
  });

});

const TEST_ROLE_LIST = [
  { id: "r-server", slug: "server", name: "Server" },
  { id: "r-supervisor", slug: "supervisor", name: "Supervisor" },
  { id: "r-host", slug: "host", name: "Host" },
];

function ModalHarness({
  onSubmit = vi.fn(async () => {}),
  roleList = TEST_ROLE_LIST,
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <EmployeeFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        restaurantList={[{ id: "rest-1", name: "Chi nhánh 1" }]}
        roleList={roleList}
      />
    </div>
  );
}

const getDraftKeys = () =>
  Object.keys(window.localStorage).filter((key) =>
    key.includes("employee-form-modal"),
  );

const fillStepOneAndGoNext = () => {
  const stepOneInputs = screen.getAllByRole("textbox");
  fireEvent.change(stepOneInputs[0], { target: { value: "Nguyen Test" } });
  fireEvent.change(screen.getByLabelText("Nhà hàng chính"), {
    target: { value: "rest-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));
};

describe("EmployeeFormModal draft lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("does not create a draft when the modal is opened and closed without input", async () => {
    render(<ModalHarness />);

    await waitFor(() => {
      expect(testMocks.getLegalSalaryReference).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /hủy bỏ/i }));

    expect(getDraftKeys()).toHaveLength(0);
  });

  it("does not create a draft when only the AI role suggestion is applied", async () => {
    render(<ModalHarness />);

    fireEvent.click(screen.getByRole("button", { name: /dùng gợi ý/i }));
    fireEvent.click(screen.getByRole("button", { name: /hủy bỏ/i }));

    expect(getDraftKeys()).toHaveLength(0);
  });

  it("stores and restores a real draft, then clears it after submit", async () => {
    const onSubmit = vi.fn(async () => ({ id: "staff-1" }));

    render(<ModalHarness onSubmit={onSubmit} />);

    const stepOneInputs = screen.getAllByRole("textbox");
    fireEvent.change(stepOneInputs[0], { target: { value: "Nguyen Test" } });
    fireEvent.click(screen.getByRole("button", { name: /dùng gợi ý/i }));
    fireEvent.change(screen.getByLabelText("Nhà hàng chính"), {
      target: { value: "rest-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /hủy bỏ/i }));

    expect(getDraftKeys()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /reopen/i }));

    expect(
      screen.getByText("Có dữ liệu nhân viên nhập dở. Khôi phục?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));
    expect(screen.getByDisplayValue("Nguyen Test")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));
    fireEvent.change(screen.getByLabelText("Số điện thoại"), {
      target: { value: "0912345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));
    fireEvent.click(screen.getByRole("button", { name: /hoàn tất/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(getDraftKeys()).toHaveLength(0);
  });

  it("blocks submit when roleList has not loaded", async () => {
    const onSubmit = vi.fn(async () => ({ id: "staff-1" }));
    render(<ModalHarness onSubmit={onSubmit} roleList={[]} />);

    fillStepOneAndGoNext();
    fireEvent.change(screen.getByPlaceholderText("09..."), {
      target: { value: "0912345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));
    fireEvent.click(screen.getByRole("button", { name: /hoàn tất/i }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /quay lại/i }));
    fireEvent.click(screen.getByRole("button", { name: /quay lại/i }));
    expect(
      screen.getByText(
        "Vai trò đã chọn chưa được cấu hình hoặc bạn không có quyền tải danh sách vai trò. Vui lòng thử lại.",
      ),
    ).toBeInTheDocument();
  });

  it("blocks submit when selected roleSlug host is missing from roleList", async () => {
    const onSubmit = vi.fn(async () => ({ id: "staff-1" }));
    render(
      <ModalHarness
        onSubmit={onSubmit}
        roleList={[{ id: "r-server", slug: "server", name: "Server" }]}
      />,
    );

    const roleSelect = screen.getByLabelText("Vai trò");
    fireEvent.change(roleSelect, { target: { value: "host" } });

    fillStepOneAndGoNext();
    fireEvent.change(screen.getByPlaceholderText("09..."), {
      target: { value: "0912345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));
    fireEvent.click(screen.getByRole("button", { name: /hoàn tất/i }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /quay lại/i }));
    fireEvent.click(screen.getByRole("button", { name: /quay lại/i }));
    expect(
      screen.getByText(
        "Vai trò đã chọn chưa được cấu hình hoặc bạn không có quyền tải danh sách vai trò. Vui lòng thử lại.",
      ),
    ).toBeInTheDocument();
  });

  it("does not close modal when clicking overlay", () => {
    render(<ModalHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Overlay" }));

    expect(screen.getByRole("heading", { name: /thêm nhân viên mới/i })).toBeInTheDocument();
  });
});
