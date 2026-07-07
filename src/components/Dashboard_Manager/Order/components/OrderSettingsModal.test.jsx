import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrderSettingsModal from "./OrderSettingsModal";

const mocks = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  notification: vi.fn(),
}));

vi.mock("../../../../components/common/Modal", () => {
  const MockModal = ({ isOpen, title, children }) =>
    isOpen ? (
      <div role="dialog" aria-label="Cài đặt màn hình Bếp và Quầy bar">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null;

  MockModal.Footer = ({ children }) => <footer>{children}</footer>;

  return { default: MockModal };
});

vi.mock("../../../../hooks/useModalDraft", () => ({
  default: () => ({
    requestCloseWithDraft: (callback) => callback?.(),
    clearDraft: mocks.clearDraft,
    didRestore: false,
  }),
}));

vi.mock("../../../../hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.notification }),
}));

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  timeSettings: { warn: 10, danger: 20, critical: 30 },
  onSaveTimeSettings: vi.fn(),
  chipSize: "m",
  onSaveChipSize: vi.fn(),
  timeColors: {
    ok: "#16a34a",
    warn: "#eab308",
    danger: "#f97316",
    critical: "#b91c1c",
  },
  onSaveTimeColors: vi.fn(),
};

const renderSettings = (overrides = {}) => {
  const props = {
    ...defaultProps,
    onClose: vi.fn(),
    onSaveTimeSettings: vi.fn(),
    onSaveChipSize: vi.fn(),
    onSaveTimeColors: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<OrderSettingsModal {...props} />),
  };
};

afterEach(() => {
  delete document.documentElement.dataset.orderChipSize;
  vi.clearAllMocks();
});

describe("OrderSettingsModal", () => {
  it("normalizes thresholds and applies saved display settings", () => {
    const { props } = renderSettings();

    fireEvent.change(screen.getByLabelText("Bắt đầu cảnh báo (phút)"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText("Cần ưu tiên (phút)"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Khẩn cấp (phút)"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Lớn/i }));
    fireEvent.change(screen.getByLabelText("Màu Khẩn cấp"), {
      target: { value: "#123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));

    expect(props.onSaveTimeSettings).toHaveBeenCalledWith({
      warn: 12,
      danger: 17,
      critical: 22,
    });
    expect(props.onSaveChipSize).toHaveBeenCalledWith("l");
    expect(props.onSaveTimeColors).toHaveBeenCalledWith(
      expect.objectContaining({ critical: "#123456" }),
    );
    expect(document.documentElement.dataset.orderChipSize).toBe("l");
    expect(mocks.notification).toHaveBeenCalledWith(
      "Đã lưu cài đặt hiển thị trên trình duyệt này.",
      "success",
    );
    expect(mocks.clearDraft).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("keeps the real KDS chip-size mode synchronized while the modal is closed", () => {
    const { rerender } = renderSettings({ open: false, chipSize: "s" });

    expect(document.documentElement.dataset.orderChipSize).toBe("s");

    rerender(
      <OrderSettingsModal
        {...defaultProps}
        open={false}
        chipSize="l"
      />,
    );

    expect(document.documentElement.dataset.orderChipSize).toBe("l");
  });
});
