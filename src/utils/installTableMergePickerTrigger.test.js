import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/dom";

const mocks = vi.hoisted(() => ({
  install: vi.fn(),
  enhance: vi.fn(),
}));

vi.mock("./installTableTransferMergeEnhancement", () => {
  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const enhanceTableModal = (modal) => {
    mocks.enhance(modal);
    const group = Array.from(modal.querySelectorAll(".talite-group")).find((item) =>
      normalizeText(item.textContent).includes("ghep hoac tach ban"),
    );
    const input = group?.querySelector("input.talite-input");
    const button = Array.from(group?.querySelectorAll("button") || []).find((item) =>
      normalizeText(item.textContent).includes("ghep ban"),
    );
    if (!group || !input || !button || group.dataset.mergePickerReady === "true") return;

    group.dataset.mergePickerReady = "true";
    input.readOnly = true;
    input.classList.add("cohan-merge-code-input");
    const hint = document.createElement("div");
    hint.className = "cohan-merge-picker-hint";
    hint.textContent = "Tìm và chọn bàn cùng tầng; không cần nhập mã thủ công.";
    input.insertAdjacentElement("afterend", hint);
    button.addEventListener(
      "click",
      (event) => {
        if (button.dataset.mergePickerBypass === "true") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        button.dataset.pickerOpened = "true";
      },
      true,
    );
  };

  return {
    installTableTransferMergeEnhancement: (...args) => mocks.install(...args),
    __testables: { normalizeText, enhanceTableModal },
  };
});

import {
  __testables,
  installTableMergePickerTrigger,
} from "./installTableMergePickerTrigger";

const originalRequestAnimationFrame = window.requestAnimationFrame;

const mountModal = () => {
  document.body.innerHTML = `
    <div class="talite-modal">
      <section class="talite-group">
        <div class="talite-group-header">
          <span class="talite-label">Ghép hoặc tách bàn</span>
        </div>
        <input class="talite-input" placeholder="Ví dụ: A2, A3" />
        <button type="button">Ghép bàn</button>
      </section>
    </div>
  `;
};

describe("installTableMergePickerTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };
    mountModal();
  });

  afterEach(() => {
    window[__testables.OBSERVER_KEY]?.disconnect?.();
    const clickHandler = window[__testables.CLICK_HANDLER_KEY];
    if (clickHandler) document.removeEventListener("click", clickHandler, true);
    delete window[__testables.OBSERVER_KEY];
    delete window[__testables.CLICK_HANDLER_KEY];
    document.body.innerHTML = "";
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }
  });

  it("shows an explicit picker button and opens the picker on the first click", async () => {
    installTableMergePickerTrigger();

    const input = document.querySelector("input.talite-input");
    const button = document.querySelector("button");
    expect(mocks.install).toHaveBeenCalledTimes(1);
    expect(input.readOnly).toBe(true);
    expect(button.textContent).toBe("Chọn bàn");

    fireEvent.click(button);

    await waitFor(() => expect(button.dataset.pickerOpened).toBe("true"));
    expect(mocks.enhance).toHaveBeenCalledTimes(1);
  });
});
