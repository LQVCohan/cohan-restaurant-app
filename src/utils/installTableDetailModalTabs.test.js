import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { enhanceTableDetailModal } from "./installTableDetailModalTabs";

const group = (title, marker) => `
  <section class="talite-group" data-testid="${marker}">
    <div class="talite-group-header">
      <span class="talite-group-icon">legacy</span>
      <div class="talite-label">${title}</div>
    </div>
  </section>
`;

const summaryRow = (label, value, marker) => `
  <div class="kv" data-testid="${marker}">
    <span class="k">${label}:</span>
    <span class="v">${value}</span>
  </div>
`;

const getSaveButton = () =>
  document.querySelector(".talite-footer .btn.primary");

const renderModal = () => {
  document.body.innerHTML = `
    <div class="talite-modal">
      <header class="talite-header"><h3>Chi tiết bàn A1</h3></header>
      <div class="talite-body">
        <div class="talite-info" data-testid="summary">
          ${summaryRow("Mã bàn", "A1", "summary-code")}
          ${summaryRow("Tầng", "Tầng 1", "summary-floor")}
          ${summaryRow("Sức chứa", "4 chỗ", "summary-capacity")}
          ${summaryRow("Loại", "Tiêu chuẩn", "summary-type")}
          ${summaryRow("Khu vực", "Sảnh chính", "summary-zone")}
          ${summaryRow("Trạng thái", "Đang phục vụ", "summary-status")}
        </div>
        ${group("Thông tin bàn", "configuration")}
        ${group("Trạng thái", "status")}
        ${group("Chuyển bàn sang tầng khác", "move")}
        ${group("Đổi vị trí với bàn khác", "swap")}
        ${group("Ghép hoặc tách bàn", "merge")}
        ${group("Đặt cọc và khuyến mãi", "booking")}
        ${group("Chính sách đặt bàn", "policy")}
        ${group("Trợ lý vận hành bàn", "assistant")}
        <section class="cohan-table-customer-profiles" data-testid="customers">
          Khách liên kết
        </section>
        <div class="actions-end" data-testid="danger-zone">
          <button class="btn danger" type="button">Xóa bàn</button>
        </div>
      </div>
      <footer class="talite-footer">
        <div class="actions">
          <button class="btn" type="button">Đóng</button>
          <button class="btn primary" type="button">Lưu thay đổi</button>
        </div>
      </footer>
    </div>
  `;

  const modal = document.querySelector(".talite-modal");
  enhanceTableDetailModal(modal);
  return modal;
};

describe("table detail modal tabs", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("defaults to overview and separates immediate actions from saved configuration", () => {
    renderModal();

    expect(screen.getByRole("tab", { name: "Tổng quan" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("summary")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("status")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("customers")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("configuration")).toHaveAttribute("hidden");
    expect(getSaveButton()).toHaveTextContent("Lưu cấu hình");
    expect(getSaveButton()).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("tab", { name: "Khách liên kết" }));
    expect(screen.getByTestId("customers")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("status")).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("tab", { name: "Cấu hình" }));

    expect(screen.getByTestId("configuration")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("danger-zone")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("status")).toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Lưu cấu hình" })).not.toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("tab", { name: "Vận hành" }));

    expect(screen.getByTestId("status")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("move")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("configuration")).toHaveAttribute("hidden");
    expect(getSaveButton()).toHaveAttribute("hidden");
  });

  it("adds stable summary and section hooks for the visual system", () => {
    const modal = renderModal();

    expect(screen.getByTestId("summary-code")).toHaveAttribute(
      "data-table-detail-summary",
      "code",
    );
    expect(screen.getByTestId("summary-floor")).toHaveAttribute(
      "data-table-detail-summary",
      "floor",
    );
    expect(screen.getByTestId("summary-status")).toHaveAttribute(
      "data-table-detail-summary",
      "status",
    );
    expect(screen.getByTestId("summary-status")).toHaveAttribute(
      "data-table-status-tone",
      "busy",
    );
    expect(modal).toHaveAttribute("data-table-detail-status-tone", "busy");

    expect(screen.getByTestId("configuration")).toHaveAttribute(
      "data-table-detail-kind",
      "basics",
    );
    expect(screen.getByTestId("move")).toHaveAttribute("data-table-detail-kind", "move");
    expect(screen.getByTestId("swap")).toHaveAttribute("data-table-detail-kind", "swap");
    expect(screen.getByTestId("merge")).toHaveAttribute("data-table-detail-kind", "merge");
    expect(screen.getByTestId("booking")).toHaveAttribute(
      "data-table-detail-kind",
      "promotion",
    );
    expect(screen.getByTestId("policy")).toHaveAttribute("data-table-detail-kind", "policy");
    expect(screen.getByTestId("assistant")).toHaveAttribute(
      "data-table-detail-kind",
      "assistant",
    );
    expect(screen.getByTestId("danger-zone")).toHaveAttribute(
      "data-table-detail-kind",
      "danger",
    );
  });

  it("supports roving keyboard navigation", () => {
    renderModal();

    const overviewTab = screen.getByRole("tab", { name: "Tổng quan" });
    fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

    const customersTab = screen.getByRole("tab", { name: "Khách liên kết" });
    expect(customersTab).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(customersTab);

    fireEvent.keyDown(customersTab, { key: "End" });
    expect(screen.getByRole("tab", { name: "Gợi ý AI" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("assistant")).not.toHaveAttribute("hidden");
  });

  it("does not overwrite the existing save progress label", () => {
    const modal = renderModal();
    fireEvent.click(screen.getByRole("tab", { name: "Cấu hình" }));

    const saveButton = screen.getByRole("button", { name: "Lưu cấu hình" });
    saveButton.textContent = "Đang lưu…";
    enhanceTableDetailModal(modal);

    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeVisible();
  });
});
