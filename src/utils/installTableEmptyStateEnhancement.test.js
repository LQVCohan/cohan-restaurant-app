import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installTableEmptyStateEnhancement,
  __testables,
} from "./installTableEmptyStateEnhancement";

const renderTablePage = ({ withFloor = false } = {}) => {
  document.body.innerHTML = `
    <div class="manager-layout--tables">
      <div class="tm-container">
        <section class="management-page-header">
          <button type="button" class="mph-btn mph-btn--primary">＋<span>Thêm bàn</span></button>
        </section>
        <div class="tm-layout">
          <aside class="tm-sidebar">
            <nav class="tm-floor-list">
              <button type="button" class="tm-floor-item">Tất cả tầng</button>
              ${withFloor ? '<button type="button" class="tm-floor-item">Tầng 1</button>' : ""}
              <button type="button" class="tm-add-floor-btn">+ Thêm tầng</button>
            </nav>
            <section class="tm-filter-box">Bộ lọc bàn</section>
          </aside>
          <section class="tm-grid-area">
            <div class="tm-empty">
              <span aria-hidden="true">🪑</span>
              <p>Chưa có tầng để gán bàn.</p>
              <button type="button" class="btn btn--primary">
                <span class="btn__text">Thêm tầng</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
};

const cleanupInstaller = () => {
  window[__testables.OBSERVER_KEY]?.disconnect?.();
  delete window[__testables.OBSERVER_KEY];
  const handler = window[__testables.CLICK_HANDLER_KEY];
  if (handler) document.removeEventListener("click", handler, true);
  delete window[__testables.CLICK_HANDLER_KEY];
};

describe("installTableEmptyStateEnhancement", () => {
  beforeEach(() => {
    cleanupInstaller();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanupInstaller();
    document.body.innerHTML = "";
  });

  it("builds a semantic setup state when the restaurant has no floors", () => {
    renderTablePage();

    const container = __testables.prepareTableEmptyState();

    expect(container).toHaveClass(__testables.NO_FLOORS_CLASS);
    expect(document.querySelector(".tm-empty")).toHaveClass(
      __testables.SETUP_CLASS,
    );
    expect(document.querySelector(".tm-empty__title")).toHaveTextContent(
      "Bắt đầu từ cấu trúc tầng",
    );
    expect(document.querySelectorAll(".tm-empty__steps li")).toHaveLength(3);
    expect(document.querySelector(".tm-empty__action .btn__text")).toHaveTextContent(
      "Tạo tầng đầu tiên",
    );
    expect(document.querySelector(".tm-setup-note")).toBeInTheDocument();
    expect(document.querySelector(".tm-first-floor-action span")).toHaveTextContent(
      "Tạo tầng đầu tiên",
    );
  });

  it("routes the header primary action to the existing add-floor button", () => {
    renderTablePage();
    const addFloorHandler = vi.fn();
    document
      .querySelector(".tm-add-floor-btn")
      .addEventListener("click", addFloorHandler);

    installTableEmptyStateEnhancement();
    document.querySelector(".tm-first-floor-action").click();

    expect(addFloorHandler).toHaveBeenCalledTimes(1);
  });

  it("keeps the normal table state unchanged when a floor exists", () => {
    renderTablePage({ withFloor: true });

    const container = __testables.prepareTableEmptyState();

    expect(container).not.toHaveClass(__testables.NO_FLOORS_CLASS);
    expect(document.querySelector(".tm-empty__steps")).not.toBeInTheDocument();
    expect(document.querySelector(".tm-setup-note")).not.toBeInTheDocument();
    expect(
      document.querySelector(".management-page-header .mph-btn--primary span"),
    ).toHaveTextContent("Thêm bàn");
  });
});
