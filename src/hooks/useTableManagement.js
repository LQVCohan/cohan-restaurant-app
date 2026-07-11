import { gql, useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo } from "react";
import { useNotification } from "./useNotification";
import { TABLE_CUSTOMER_SOCKET_EVENT } from "./useSocketOrder";

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

const Q_TABLES = gql`
  query Tables($restaurantId: ID!) {
    tables(restaurantId: $restaurantId) {
      ...TableMin
    }
  }
  ${F_TABLE_MIN}
`;

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

export const stripLegacyTableVisualFields = (
  input,
  { dropPositionWithVisualConfig = false } = {},
) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;

  const hasLegacyVisualConfig = Object.prototype.hasOwnProperty.call(
    input,
    "visualConfig",
  );
  const { visualConfig: _legacyVisualConfig, ...safeInput } = input;

  // AR placement sent both visualConfig and a derived floor position. When the
  // legacy field is present, reject that paired coordinate at the client boundary.
  if (hasLegacyVisualConfig && dropPositionWithVisualConfig) {
    delete safeInput.position;
  }

  return safeInput;
};

export default function useTableManagement({ restaurantId }) {
  const { showNotification } = useNotification();
  const { data, loading, error, refetch } = useQuery(Q_TABLES, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (typeof window === "undefined" || !restaurantId) return undefined;

    const handleTableCustomerUpdate = (event) => {
      const socketEvent = event?.detail?.event;
      if (socketEvent?.type !== "TABLE_CUSTOMER_UPDATED") return;
      if (
        String(socketEvent?.restaurantId || "") !== String(restaurantId || "")
      ) {
        return;
      }
      Promise.resolve(refetch()).catch(() => {});
    };

    window.addEventListener(
      TABLE_CUSTOMER_SOCKET_EVENT,
      handleTableCustomerUpdate,
    );
    return () => {
      window.removeEventListener(
        TABLE_CUSTOMER_SOCKET_EVENT,
        handleTableCustomerUpdate,
      );
    };
  }, [refetch, restaurantId]);

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

  const [createMut] = useMutation(M_CREATE);
  const [updateMut] = useMutation(M_UPDATE, {
    update(cache, { data: mutationData }) {
      if (!mutationData?.updateTable) return;
      writeTable(cache, mutationData.updateTable);
    },
  });

  const [deleteMut] = useMutation(M_DELETE, {
    update(cache, { variables }) {
      const idRef = cache.identify({
        __typename: "Table",
        id: variables.id,
      });
      cache.evict({ id: idRef });
      cache.gc();
    },
  });

  const [setStatusMut] = useMutation(M_SET_STATUS, {
    update(cache, { data: mutationData }) {
      const table = mutationData?.setTableStatus;
      if (!table) return;
      cache.modify({
        id: cache.identify({ __typename: "Table", id: table.id }),
        fields: { status: () => table.status },
      });
    },
  });

  const [moveMut] = useMutation(M_MOVE, {
    update(cache, { data: mutationData }) {
      const table = mutationData?.moveTable;
      if (!table) return;
      cache.modify({
        id: cache.identify({ __typename: "Table", id: table.id }),
        fields: {
          floorId: () => table.floorId,
          floorLevel: () => table.floorLevel,
          position: () => table.position,
        },
      });
    },
  });

  const [swapCodesMut] = useMutation(M_SWAP_CODES, {
    optimisticResponse: () => ({ swapTableCodes: true }),
    update(cache, { variables }) {
      const { aId, bId } = variables.input;
      const tableA = readTable(cache, aId);
      const tableB = readTable(cache, bId);
      if (!tableA || !tableB) return;
      cache.modify({
        id: cache.identify({ __typename: "Table", id: aId }),
        fields: { code: () => tableB.code },
      });
      cache.modify({
        id: cache.identify({ __typename: "Table", id: bId }),
        fields: { code: () => tableA.code },
      });
    },
  });

  const [bulkUpsertMut] = useMutation(M_BULK_UPSERT);
  const [mergeMut] = useMutation(M_MERGE);
  const [splitMut] = useMutation(M_SPLIT);

  const tables = useMemo(() => data?.tables ?? [], [data]);

  const createTable = useCallback(
    async (input) => {
      const safeInput = stripLegacyTableVisualFields(input);
      return (
        await createMut({ variables: { input: safeInput } })
      )?.data?.createTable;
    },
    [createMut],
  );

  const updateTable = useCallback(
    async (input) => {
      const safeInput = stripLegacyTableVisualFields(input, {
        dropPositionWithVisualConfig: true,
      });
      return (
        await updateMut({ variables: { input: safeInput } })
      )?.data?.updateTable;
    },
    [updateMut],
  );

  const deleteTable = useCallback(
    async (id) =>
      (await deleteMut({ variables: { id } }))?.data?.deleteTable ?? false,
    [deleteMut],
  );

  const setTableStatus = useCallback(
    async ({ id, status }) =>
      (
        await setStatusMut({
          variables: { input: { id, status } },
        })
      )?.data?.setTableStatus,
    [setStatusMut],
  );

  const moveTable = useCallback(
    async ({ id, floorId, position }) =>
      (
        await moveMut({
          variables: { input: { id, floorId, position } },
        })
      )?.data?.moveTable,
    [moveMut],
  );

  const swapTableCodes = useCallback(
    async ({ restaurantId: scopedRestaurantId, floorId, aId, bId }) =>
      (
        await swapCodesMut({
          variables: {
            input: {
              restaurantId: scopedRestaurantId,
              floorId,
              aId,
              bId,
            },
          },
        })
      )?.data?.swapTableCodes ?? true,
    [swapCodesMut],
  );

  const bulkUpsertTables = useCallback(
    async (input) =>
      (
        await bulkUpsertMut({
          variables: { input },
        })
      )?.data?.bulkUpsertTables,
    [bulkUpsertMut],
  );

  const mergeTables = useCallback(
    async ({ tableIds, anchorId, joinGroupId }) => {
      const result = (
        await mergeMut({
          variables: {
            input: {
              restaurantId,
              tableIds,
              anchorId,
              joinGroupId,
            },
          },
        })
      )?.data?.mergeTables;

      showNotification(
        result?.mergedTableCode
          ? `Đã ghép bàn thành ${result.mergedTableCode}.`
          : "Đã ghép bàn thành công.",
        "success",
      );
      return result;
    },
    [mergeMut, restaurantId, showNotification],
  );

  const splitTables = useCallback(
    async ({ joinGroupId, mode, tableIds }) => {
      const result = (
        await splitMut({
          variables: {
            input: {
              restaurantId,
              joinGroupId,
              mode,
              tableIds,
            },
          },
        })
      )?.data?.splitTables;

      showNotification("Đã tách bàn thành công.", "success");
      return result;
    },
    [restaurantId, showNotification, splitMut],
  );

  const fetchTableByCode = useCallback(
    (code, scopedRestaurantId) => {
      const resolvedRestaurantId = scopedRestaurantId ?? restaurantId ?? "";
      return (
        tables.find(
          (table) =>
            String(table.code || "").toLowerCase() ===
              String(code || "").toLowerCase() &&
            String(table.restaurantId || "") ===
              String(resolvedRestaurantId),
        ) || null
      );
    },
    [restaurantId, tables],
  );

  return {
    tables,
    tablesLoading: loading,
    tablesError: error,
    refetchTables: refetch,
    createTable,
    updateTable,
    deleteTable,
    setTableStatus,
    moveTable,
    swapTableCodes,
    bulkUpsertTables,
    mergeTables,
    splitTables,
    fetchTableByCode,
  };
}
