import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __testables,
  formatRestaurantPriceText,
  installMobileHomeVisualQc,
} from "./installMobileHomeVisualQc";

const originalRequestAnimationFrame = window.requestAnimationFrame;

describe("installMobileHomeVisualQc", () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };
    window[__testables.OBSERVER_KEY]?.disconnect();
    delete window[__testables.OBSERVER_KEY];
    document.body.innerHTML = "";
  });

  afterEach(() => {
    window[__testables.OBSERVER_KEY]?.disconnect();
    delete window[__testables.OBSERVER_KEY];
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }
  });

  it("formats raw VND values and ranges while preserving descriptive labels", () => {
    expect(formatRestaurantPriceText("200000")).toBe("200.000 ₫");
    expect(formatRestaurantPriceText("100000 - 250000 VND")).toBe(
      "100.000–250.000 ₫",
    );
    expect(formatRestaurantPriceText("$$")).toBe("$$");
  });

  it("repairs restaurant price text and switches failed images to the local brand fallback", () => {
    document.body.innerHTML = `
      <main class="mobile-home">
        <article class="res-card">
          <div class="res-card__image-wrapper">
            <img class="res-card__img" src="https://invalid.example/image.jpg" alt="Không gian nhà hàng" />
          </div>
          <span class="res-card__price">200000</span>
        </article>
      </main>
    `;

    const cleanup = installMobileHomeVisualQc();
    const price = document.querySelector(".res-card__price");
    const image = document.querySelector(".res-card__img");

    expect(price.textContent).toBe("200.000 ₫");

    image.dispatchEvent(new Event("error"));

    expect(image.getAttribute("src")).toBe(__testables.FALLBACK_IMAGE);
    expect(image.classList.contains("is-fallback")).toBe(true);
    expect(image.alt).toBe("Ảnh minh họa nhà hàng");

    cleanup();
  });
});
