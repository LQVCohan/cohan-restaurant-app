import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/dom";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/apollo/client", () => ({
  apolloClient: { query: mocks.query },
}));

import { __testables } from "./installTableTransferMergeEnhancement";

const originalRequestAnimationFrame = window.requestAnimationFrame;

const mountTableModal = () => {
  document.body.innerHTML = `
    <section class="management-page-header">
      <select class="mph-select">
        <option value="restaurant-1" selected>Chi nhánh 1</option>
      </select>
    </section>
    <div class="talite-modal">
      <h3 class="talite-title">Chi tiết bàn <b>A1</b></h3>
      <div class="talite-info">
        <div class="kv"><span class="k">Mã bàn:</span><span class="v">A1</span></div>
        <div class="kv"><span class="k">Tầng:</span><span class="v">Tầng 1</span></div>
      </div>
      <section class="talite-group">
        <div class="talite-group-header"><span class="talite-label">Chuyển bàn sang tầng khác</span></div>
        <select class="talite-input">
          <option value="1">Tầng 1 — Tầng 1</option>
          <option value="2">Tầng 2 — Khu sân vườn</option>
        </select>
      </section>
      <section class="talite-group">
        <div class="talite-group-header"><span class="talite-label">Ghép hoặc tách bàn</span></div>
        <label class="talite-label">Mã các bàn cần ghép</label>
        <input class="talite-input" />
        <button type="button">Ghép bàn</button>
      </section>
    </div>
  `;
};

describe("installTableTransferMergeEnhancement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };
    mountTableModal();
    mocks.query.mockResolvedValue({
      data: {
        tables: [
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
            status: "reserved",
            type: "vip",
            floorId: "floor-1",
            floorLevel: 1,
            joinGroupId: null,
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
        ],
      },
    });
  });

  afterEach(() => {
    window[__testables.OBSERVER_KEY]?.disconnect?.();
    delete window[__testables.OBSERVER_KEY];
    document.getElementById(__testables.STYLE_ID)?.remove();
    document.body.innerHTML = "";
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }
  });

  it("deduplicates floor names and merges tables chosen from the searchable picker", async () => {
    const mergeInput = document.querySelector(".talite-group:last-child input");
    const mergeButton = document.querySelector(".talite-group:last-child button");
    const submittedValues = [];
    mergeButton.addEventListener("click", () => submittedValues.push(mergeInput.value));

    __testables.enhanceTableModal(document.body);

    const floorOptions = document.querySelectorAll(".talite-group:first-of-type option");
    expect(floorOptions[0].textContent).toBe("Tầng 1");
    expect(floorOptions[1].textContent).toBe("Tầng 2 — Khu sân vườn");
    expect(mergeInput.readOnly).toBe(true);

    fireEvent.click(mergeButton);

    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(1));
    const picker = document.querySelector(`.${__testables.PICKER_CLASS}`);
    expect(picker).not.toBeNull();
    expect(picker.textContent).toContain("Bàn A2");
    expect(picker.textContent).toContain("Bàn A3");
    expect(picker.textContent).not.toContain("Bàn B1");

    const search = picker.querySelector("input[type='search']");
    fireEvent.input(search, { target: { value: "a2" } });
    expect(picker.textContent).toContain("Bàn A2");
    expect(picker.textContent).not.toContain("Bàn A3");

    fireEvent.click(picker.querySelector("input[value='table-a2']"));
    fireEvent.click(picker.querySelector("[data-confirm]"));

    await waitFor(() => expect(submittedValues).toEqual(["A2"]));
    expect(mergeInput.value).toBe("A2");
    expect(document.querySelector(`.${__testables.PICKER_CLASS}`)).toBeNull();
  });
});
