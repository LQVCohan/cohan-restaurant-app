import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __testables,
  installTablePromotionSearch,
} from "./installTablePromotionSearch";

const originalRequestAnimationFrame = window.requestAnimationFrame;

const setSearchValue = (input, value) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("installTablePromotionSearch", () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };
    window[__testables.OBSERVER_KEY]?.disconnect();
    delete window[__testables.OBSERVER_KEY];
    document.body.innerHTML = "";
    document.getElementById(__testables.STYLE_ID)?.remove();
  });

  afterEach(() => {
    window[__testables.OBSERVER_KEY]?.disconnect();
    delete window[__testables.OBSERVER_KEY];
    document.body.innerHTML = "";
    document.getElementById(__testables.STYLE_ID)?.remove();
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }
  });

  it("filters promotion names without accents and preserves checkbox state", () => {
    document.body.innerHTML = `
      <div class="talite-modal">
        <div class="talite-promo-box">
          <div class="talite-label">Khuyến mãi đang hiệu lực</div>
          <div class="talite-promo-list">
            <label class="talite-check">
              <input type="checkbox" />
              <span>Giảm 10% theo danh mục</span>
            </label>
            <label class="talite-check">
              <input type="checkbox" />
              <span>Ưu đãi trưa Việt</span>
            </label>
          </div>
        </div>
      </div>
    `;

    installTablePromotionSearch();

    const input = document.querySelector("input[name='promotionSearch']");
    const rows = Array.from(document.querySelectorAll(".talite-check"));
    const selectedCheckbox = rows[0].querySelector("input");

    expect(input).not.toBeNull();
    expect(input.type).toBe("search");
    expect(document.querySelector(`label[for='${input.id}']`)?.textContent).toBe(
      "Tìm khuyến mãi",
    );

    selectedCheckbox.checked = true;
    setSearchValue(input, "uu dai");

    expect(rows[0].hidden).toBe(true);
    expect(rows[1].hidden).toBe(false);
    expect(selectedCheckbox.checked).toBe(true);
    expect(document.body.textContent).toContain("Tìm thấy 1/2 khuyến mãi.");

    setSearchValue(input, "không tồn tại");
    expect(rows.every((row) => row.hidden)).toBe(true);
    expect(document.querySelector(".cohan-table-promotion-search__empty")?.hidden).toBe(false);

    setSearchValue(input, "");
    expect(rows.every((row) => !row.hidden)).toBe(true);
    expect(selectedCheckbox.checked).toBe(true);
  });
});
