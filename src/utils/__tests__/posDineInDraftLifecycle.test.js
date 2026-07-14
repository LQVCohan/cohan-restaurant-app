import { describe, expect, it } from "vitest";
import {
  getDineInDraftStorageKeys,
  getExplicitDineInDraftItems,
  getSubmittedDraftKeys,
  markSubmittedDineInDraftsPersisted,
  normalizeDineInOrderItemsForPersistence,
} from "../posDineInDraftLifecycle";

describe("POS dine-in draft lifecycle", () => {
  it("treats every non-explicit draft as an existing server line", () => {
    const normalized = normalizeDineInOrderItemsForPersistence([
      { _lineId: "old-1", name: "Món cũ", quantity: 1 },
      {
        _lineId: "old-2",
        name: "Món cũ khác",
        quantity: 2,
        isExisting: false,
        _edited: true,
      },
      { _lineId: "new-1", name: "Món đợt 2", isNew: true },
    ]);

    expect(normalized[0]).toMatchObject({
      isNew: false,
      isExisting: true,
      _edited: false,
    });
    expect(normalized[1]).toMatchObject({
      isNew: false,
      isExisting: true,
      _edited: false,
    });
    expect(normalized[2]).toMatchObject({ isNew: true });
    expect(getExplicitDineInDraftItems(normalized)).toEqual([normalized[2]]);
  });

  it("marks only the submitted second-batch lines as persisted", () => {
    const submitted = [
      { _lineId: "batch-2-a", name: "Món A", isNew: true },
      { _lineId: "batch-2-b", name: "Món B", isNew: true },
    ];
    const submittedKeys = getSubmittedDraftKeys(submitted);
    const nextState = markSubmittedDineInDraftsPersisted(
      [
        { _lineId: "old", name: "Món đợt 1", isExisting: true },
        ...submitted,
        { _lineId: "batch-3", name: "Món thêm trong lúc lưu", isNew: true },
      ],
      submittedKeys,
    );

    expect(nextState[0]).toMatchObject({ isExisting: true });
    expect(nextState[1]).toMatchObject({
      isNew: false,
      isExisting: true,
      persisted: true,
    });
    expect(nextState[2]).toMatchObject({
      isNew: false,
      isExisting: true,
      persisted: true,
    });
    expect(nextState[3]).toMatchObject({ isNew: true });
  });

  it("clears every legacy draft key for the selected table", () => {
    expect(
      getDineInDraftStorageKeys({
        restaurantId: "restaurant-1",
        table: { id: "table-1", code: "a1" },
      }),
    ).toEqual([
      "pos_draft_table_restaurant-1_table-1",
      "pos_draft_table_restaurant-1_a1",
      "pos_draft_table_restaurant-1_A1",
    ]);
  });
});
