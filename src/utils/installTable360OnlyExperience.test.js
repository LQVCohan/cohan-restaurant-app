import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enhanceTable360OnlyExperience,
  __testables,
} from "./installTable360OnlyExperience";

describe("installTable360OnlyExperience", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.getElementById(__testables.STYLE_ID)?.remove();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces the legacy table 3D action with the 360 detail flow", () => {
    const legacyClick = vi.fn();
    const detailClick = vi.fn();
    document.body.innerHTML = `
      <main class="tm-container">
        <button type="button">Mô phỏng 3D</button>
        <article class="tm-table-card">
          <span class="table-no">A1</span>
          <span class="vr-badge">360°</span>
          <span class="tm-3d-badge">3D</span>
          <div class="card-actions">
            <button type="button" class="btn-mini primary btn-mini--3d" aria-label="Mở 3D và AR cho bàn A1">3D / AR</button>
            <button type="button" class="btn-mini secondary" aria-label="Mở cấu hình bàn A1">Chi tiết</button>
          </div>
        </article>
      </main>
    `;

    const visualButton = document.querySelector(".btn-mini--3d");
    const detailButton = document.querySelector('[aria-label="Mở cấu hình bàn A1"]');
    visualButton.addEventListener("click", legacyClick);
    detailButton.addEventListener("click", detailClick);

    enhanceTable360OnlyExperience(document.body);

    expect(document.querySelector(".tm-container > button")).toHaveAttribute(
      "data-table-legacy-3d",
      "true",
    );
    expect(document.querySelector(".tm-3d-badge")).toHaveAttribute(
      "data-table-legacy-3d",
      "true",
    );
    expect(visualButton).toHaveTextContent("Xem 360°");
    expect(visualButton).toHaveClass("btn-mini--360");
    expect(visualButton).not.toHaveClass("btn-mini--3d");

    visualButton.click();

    expect(detailClick).toHaveBeenCalledTimes(1);
    expect(legacyClick).not.toHaveBeenCalled();
  });

  it("upgrades the add-table modal and removes legacy model summaries", () => {
    document.body.innerHTML = `
      <section class="tm-modal--add-table">
        <header class="modal-header"><strong>Thêm bàn mới</strong></header>
        <div class="tm-form tm-form--add-table">
          <div class="tm-form-header tm-form-header--add-table">
            <h4>Thiết lập thông tin bàn</h4>
            <p>Nội dung cũ</p>
          </div>
          <div class="tm-form-section tm-form-section--basic"></div>
          <div class="tm-template-preview">Cấu hình mô phỏng 3D</div>
        </div>
        <footer class="tm-add-table-footer">
          <button>Hủy</button>
          <button>Lưu bàn</button>
        </footer>
      </section>
    `;

    enhanceTable360OnlyExperience(document.body);

    const modal = document.querySelector(".tm-modal--add-table");
    expect(modal).toHaveClass("table-360-add-modal");
    expect(modal.querySelector(".tm-form-header--add-table h4")).toHaveTextContent(
      "Tạo vị trí phục vụ mới",
    );
    expect(modal.querySelector(".tm-add-table-360-note")).toHaveTextContent(
      "Thêm ảnh không gian sau khi tạo bàn",
    );
    expect(modal.querySelector(".tm-template-preview")).toHaveAttribute(
      "data-table-legacy-3d",
      "true",
    );
    expect(modal.querySelector(".tm-add-table-footer button:last-child")).toHaveTextContent(
      "Tạo bàn",
    );
  });

  it("clears only legacy add-table drafts", () => {
    window.localStorage.setItem(
      "cohan.modalDraft.v1:table:add-table-modal:%2Fmanager:create:table:none:restaurant-1:1",
      "{}",
    );
    window.localStorage.setItem("unrelated", "keep");

    __testables.clearLegacyAddTableDrafts();

    expect(window.localStorage.getItem("unrelated")).toBe("keep");
    expect(window.localStorage.length).toBe(1);
  });
});
