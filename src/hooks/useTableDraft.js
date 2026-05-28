// src/hooks/useTableDraft.js

const unavailable = async () => {
  throw new Error(
    "Table draft GraphQL operations are not available in the backend schema.",
  );
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
