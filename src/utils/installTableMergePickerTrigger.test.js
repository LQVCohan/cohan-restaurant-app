import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/dom";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/apollo/client", () => ({
  apolloClient: {
    query: (...args) => mocks.query(...args),
  },
}));

import {
  __testables,
  installTableMergePickerTrigger,
} from "./installTableMergePickerTrigger";

const originalRequestAnimationFrame = window.requestAnimationFrame;

const tableRows = [
  {
    id: "table-a1",
    code: "A1",
    capacity: 4,
    status: "available",
    type: "standard",
    floorId: "floor-1",
    floorLevel: 1,
    joinGroupId: null,
  },
  {
    id: "table-a2",
    code: "A2",
    capacity: 4,
    status: "available",
    type: "standard",
    floorId: "floor-1",
    floorLevel: 1,
    joinGroupId: null,
  },
  {
    id: "table-a3",
    code: "A3",
    capacity: 6,
    status: "occupied",
    type: "vip",
    floorId: "floor-1",
    floorLevel: 1,
    joinGroupId: null,
  },
  {
    id: "table-a4",
    code: "A4",
    capacity: 4,
    status: "available",
    type: "standard",
    floorId: "floor-1",
    floorLevel: 1,
    joinGroupId: "existing-group",
  },
  {
    id: "table-b1",
    code: "B1",
    capacity: 4,
    status: "available",
    type: "standard",
    floorId: "floor-2",
    floorLevel: 2,
    joinGroupId: null,
  },
];

const mountModal = () => {
  document.body.innerHTML = `
    <header class="management-page-header">
      <select class="mph-select">
        <option value="restaurant-1" selected>Chi nhánh 1</option>
      </select>
    </header>
    <div class="talite-modal">
      <h3 class="talite-title">Chi tiết bàn <b>A1</b></h3>
      <div class="talite-info">
        <div class="kv"><span class="k">Mã bàn:</span><span class="v">A1</span></div>
        <div class="kv"><span class="k">Tầng:</span><span class="v">Tầng 1</span></div>
      </div>
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
    mocks.query.mockResolvedValue({ data: { tables: tableRows } });
    mountModal();
  });

  afterEach(() => {
    window[__testables.OBSERVER_KEY]?.disconnect?.();
    const clickHandler = window[__testables.CLICK_HANDLER_KEY];
    if (clickHandler) document.removeEventListener("click", clickHandler, true);
    delete window[__testables.OBSERVER_KEY];
    delete window[__testables.CLICK_HANDLER_KEY];
    document.querySelector(`.${__testables.PICKER_CLASS}`)?.remove();
    document.body.innerHTML = "";
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }
  });

  it("shows a visible picker button, searches same-floor tables, and fills the selection", async () => {
    installTableMergePickerTrigger();

    const input = document.querySelector("input.talite-input");
    const mergeButton = Array.from(document.querySelectorAll(".talite-group button")).find(
      (button) => button.textContent === "Ghép bàn",
    );
    const openButton = document.querySelector(`.${__testables.OPEN_BUTTON_CLASS}`);

    expect(input.readOnly).toBe(true);
    expect(openButton).not.toBeNull();
    expect(openButton.textContent).toBe("Chọn bàn từ danh sách");

    fireEvent.click(openButton);

    await waitFor(() => {
      expect(document.querySelector(`.${__testables.PICKER_CLASS}`)).not.toBeNull();
      expect(mocks.query).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).toContain("Bàn A2");
    });

    expect(document.body.textContent).toContain("Bàn A3");
    expect(document.body.textContent).toContain("Bàn A4");
    expect(document.body.textContent).not.toContain("Bàn B1");
    expect(document.querySelector('input[aria-label="Chọn bàn A4"]')).toBeDisabled();

    const searchInput = document.querySelector('input[name="tableMergeSearch"]');
    fireEvent.input(searchInput, { target: { value: "A2" } });
    expect(document.body.textContent).toContain("Bàn A2");
    expect(document.body.textContent).not.toContain("Bàn A3");

    const tableCheckbox = document.querySelector('input[aria-label="Chọn bàn A2"]');
    fireEvent.click(tableCheckbox);
    const confirmButton = document.querySelector("[data-confirm]");
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton.textContent).toBe("Dùng 1 bàn đã chọn");

    fireEvent.click(confirmButton);

    expect(input.value).toBe("A2");
    expect(mergeButton.textContent).toBe("Ghép bàn đã chọn");
    expect(document.querySelector(`.${__testables.PICKER_CLASS}`)).toBeNull();
  });

  it("opens the picker when the empty native merge button is pressed", async () => {
    installTableMergePickerTrigger();

    const mergeButton = Array.from(document.querySelectorAll(".talite-group button")).find(
      (button) => button.textContent === "Ghép bàn",
    );
    fireEvent.click(mergeButton);

    await waitFor(() =>
      expect(document.querySelector(`.${__testables.PICKER_CLASS}`)).not.toBeNull(),
    );
  });
});
