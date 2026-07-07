import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRestaurantTimeOptions,
  installRestaurantHoursEnhancement,
} from "./installRestaurantHoursEnhancement";

const renderHoursForm = () => {
  document.body.innerHTML = `
    <div class="restaurant-management-container">
      <div class="ant-row restaurant-fields-row">
        <div class="ant-col">
          <div class="ant-form-item">
            <div class="ant-row ant-form-item-row">
              <div class="ant-form-item-label"><label>Giờ mở cửa</label></div>
              <div class="ant-form-item-control">
                <span class="ant-input-affix-wrapper"><input value="" /></span>
              </div>
            </div>
          </div>
        </div>
        <div class="ant-col">
          <div class="ant-form-item">
            <div class="ant-row ant-form-item-row">
              <div class="ant-form-item-label"><label>Giờ đóng cửa</label></div>
              <div class="ant-form-item-control">
                <span class="ant-input-affix-wrapper"><input value="" /></span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button type="button">Lưu thay đổi</button>
    </div>
  `;
};

describe("restaurant hours enhancement", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/manager#restaurant-info-management");
    window.__restaurantHoursEnhancementInstalled = false;
    window.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    renderHoursForm();
  });

  it("renders explicit time selectors and blocks an incomplete hour pair", async () => {
    installRestaurantHoursEnhancement();
    await Promise.resolve();

    const openingSelect = document.querySelector(
      '.restaurant-hours-select[data-hours-role="opening"]',
    );
    const closingSelect = document.querySelector(
      '.restaurant-hours-select[data-hours-role="closing"]',
    );
    const [openingInput, closingInput] = document.querySelectorAll("input");

    expect(document.querySelector(".restaurant-fields-row")).toHaveClass(
      "restaurant-hours-grid",
    );
    expect(openingSelect).not.toBeNull();
    expect(closingSelect).not.toBeNull();
    expect(buildRestaurantTimeOptions()).toContain("08:00");
    expect(buildRestaurantTimeOptions()).toContain("22:00");

    openingSelect.value = "08:00";
    openingSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(openingInput.value).toBe("08:00");

    const blocked = document.querySelector("button").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(blocked).toBe(false);
    expect(document.querySelector(".restaurant-hours-error")?.textContent).toContain(
      "đầy đủ",
    );

    closingSelect.value = "22:00";
    closingSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(closingInput.value).toBe("22:00");

    const allowed = document.querySelector("button").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(allowed).toBe(true);
    expect(document.querySelector(".restaurant-hours-error")).toBeNull();
  });
});
