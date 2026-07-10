import { describe, expect, it } from "vitest";
import {
  blankForm,
  buildModifierInput,
  getModifierFormValidationError,
  getModifierStepError,
  getModifierStepState,
  getModifierSubmitErrorMessage,
  normalizeModifierOptions,
  toForm,
} from "./ModifierManagement.jsx";

const namedOption = (name, patch = {}) => ({
  ...blankForm().options[0],
  name,
  ...patch,
});

describe("ModifierManagement helpers", () => {
  it("builds a GLOBAL single-select payload and clears item ids", () => {
    const form = {
      ...blankForm("restaurant-1"),
      name: " Size ",
      groupType: "SIZE",
      coverage: "GLOBAL",
      menuItemIds: ["item-1"],
      selectionType: "single",
      required: true,
      options: [
        namedOption(" Size L ", {
          isDefault: true,
          priceRule: { rule: "DELTA", amount: "15000" },
        }),
      ],
    };

    expect(buildModifierInput(form, "restaurant-1")).toMatchObject({
      restaurantId: "restaurant-1",
      name: "Size",
      groupType: "SIZE",
      coverage: "GLOBAL",
      menuItemIds: [],
      selectionType: "single",
      required: true,
      minSelected: 1,
      maxSelected: 1,
      note: null,
      options: [
        {
          name: "Size L",
          isDefault: true,
          isActive: true,
          priceRule: { rule: "DELTA", amount: 15000 },
          inventoryRule: { rule: "NONE", ingredientLines: [] },
        },
      ],
    });
  });

  it("keeps item coverage ids and sends null to clear an unlimited maximum", () => {
    const form = {
      ...blankForm("restaurant-1"),
      name: "Topping",
      coverage: "ITEMS",
      menuItemIds: ["item-1", "item-2"],
      selectionType: "multiple",
      minSelected: "1",
      maxSelected: "",
      note: "   ",
      options: [namedOption("Thêm bò")],
    };

    const input = buildModifierInput(form, "restaurant-1");

    expect(input.menuItemIds).toEqual(["item-1", "item-2"]);
    expect(input.minSelected).toBe(1);
    expect(input.maxSelected).toBeNull();
    expect(input.note).toBeNull();
  });

  it("normalizes required selections and keeps only one default", () => {
    const options = normalizeModifierOptions(
      [
        namedOption("Ít cay", { isDefault: true }),
        namedOption("Cay vừa", { isDefault: true }),
      ],
      { selectionType: "multiple", required: true },
    );

    expect(options.map((option) => option.isDefault)).toEqual([true, false]);

    const requiredSingle = normalizeModifierOptions(
      [namedOption("Nhỏ"), namedOption("Lớn")],
      { selectionType: "single", required: true },
    );
    expect(requiredSingle.map((option) => option.isDefault)).toEqual([
      true,
      false,
    ]);
  });

  it("unlocks steps only after the preceding step is valid", () => {
    const empty = blankForm("restaurant-1");
    expect(getModifierStepState(empty, "restaurant-1")).toMatchObject({
      completedSteps: [],
      firstIncompleteStep: 1,
    });

    const named = { ...empty, name: "Topping" };
    expect(getModifierStepState(named, "restaurant-1")).toMatchObject({
      completedSteps: [1, 2],
      firstIncompleteStep: 3,
    });

    const complete = {
      ...named,
      options: [namedOption("Thêm bò")],
    };
    expect(getModifierStepState(complete, "restaurant-1")).toMatchObject({
      completedSteps: [1, 2, 3],
      firstIncompleteStep: 4,
    });
  });

  it("keeps the item scope step locked until at least one dish is selected", () => {
    const form = {
      ...blankForm("restaurant-1"),
      name: "Topping theo món",
      coverage: "ITEMS",
      menuItemIds: [],
      options: [namedOption("Thêm bò")],
    };

    expect(getModifierStepError(2, form, "restaurant-1")).toBe(
      "Chọn ít nhất một món khi áp dụng theo món.",
    );
    expect(getModifierStepState(form, "restaurant-1")).toMatchObject({
      completedSteps: [1],
      firstIncompleteStep: 2,
    });

    expect(
      getModifierStepState(
        { ...form, menuItemIds: ["item-1"] },
        "restaurant-1",
      ),
    ).toMatchObject({
      completedSteps: [1, 2, 3],
      firstIncompleteStep: 4,
    });
  });

  it("validates scope, duplicate names, active options and selection limits", () => {
    expect(
      getModifierFormValidationError({ ...blankForm(), name: "Size" }, ""),
    ).toBe("Vui lòng chọn chi nhánh.");

    expect(
      getModifierFormValidationError(
        {
          ...blankForm("r1"),
          name: "Theo món",
          coverage: "ITEMS",
        },
        "r1",
      ),
    ).toBe("Chọn ít nhất một món khi áp dụng theo món.");

    expect(
      getModifierFormValidationError(
        { ...blankForm("r1"), name: "Rỗng", options: [] },
        "r1",
      ),
    ).toBe("Cần ít nhất một lựa chọn.");

    expect(
      getModifierFormValidationError(
        {
          ...blankForm("r1"),
          name: "Trùng",
          options: [namedOption("Size L"), namedOption(" size l ")],
        },
        "r1",
      ),
    ).toBe("Tên các lựa chọn không được trùng nhau.");

    expect(
      getModifierFormValidationError(
        {
          ...blankForm("r1"),
          name: "Đã tắt hết",
          options: [namedOption("A", { isActive: false })],
        },
        "r1",
      ),
    ).toBe("Nhóm đang bật phải có ít nhất một lựa chọn đang bật.");

    expect(
      getModifierFormValidationError(
        {
          ...blankForm("r1"),
          name: "Giới hạn",
          minSelected: 3,
          maxSelected: 2,
          options: [
            namedOption("Thêm bò"),
            namedOption("Thêm trứng"),
            namedOption("Thêm rau"),
          ],
        },
        "r1",
      ),
    ).toBe("Số lựa chọn tối đa phải lớn hơn hoặc bằng tối thiểu.");

    expect(
      getModifierFormValidationError(
        {
          ...blankForm("r1"),
          name: "Thiếu lựa chọn",
          minSelected: 2,
          options: [namedOption("Thêm bò")],
        },
        "r1",
      ),
    ).toBe(
      "Số lựa chọn tối thiểu không được vượt quá số lựa chọn đang bật.",
    );

    expect(
      getModifierFormValidationError(
        {
          ...blankForm("r1"),
          name: "Tối đa quá lớn",
          maxSelected: 3,
          options: [namedOption("A"), namedOption("B")],
        },
        "r1",
      ),
    ).toBe("Số lựa chọn tối đa không được vượt quá số lựa chọn đang có.");
  });

  it("maps existing groups back to form state without losing inventory rules", () => {
    const form = toForm(
      {
        id: "group-1",
        restaurantId: "restaurant-1",
        name: "Cách chế biến",
        menuItemIds: [1, "2"],
        options: [
          {
            id: "option-1",
            name: "Nhiều sốt",
            priceRule: { rule: "DELTA", amount: 5000 },
            inventoryRule: {
              rule: "ADD_INGREDIENTS",
              ingredientLines: [
                {
                  ingredientId: "ingredient-1",
                  qty: 10,
                  unit: "g",
                  wastePct: 0,
                },
              ],
              note: "Thêm sốt",
            },
          },
        ],
      },
      "restaurant-1",
    );

    expect(form.menuItemIds).toEqual(["1", "2"]);
    expect(form.options[0].inventoryRule).toMatchObject({
      rule: "ADD_INGREDIENTS",
      ingredientLines: [
        {
          ingredientId: "ingredient-1",
          qty: 10,
          unit: "g",
          wastePct: 0,
        },
      ],
      note: "Thêm sốt",
    });
  });

  it("turns backend errors into manager-facing messages", () => {
    expect(
      getModifierSubmitErrorMessage(
        new Error("Duplicate restaurantId, name"),
      ),
    ).toBe("Tên nhóm tuỳ chọn đã tồn tại trong chi nhánh này.");
    expect(
      getModifierSubmitErrorMessage(
        new Error("Cannot delete: group already used in orders"),
      ),
    ).toBe("Nhóm đã được dùng trong đơn hàng. Hãy tắt nhóm thay vì xoá.");
  });
});
