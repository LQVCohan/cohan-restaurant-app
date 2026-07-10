import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  default: ({ isOpen, children, onClose, closeOnOverlayClick = true }) =>
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
});

const TEST_ROLE_LIST = [
  { id: "r-server", slug: "server", name: "Server" },
  { id: "r-supervisor", slug: "supervisor", name: "Supervisor" },
  { id: "r-host", slug: "host", name: "Host" },
];

const createMemoryStorage = () => {
  const items = new Map();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) =>
      items.has(String(key)) ? items.get(String(key)) : null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => items.delete(String(key)),
    setItem: (key, value) => items.set(String(key), String(value)),
  };
};

function ModalHarness({
  onSubmit = vi.fn(async () => {}),
  roleList = TEST_ROLE_LIST,
  roleListLoading = false,
  roleListError = null,
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
        roleListLoading={roleListLoading}
        roleListError={roleListError}
      />
    </div>
  );
}

const getDraftKeys = () =>
  Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index),
  ).filter((key) => key?.includes("employee-form-modal"));

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
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    fireEvent.change(screen.getByPlaceholderText("09..."), {
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
    render(
      <ModalHarness onSubmit={onSubmit} roleList={[]} roleListLoading={true} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Nguyễn Văn A"), {
      target: { value: "Nguyen Test" },
    });
    fireEvent.change(screen.getByLabelText("Nhà hàng chính"), {
      target: { value: "rest-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Danh sách vai trò chưa tải xong. Vui lòng thử lại sau vài giây.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /thông tin cơ bản/i }),
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

    fireEvent.change(screen.getByLabelText("Vai trò"), {
      target: { value: "host" },
    });

    fireEvent.change(screen.getByPlaceholderText("Nguyễn Văn A"), {
      target: { value: "Nguyen Test" },
    });
    fireEvent.change(screen.getByLabelText("Nhà hàng chính"), {
      target: { value: "rest-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /tiếp theo/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /thông tin cơ bản/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Vai trò đã chọn chưa được cấu hình trong hệ thống, vui lòng chọn vai trò khác.",
      ),
    ).toBeInTheDocument();
  });

  it("does not close modal when clicking overlay", () => {
    render(<ModalHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Overlay" }));

    expect(
      screen.getByRole("heading", { name: /thêm nhân viên mới/i }),
    ).toBeInTheDocument();
  });
});
