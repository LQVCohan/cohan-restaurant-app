// src/hooks/useTableDraft.js
import { gql, useLazyQuery, useMutation } from "@apollo/client";

/* ===================== GQL ===================== */
const TABLE_DRAFT_FIELDS = gql`
  fragment TableDraftFields on TableDraft {
    id
    restaurantId
    tableId
    tableCode
    customerName
    customerPhone
    customerEmail
    note
    partySize
    timeTo
    createdAt
    updatedAt
    expiresAt
  }
`;

const GET_TABLE_DRAFT = gql`
  query TableDraft($restaurantId: ID!, $tableId: ID, $tableCode: String) {
    tableDraft(
      restaurantId: $restaurantId
      tableId: $tableId
      tableCode: $tableCode
    ) {
      ...TableDraftFields
    }
  }
  ${TABLE_DRAFT_FIELDS}
`;

const GET_TABLE_DRAFTS_BY_RESTAURANT = gql`
  query TableDraftsByRestaurant($restaurantId: ID!) {
    tableDraftsByRestaurant(restaurantId: $restaurantId) {
      ...TableDraftFields
    }
  }
  ${TABLE_DRAFT_FIELDS}
`;

const UPSERT_TABLE_DRAFT = gql`
  mutation UpsertTableDraft($input: UpsertTableDraftInput!) {
    upsertTableDraft(input: $input) {
      ...TableDraftFields
    }
  }
  ${TABLE_DRAFT_FIELDS}
`;

const DELETE_TABLE_DRAFT = gql`
  mutation DeleteTableDraft(
    $restaurantId: ID!
    $tableId: ID
    $tableCode: String
  ) {
    deleteTableDraft(
      restaurantId: $restaurantId
      tableId: $tableId
      tableCode: $tableCode
    )
  }
`;

const CLEAR_TABLE_DRAFTS = gql`
  mutation ClearTableDrafts($restaurantId: ID!) {
    clearTableDrafts(restaurantId: $restaurantId)
  }
`;

/* ===================== Hook ===================== */
export function useTableDraft() {
  const [fetchDraft, draftState] = useLazyQuery(GET_TABLE_DRAFT, {
    fetchPolicy: "network-only",
  });
  const [fetchDrafts, draftsState] = useLazyQuery(
    GET_TABLE_DRAFTS_BY_RESTAURANT,
    { fetchPolicy: "cache-and-network" }
  );

  const [mutUpsert, upsertState] = useMutation(UPSERT_TABLE_DRAFT);
  const [mutDelete, delState] = useMutation(DELETE_TABLE_DRAFT);
  const [mutClear, clearState] = useMutation(CLEAR_TABLE_DRAFTS);

  return {
    // queries
    getTableDraft: async ({ restaurantId, tableId, tableCode }) => {
      const { data } = await fetchDraft({
        variables: { restaurantId, tableId, tableCode },
      });
      return data?.tableDraft || null;
    },
    getTableDraftsByRestaurant: async (restaurantId) => {
      const { data } = await fetchDrafts({ variables: { restaurantId } });
      return data?.tableDraftsByRestaurant || [];
    },

    // mutations
    upsertTableDraft: async (input) => {
      const { data } = await mutUpsert({ variables: { input } });
      return data?.upsertTableDraft || null;
    },
    deleteTableDraft: async ({ restaurantId, tableId, tableCode }) => {
      const { data } = await mutDelete({
        variables: { restaurantId, tableId, tableCode },
      });
      return !!data?.deleteTableDraft;
    },
    clearTableDrafts: async (restaurantId) => {
      const { data } = await mutClear({ variables: { restaurantId } });
      return !!data?.clearTableDrafts;
    },

    // raw states (nếu cần xem loading/error)
    states: {
      draftState,
      draftsState,
      upsertState,
      delState,
      clearState,
    },
  };
}
