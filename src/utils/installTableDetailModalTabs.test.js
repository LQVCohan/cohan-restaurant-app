import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { enhanceTableDetailModal } from "./installTableDetailModalTabs";

const group = (title, marker) => `
  <section class="talite-group" data-testid="${marker}">
    <div class="talite-group-header">
      <div class="talite-label">${title}</div>
    </div>
  </section>
`;

const renderModal = () => {
  document.body.innerHTML = `
    <div class="talite-modal">
      <header class="talite-header"><h3>Chi tiết bàn A1</h3></header>
      <div class="talite-body">
        <div class="talite-info" data-testid="summary">Tầng 1 · 4 chỗ</div>
        ${group("Thông tin bàn", "configuration")}
        ${group("Trạng thái", "status")}
        ${group("Chuyển bàn sang tầng khác", "move")}
        ${group("Đặt cọc và khuyến mãi", "booking")}
        ${group("Chính sách đặt bàn", "policy")}
        ${group("Trợ lý vận hành bàn", "assistant")}
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
    expect(screen.getByTestId("configuration")).toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Lưu cấu hình", hidden: true })).toHaveAttribute(
      "hidden",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Cấu hình" }));

    expect(screen.getByTestId("configuration")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("danger-zone")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("status")).toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Lưu cấu hình" })).not.toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("tab", { name: "Vận hành" }));

    expect(screen.getByTestId("status")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("move")).not.toHaveAttribute("hidden");
    expect(screen.getByTestId("configuration")).toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Lưu cấu hình", hidden: true })).toHaveAttribute(
      "hidden",
    );
  });

  it("supports roving keyboard navigation", () => {
    renderModal();

    const overviewTab = screen.getByRole("tab", { name: "Tổng quan" });
    fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

    const configurationTab = screen.getByRole("tab", { name: "Cấu hình" });
    expect(configurationTab).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(configurationTab);

    fireEvent.keyDown(configurationTab, { key: "End" });
    expect(screen.getByRole("tab", { name: "Gợi ý AI" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("assistant")).not.toHaveAttribute("hidden");
  });
});
