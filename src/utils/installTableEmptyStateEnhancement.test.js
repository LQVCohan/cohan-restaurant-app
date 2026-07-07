import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installTableEmptyStateEnhancement,
  __testables,
} from "./installTableEmptyStateEnhancement";

const renderLegacyBrokenState = () => {
  document.body.innerHTML = `
    <div class="manager-layout--tables">
      <div class="tm-container tm-container--no-floors">
        <section class="management-page-header">
          <button type="button" class="mph-btn mph-btn--primary tm-first-floor-action">
            ＋<span data-table-empty-original-text="Thêm bàn">Tạo tầng đầu tiên</span>
          </button>
        </section>
        <aside class="tm-sidebar">
          <section class="tm-setup-note">Nội dung chèn cũ</section>
        </aside>
        <section class="tm-grid-area">
          <div class="tm-empty tm-empty--setup" role="status" aria-live="polite">
            <span class="tm-empty__icon" aria-hidden="true">🪑</span>
            <span class="tm-empty__eyebrow">Thiết lập khu vực phục vụ</span>
            <h3 class="tm-empty__title">Bắt đầu từ cấu trúc tầng</h3>
            <p
              class="tm-empty__message"
              data-table-empty-original-text="Chưa có tầng để gán bàn."
            >Nội dung đã bị thay</p>
            <ol class="tm-empty__steps"><li>Bước chèn cũ</li></ol>
            <button class="btn tm-empty__action">
              <span class="btn__text" data-table-empty-original-text="Thêm tầng">Tạo tầng đầu tiên</span>
            </button>
          </div>
          <div class="tm-table-grid">
            <article class="tm-table-card"><strong>A1</strong></article>
            <article class="tm-table-card"><strong>A2</strong></article>
          </div>
        </section>
      </div>
    </div>
  `;
};

const clearWindowHooks = () => {
  delete window[__testables.OBSERVER_KEY];
  delete window[__testables.CLICK_HANDLER_KEY];
};

describe("installTableEmptyStateEnhancement", () => {
  beforeEach(() => {
    clearWindowHooks();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    clearWindowHooks();
    document.body.innerHTML = "";
  });

  it("removes legacy injected onboarding nodes without touching table cards", () => {
    renderLegacyBrokenState();

    installTableEmptyStateEnhancement();

    expect(document.querySelectorAll(".tm-table-card")).toHaveLength(2);
    expect(document.body).toHaveTextContent("A1");
    expect(document.body).toHaveTextContent("A2");
    expect(document.querySelector(".tm-setup-note")).not.toBeInTheDocument();
    expect(document.querySelector(".tm-empty__eyebrow")).not.toBeInTheDocument();
    expect(document.querySelector(".tm-empty__title")).not.toBeInTheDocument();
    expect(document.querySelector(".tm-empty__steps")).not.toBeInTheDocument();
    expect(document.querySelector(".tm-container")).not.toHaveClass(
      "tm-container--no-floors",
    );
    expect(document.querySelector(".tm-empty")).not.toHaveClass(
      "tm-empty--setup",
    );
    expect(document.querySelector(".tm-empty__message")).toHaveTextContent(
      "Chưa có tầng để gán bàn.",
    );
    expect(document.querySelector(".tm-empty__action .btn__text")).toHaveTextContent(
      "Thêm tầng",
    );
    expect(document.querySelector(".mph-btn--primary span")).toHaveTextContent(
      "Thêm bàn",
    );
  });

  it("disconnects stale HMR hooks and does not install a new observer", () => {
    const disconnect = vi.fn();
    const staleHandler = vi.fn();
    window[__testables.OBSERVER_KEY] = { disconnect };
    window[__testables.CLICK_HANDLER_KEY] = staleHandler;
    const removeListener = vi.spyOn(document, "removeEventListener");

    installTableEmptyStateEnhancement();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith("click", staleHandler, true);
    expect(window[__testables.OBSERVER_KEY]).toBeUndefined();
    expect(window[__testables.CLICK_HANDLER_KEY]).toBeUndefined();

    removeListener.mockRestore();
  });
});
