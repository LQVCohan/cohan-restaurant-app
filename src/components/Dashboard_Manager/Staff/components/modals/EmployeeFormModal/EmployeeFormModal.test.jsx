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
  default: ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null),
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

function ModalHarness({ onSubmit = vi.fn(async () => {}) }) {
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
      />
    </div>
  );
}

const getDraftKeys = () =>
  Object.keys(window.localStorage).filter((key) =>
    key.includes("employee-form-modal"),
  );

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
});
