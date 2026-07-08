import { gql, useMutation, useQuery } from "@apollo/client";
import { useCallback, useMemo } from "react";
import { useNotification } from "./useNotification";

/* ========= Fragments ========= */
const F_TABLE_MIN = gql`
  fragment TableMin on Table {
    __typename
    id
    code
    capacity
    status
    type
    deposit
    zone
    promotionIds
    bookingPerks
    reservationHoldMinutes
    minSpend
    cancelPolicy
    floorId
    floorLevel
    joinGroupId
    mergedFromTableIds
    mergeAnchorTableId
    mergedAt
    mergeDetails
    tags
    notes
    vrUrl
    visualConfig
    restaurantId
    position {
      x
      y
      w
      h
      rotation
      shape
      path
    }
  }
`;

/* ========= Queries ========= */
const Q_TABLES = gql`
  query Tables($restaurantId: ID!) {
    tables(restaurantId: $restaurantId) {
      ...TableMin
    }
  }
  ${F_TABLE_MIN}
`;

/* ========= Mutations ========= */
const M_CREATE = gql`
  mutation CreateTable($input: CreateTableInput!) {
    createTable(input: $input) {
      ...TableMin
    }
  }
  ${F_TABLE_MIN}
`;
const M_UPDATE = gql`
  mutation UpdateTable($input: UpdateTableInput!) {
    updateTable(input: $input) {
      ...TableMin
    }
  }
  ${F_TABLE_MIN}
`;
const M_DELETE = gql`
  mutation DeleteTable($id: ID!) {
    deleteTable(id: $id)
  }
`;
const M_SET_STATUS = gql`
  mutation SetTableStatus($input: SetTableStatusInput!) {
    setTableStatus(input: $input) {
      id
      status
      __typename
    }
  }
`;
const M_MOVE = gql`
  mutation MoveTable($input: MoveTableInput!) {
    moveTable(input: $input) {
      id
      floorId
      floorLevel
      position {
        x
        y
        w
        h
        rotation
        shape
        path
      }
      __typename
    }
  }
`;
const M_SWAP_CODES = gql`
  mutation SwapTableCodes($input: SwapTableCodesInput!) {
    swapTableCodes(input: $input)
  }
`;
const M_BULK_UPSERT = gql`
  mutation BulkUpsertTables($input: BulkUpsertTablesInput!) {
    bulkUpsertTables(input: $input)
  }
`;
const M_MERGE = gql`
  mutation MergeTables($input: MergeTablesInput!) {
    mergeTables(input: $input) {
      joinGroupId
      anchorId
      tableIds
      mergedTableId
      mergedTableCode
      __typename
    }
  }
`;
const M_SPLIT = gql`
  mutation SplitTables($input: SplitTablesInput!) {
    splitTables(input: $input) {
      ok
      unmergedTableIds
      __typename
    }
  }
`;

export default function useTableManagement({ restaurantId }) {
  const { showNotification } = useNotification();
  const { data, loading, error, refetch } = useQuery(Q_TABLES, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  /* ------ helpers for cache ------ */
  const readTable = (cache, id) =>
    cache.readFragment({
      id: cache.identify({ __typename: "Table", id }),
      fragment: F_TABLE_MIN,
    });
  const writeTable = (cache, table) =>
    cache.writeFragment({
      id: cache.identify({ __typename: "Table", id: table.id }),
      fragment: F_TABLE_MIN,
      data: table,
    });

  /* ------ mutations with optimistic UI ------ */
  const [createMut] = useMutation(M_CREATE);
  const [updateMut] = useMutation(M_UPDATE, {
    optimisticResponse: ({ input }) => ({
      updateTable: {
        __typename: "Table",
        ...input,
      },
    }),
    update(cache, { data }) {
      if (!data?.updateTable) return;
      writeTable(cache, data.updateTable);
    },
  });
  const [deleteMut] = useMutation(M_DELETE, {
    update(cache, { variables }) {
      const idRef = cache.identify({ __typename: "Table", id: variables.id });
      cache.evict({ id: idRef });
      cache.gc();
    },
  });
  const [setStatusMut] = useMutation(M_SET_STATUS, {
    update(cache, { data }) {
      const t = data?.setTableStatus;
      if (!t) return;
      cache.modify({
        id: cache.identify({ __typename: "Table", id: t.id }),
        fields: { status: () => t.status },
      });
    },
  });
  const [moveMut] = useMutation(M_MOVE, {
    optimisticResponse: ({ input }) => ({
      moveTable: {
        __typename: "Table",
        id: input.id,
        floorId:
          input.floorId ??
          readTable(window.__APOLLO_CLIENT__?.cache ?? {}, input.id)?.floorId,
        floorLevel:
          readTable(window.__APOLLO_CLIENT__?.cache ?? {}, input.id)
            ?.floorLevel ?? null,
        position: input.position ?? null,
      },
    }),
    update(cache, { data }) {
      const t = data?.moveTable;
      if (!t) return;
      cache.modify({
        id: cache.identify({ __typename: "Table", id: t.id }),
        fields: {
          floorId: () => t.floorId,
          floorLevel: () => t.floorLevel,
          position: () => t.position,
        },
      });
    },
  });
  const [swapCodesMut] = useMutation(M_SWAP_CODES, {
    optimisticResponse: () => ({ swapTableCodes: true }),
    update(cache, { variables }) {
      const { aId, bId } = variables.input;
      const a = readTable(cache, aId);
      const b = readTable(cache, bId);
      if (!a || !b) return;
      cache.modify({
        id: cache.identify({ __typename: "Table", id: aId }),
        fields: { code: () => b.code },
      });
      cache.modify({
        id: cache.identify({ __typename: "Table", id: bId }),
        fields: { code: () => a.code },
      });
    },
  });
  const [bulkUpsertMut] = useMutation(M_BULK_UPSERT);
  const [mergeMut] = useMutation(M_MERGE);
  const [splitMut] = useMutation(M_SPLIT);

  const tables = useMemo(() => data?.tables ?? [], [data]);

  const createTable = useCallback(
    async (input) =>
      (await createMut({ variables: { input } }))?.data?.createTable,
    [createMut],
  );
  const updateTable = useCallback(
    async (input) =>
      (await updateMut({ variables: { input } }))?.data?.updateTable,
    [updateMut],
  );
  const deleteTable = useCallback(
    async (id) =>
      (await deleteMut({ variables: { id } }))?.data?.deleteTable ?? false,
    [deleteMut],
  );
  const setTableStatus = useCallback(
    async ({ id, status }) =>
      (await setStatusMut({ variables: { input: { id, status } } }))?.data
        ?.setTableStatus,
    [setStatusMut],
  );
  const moveTable = useCallback(
    async ({ id, floorId, position }) =>
      (await moveMut({ variables: { input: { id, floorId, position } } }))?.data
        ?.moveTable,
    [moveMut],
  );
  const swapTableCodes = useCallback(
    async ({ restaurantId, floorId, aId, bId }) =>
      (
        await swapCodesMut({
          variables: { input: { restaurantId, floorId, aId, bId } },
        })
      )?.data?.swapTableCodes ?? true,
    [swapCodesMut],
  );
  const bulkUpsertTables = useCallback(
    async (input) =>
      (await bulkUpsertMut({ variables: { input } }))?.data?.bulkUpsertTables,
    [bulkUpsertMut],
  );
  const mergeTables = useCallback(
    async ({ tableIds, anchorId, joinGroupId }) => {
      const result = (
        await mergeMut({
          variables: {
            input: { restaurantId, tableIds, anchorId, joinGroupId },
          },
        })
      )?.data?.mergeTables;

      showNotification(
        result?.mergedTableCode
          ? `Đã ghép bàn thành ${result.mergedTableCode}.`
          : "Đã ghép bàn thành công.",
        "success",
      );
      void refetch().catch((refreshError) => {
        console.warn("Không thể tải lại danh sách bàn sau khi ghép:", refreshError);
      });
      return result;
    },
    [mergeMut, refetch, restaurantId, showNotification],
  );
  const splitTables = useCallback(
    async ({ joinGroupId, mode, tableIds }) => {
      const result = (
        await splitMut({
          variables: { input: { restaurantId, joinGroupId, mode, tableIds } },
        })
      )?.data?.splitTables;

      showNotification("Đã tách bàn thành công.", "success");
      void refetch().catch((refreshError) => {
        console.warn("Không thể tải lại danh sách bàn sau khi tách:", refreshError);
      });
      return result;
    },
    [splitMut, refetch, restaurantId, showNotification],
  );

  const fetchTableByCode = useCallback(
    (code, rid) => {
      const r = (rid ?? restaurantId) || "";
      return (
        tables.find(
          (t) =>
            (t.code || "").toLowerCase() === (code || "").toLowerCase() &&
            String(t.restaurantId || "") === String(r),
        ) || null
      );
    },
    [tables, restaurantId],
  );

  return {
    tables,
    tablesLoading: loading,
    tablesError: error,

    // expose refetch cho FE
    refetchTables: refetch,

    // mutations
    createTable,
    updateTable,
    deleteTable,
    setTableStatus,
    moveTable,
    swapTableCodes,
    bulkUpsertTables,
    mergeTables,
    splitTables,

    // helper
    fetchTableByCode,
  };
}
