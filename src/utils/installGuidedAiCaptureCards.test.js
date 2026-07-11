import { afterEach, describe, expect, it, vi } from "vitest";
import { installGuidedAiCaptureCards } from "./installGuidedAiCaptureCards";

const STEPS = [
  ["1. Chính diện", "Đặt toàn bộ bàn trong khung hình, camera ngang mặt bàn."],
  ["2. Góc trái 45°", "Di chuyển sang trái, giữ nguyên khoảng cách và ánh sáng."],
  ["3. Góc phải 45°", "Di chuyển sang phải, chụp đủ mặt bàn và chân bàn."],
  ["4. Mặt sau", "Chụp phía đối diện ảnh chính diện để bổ sung phần khuất."],
  ["5. Từ trên xuống", "Nâng camera cao, hướng xuống để thấy rõ hình dạng mặt bàn."],
];

afterEach(() => {
  window.__cohanGuidedAiCaptureCardsCleanup?.();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("installGuidedAiCaptureCards", () => {
  it("adds five guided camera frames and updates a card after capture", () => {
    document.body.innerHTML = `
      <div class="custom-table-builder-modal">
        <div class="custom-table-builder__image-list">
          ${STEPS.map(
            ([title, hint], index) => `
              <div class="custom-table-builder__image-chip">
                <span>${title}</span>
                <small>${hint}</small>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  aria-label="Ảnh ${index + 1}"
                />
              </div>
            `,
          ).join("")}
        </div>
      </div>
    `;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:guided-table-photo"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    installGuidedAiCaptureCards();

    const frames = document.querySelectorAll(".cohan-guided-capture__frame");
    const buttons = document.querySelectorAll(".cohan-guided-capture__button");
    expect(frames).toHaveLength(5);
    expect(buttons).toHaveLength(5);
    expect(buttons[0]).toHaveTextContent("Mở camera");
    expect(frames[0]).toHaveTextContent("Chính diện");
    expect(frames[0]).toHaveTextContent("camera ngang mặt bàn");

    const firstInput = document.querySelector('input[aria-label="Ảnh 1"]');
    expect(firstInput).toHaveAttribute("capture", "environment");
    const clickSpy = vi.spyOn(firstInput, "click").mockImplementation(() => {});
    buttons[0].click();
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const file = new File(["table"], "ban-chinh-dien.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(firstInput, "files", {
      configurable: true,
      value: [file],
    });
    firstInput.dispatchEvent(new Event("change", { bubbles: true }));

    const firstCard = firstInput.closest(".cohan-guided-capture");
    expect(firstCard).toHaveClass("is-complete");
    expect(firstCard).toHaveTextContent("Đã chụp");
    expect(firstCard).toHaveTextContent("ban-chinh-dien.jpg");
    expect(buttons[0]).toHaveTextContent("Chụp lại");
    expect(firstCard.querySelector("img")).toHaveAttribute(
      "src",
      "blob:guided-table-photo",
    );
  });

  it("keeps only understandable COHAN metadata visible for Hi3D", () => {
    document.body.innerHTML = `
      <div class="custom-table-builder-modal">
        <section class="custom-table-builder__section">
          <div class="custom-table-builder__section-heading">
            <span>5 góc chụp</span>
            <h4>Tạo mẫu bằng AI</h4>
          </div>
          <div class="custom-table-builder__grid">
            <label class="custom-table-builder__field">
              <span class="custom-table-builder__label">Tên mẫu</span>
              <input name="label" />
            </label>
            <label class="custom-table-builder__field">
              <span class="custom-table-builder__label">Loại bàn</span>
              <select name="type">
                <option value="round-table">Round table</option>
                <option value="rect-4-seat">Rectangular 4-seat</option>
              </select>
            </label>
            <label class="custom-table-builder__field">
              <span class="custom-table-builder__label">Sức chứa</span>
              <input name="capacity" type="number" />
            </label>
            <label class="custom-table-builder__field span-2">
              <span class="custom-table-builder__label">Prompt</span>
              <textarea name="prompt"></textarea>
            </label>
            <label class="custom-table-builder__field">
              <span class="custom-table-builder__label">Khu vực</span>
              <select name="area"><option>Trong nhà</option></select>
            </label>
            <label class="custom-table-builder__field">
              <span class="custom-table-builder__label">Scale</span>
              <input name="defaultScale" />
            </label>
            <label class="custom-table-builder__field">
              <span class="custom-table-builder__label">Tag</span>
              <input name="tags" />
            </label>
          </div>
        </section>
      </div>
    `;

    installGuidedAiCaptureCards();

    const note = document.querySelector(".cohan-ai-metadata-note");
    expect(note).toHaveTextContent("Hi3D tạo model trực tiếp từ 5 ảnh");
    expect(note).toHaveTextContent("không nhận prompt");

    const hiddenFields = document.querySelectorAll(
      "[data-cohan-ai-hidden-field]",
    );
    expect(hiddenFields).toHaveLength(4);
    hiddenFields.forEach((field) => expect(field.hidden).toBe(true));

    expect(document.querySelector('input[name="label"]')).toHaveAttribute(
      "placeholder",
      "Ví dụ: Bàn gỗ 4 chỗ",
    );
    expect(document.querySelector('input[name="capacity"]')).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    expect(document.querySelector('select[name="type"] option')).toHaveTextContent(
      "Bàn tròn",
    );
    expect(document.querySelector(".cohan-ai-metadata-grid")).toBeTruthy();
  });
});
