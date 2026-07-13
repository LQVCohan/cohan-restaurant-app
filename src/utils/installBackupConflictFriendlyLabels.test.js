import { afterEach, describe, expect, it, vi } from "vitest";
import { installBackupConflictFriendlyLabels } from "./installBackupConflictFriendlyLabels";

describe("installBackupConflictFriendlyLabels", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete window.__cohanBackupConflictFriendlyLabelsInstalled;
    vi.restoreAllMocks();
  });

  it("replaces technical conflict text with user-friendly Vietnamese", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback();
      return 1;
    });

    document.body.innerHTML = `
      <section class="backup-management__conflicts">
        <div class="backup-management__section-head">
          <div>
            <span>Xung đột dữ liệu</span>
            <h3>Chọn cách xử lý</h3>
            <p>Mỗi lựa chọn sẽ được gửi lại cùng thao tác khôi phục và ghi vào audit log.</p>
          </div>
        </div>
        <div class="backup-management__conflict-summary">
          <article><strong>1</strong><span>Tổng mục</span></article>
          <article><strong>1</strong><span>Nên kiểm tra</span></article>
        </div>
        <div class="backup-management__conflict-filters">
          <input placeholder="Tìm theo tên hoặc mã" />
        </div>
        <div class="backup-management__actions is-wrap">
          <button>Dùng đề xuất</button>
          <button>Giữ bản hiện tại</button>
        </div>
        <div class="backup-management__conflict-list">
          <article>
            <header><strong>Thông tin nhà hàng · restaurantProfile</strong><span>Nên kiểm tra</span></header>
            <p>Singleton configuration differs from target.</p>
            <label>Cách xử lý
              <select>
                <option value="keep_target" selected>Giữ bản hiện tại</option>
                <option value="use_source">Dùng bản trong file</option>
              </select>
            </label>
            <details>
              <summary>Xem khác biệt</summary>
              <ul><li>Giá bán: file=50000 / hiện tại=55000</li></ul>
            </details>
          </article>
        </div>
      </section>
      <label class="backup-management__confirm">
        <input type="checkbox" />
        <span>Tôi đã xem đúng nhà hàng đích, hạng mục và cách xử lý; đồng ý áp dụng thay đổi.</span>
      </label>
    `;

    installBackupConflictFriendlyLabels();

    expect(document.body.textContent).toContain("Dữ liệu cần xác nhận");
    expect(document.body.textContent).toContain("Chọn thông tin muốn giữ");
    expect(document.body.textContent).toContain("Thông tin chung của nhà hàng");
    expect(document.body.textContent).toContain("Thông tin trong file khác với thông tin nhà hàng hiện tại");
    expect(document.body.textContent).toContain("Bạn muốn dùng dữ liệu nào?");
    expect(document.body.textContent).toContain("Không thay đổi dữ liệu nhà hàng đang sử dụng.");
    expect(document.body.textContent).toContain("Trong file sao lưu");
    expect(document.body.textContent).toContain("50.000 đ");
    expect(document.body.textContent).not.toContain("restaurantProfile");
    expect(document.body.textContent).not.toContain("Singleton configuration differs from target");
    expect(document.querySelector('input[placeholder="Tìm theo tên thông tin"]')).toBeInTheDocument();
  });
});
