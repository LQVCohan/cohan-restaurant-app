// src/hooks/useTableDraft.js

const unavailable = async () => {
  throw new Error("Chức năng lưu bản nháp bàn chưa khả dụng. Vui lòng thử lại sau.");
};

/* ===================== Hook ===================== */
export function useTableDraft() {
  return {
    getTableDraft: unavailable,
    getTableDraftsByRestaurant: async () => [],
    upsertTableDraft: unavailable,
    deleteTableDraft: unavailable,
    clearTableDrafts: unavailable,
    states: {
      draftState: {},
      draftsState: {},
      upsertState: {},
      delState: {},
      clearState: {},
    },
  };
}
