import { afterEach, describe, expect, it } from "vitest";
import { applyBackupChecklistClarity } from "./installBackupChecklistClarity";

const checklistLabel = (key, text, checked = false, small = "") => `
  <label>
    <input data-key="${key}" type="checkbox" ${checked ? "checked" : ""} />
    <span>${text}${small ? `<small>${small}</small>` : ""}</span>
  </label>
`;

const renderFixture = () => {
  document.body.innerHTML = `
    <main class="backup-management">
      <div class="backup-management__run-action-block">
        <button type="button"><svg></svg>Lưu checklist hiện tại</button>
        <p class="backup-management__run-action-help">Trợ giúp cũ</p>
      </div>
      <div class="backup-management__check-scope-grid">
        <fieldset>
          <legend>Việc cần xác nhận</legend>
          ${checklistLabel("reportsChecked", "Kiểm tra báo cáo cuối ngày", false, "Bắt buộc trước khi tải file")}
          ${checklistLabel("transactionsReconciled", "Đối soát giao dịch")}
          ${checklistLabel("settingsReviewed", "Rà soát cấu hình quan trọng")}
          ${checklistLabel("exportPrepared", "Chuẩn bị file sao lưu")}
          ${checklistLabel("safeCopyStored", "Lưu file ở nơi an toàn")}
          ${checklistLabel("operatorRecorded", "Ghi nhận người thực hiện")}
        </fieldset>
        <fieldset>
          <legend>Phạm vi file cấu hình</legend>
          ${checklistLabel("menuAndPricing", "Menu & giá bán", true)}
        </fieldset>
      </div>
    </main>
  `;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("applyBackupChecklistClarity", () => {
  it("separates required, automatic and post-export checklist states", () => {
    renderFixture();

    expect(applyBackupChecklistClarity()).toBe(true);

    expect(document.querySelector("fieldset legend")?.textContent).toBe("Tiến độ sao lưu");
    expect(document.querySelectorAll(".backup-checklist-required-note")).toHaveLength(3);
    expect(document.querySelectorAll(".backup-management__checklist-help")).toHaveLength(1);
    expect(document.querySelectorAll(".backup-management__scope-help")).toHaveLength(1);

    const exportInput = document.querySelector('[data-key="exportPrepared"]');
    const operatorInput = document.querySelector('[data-key="operatorRecorded"]');
    const safeCopyInput = document.querySelector('[data-key="safeCopyStored"]');

    expect(exportInput).toBeDisabled();
    expect(operatorInput).toBeDisabled();
    expect(safeCopyInput).toBeDisabled();
    expect(exportInput.closest("label")).toHaveTextContent("File sao lưu đã được tạo");
    expect(operatorInput.closest("label")).toHaveTextContent("Đã ghi nhận người tải file");
    expect(document.querySelector("button")).toHaveTextContent("Lưu tiến độ hiện tại");
    expect(document.querySelector(".backup-management__run-action-help")).toHaveTextContent(
      "3 bước bắt buộc",
    );
  });

  it("enables safe-copy confirmation after file creation is recorded", () => {
    renderFixture();
    applyBackupChecklistClarity();

    const exportInput = document.querySelector('[data-key="exportPrepared"]');
    const safeCopyInput = document.querySelector('[data-key="safeCopyStored"]');
    exportInput.checked = true;

    applyBackupChecklistClarity();

    expect(safeCopyInput).not.toBeDisabled();
    expect(safeCopyInput.title).toMatch(/lưu file vào nơi an toàn/i);
  });
});
