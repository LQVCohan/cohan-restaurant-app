import { useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  Q_SUPPLIES_WITH_STOCK,
  M_CREATE_SUPPLY,
  M_UPDATE_SUPPLY,
  M_DELETE_SUPPLY,
  M_ADJUST_SUPPLY,
  M_STOCK_INBOUND,
  M_STOCK_OUTBOUND,
  M_STOCK_TRANSFER,
} from "../components/Dashboard_Manager/Storage/graphql/supply.gql";

const useSupply = (restaurantId, warehouseId = null) => {
  const { data, loading, error, refetch, networkStatus } = useQuery(
    Q_SUPPLIES_WITH_STOCK,
    {
      variables: { restaurantId, warehouseId },
      skip: !restaurantId,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    }
  );

  const supplies = data?.supplies ?? [];

  // Map supplyId -> stockItem
  const stockMap = useMemo(() => {
    const m = new Map();
    for (const s of supplies) {
      m.set(s.id, s.stockItem || { onHand: 0, reserved: 0, batches: [] });
    }
    return m;
  }, [supplies]);

  const getStockItem = useCallback(
    (supplyId) =>
      stockMap.get(supplyId) || { onHand: 0, reserved: 0, batches: [] },
    [stockMap]
  );

  // Mutations
  const [createSupply] = useMutation(M_CREATE_SUPPLY);
  const [updateSupply] = useMutation(M_UPDATE_SUPPLY);
  const [deleteSupply] = useMutation(M_DELETE_SUPPLY);
  const [adjustSupply] = useMutation(M_ADJUST_SUPPLY);
  const [inboundSupply] = useMutation(M_STOCK_INBOUND);
  const [outboundSupply] = useMutation(M_STOCK_OUTBOUND);
  const [transferSupply] = useMutation(M_STOCK_TRANSFER);

  // Helpers
  const writeSupplies = (cache, restaurantIdVar, warehouseIdVar, next) => {
    cache.writeQuery({
      query: Q_SUPPLIES_WITH_STOCK,
      variables: { restaurantId: restaurantIdVar, warehouseId: warehouseIdVar },
      data: { supplies: next },
    });
  };

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Handlers
  const handleCreate = useCallback(
    async (input) => {
      const restId = input.restaurantId || restaurantId;
      const tempId = "temp-supply-" + Date.now();
      const tempStockId = "temp-stockitem-" + tempId;

      const optimisticSupplyWithStock = {
        __typename: "SupplyWithStock",
        id: tempId,
        restaurantId: restId,
        name: input.name,
        category: input.category || "other",
        unit: input.unit || "unit",
        costPerUnit: input.costPerUnit || 0,
        minStock: input.minStock || 0,
        isActive: input.isActive ?? true,
        pricePerUnit: input.pricePerUnit || 0,
        notes: input.notes || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stockItem: {
          __typename: "StockItem",
          id: tempStockId, // ✅ non-null
          restaurantId: restId,
          warehouseId: warehouseId || null,
          costPerUnit: input.costPerUnit || 0,
          pricePerUnit: input.pricePerUnit || 0,
          note: input.notes || "",
          onHand: 0,
          reserved: 0,
          batches: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      await createSupply({
        variables: { input },
        optimisticResponse: {
          createSupply: {
            __typename: "Supply",
            id: tempId,
          restaurantId: restId,
          name: input.name,
          category: input.category || "other",
          unit: input.unit || "unit",
          costPerUnit: input.costPerUnit || 0,
          pricePerUnit: input.pricePerUnit || 0,
          minStock: input.minStock || 0,
          notes: input.notes || "",
          isActive: input.isActive ?? true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
        update: (cache, { data }) => {
          const created = data?.createSupply;
          const existing = cache.readQuery({
            query: Q_SUPPLIES_WITH_STOCK,
            variables: { restaurantId: restId, warehouseId },
          });
          const list = existing?.supplies || [];
          const concrete = {
            __typename: "SupplyWithStock",
            ...created,
            stockItem: {
              ...optimisticSupplyWithStock.stockItem,
              costPerUnit: created?.costPerUnit ?? 0,
              pricePerUnit: created?.pricePerUnit ?? 0,
              note: created?.notes || "",
            },
          };
          writeSupplies(cache, restId, warehouseId, [concrete, ...list]);
        },
      });
    },
    [createSupply, restaurantId, warehouseId]
  );

  const handleUpdate = useCallback(
    async (id, input) => {
      const restId = input.restaurantId || restaurantId;

      await updateSupply({
        variables: { id, input },
        optimisticResponse: {
          updateSupply: {
            __typename: "Supply",
            id,
            ...input,
            pricePerUnit: input.pricePerUnit || 0,
            notes: input.notes || "",
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          const updated = data?.updateSupply;
          if (!updated) return;
          const existing = cache.readQuery({
            query: Q_SUPPLIES_WITH_STOCK,
            variables: { restaurantId: restId, warehouseId },
          });
          if (!existing) return;
          const next = (existing.supplies || []).map((s) =>
            s.id === id ? { ...s, ...updated } : s
          );
          writeSupplies(cache, restId, warehouseId, next);
        },
      });
    },
    [updateSupply, restaurantId, warehouseId]
  );

  const handleDelete = useCallback(
    async (id) => {
      await deleteSupply({
        variables: { id },
        optimisticResponse: { deleteSupply: true, __typename: "Mutation" },
        update: (cache, { data }) => {
          const ok = data?.deleteSupply;
          if (!ok) return;
          const existing = cache.readQuery({
            query: Q_SUPPLIES_WITH_STOCK,
            variables: { restaurantId, warehouseId },
          });
          if (!existing) return;
          const next = (existing.supplies || []).filter((s) => s.id !== id);
          writeSupplies(cache, restaurantId, warehouseId, next);
        },
      });
    },
    [deleteSupply, restaurantId, warehouseId]
  );

  const handleAdjust = useCallback(
    async (input) => {
      const restId = input.restaurantId || restaurantId;
      const current = getStockItem(input.supplyId);
      const nextOnHand = (current.onHand || 0) + Number(input.qty || 0);
      const tempStockId = current.id || "temp-stockitem-" + input.supplyId;

      await adjustSupply({
        variables: { input },
        optimisticResponse: {
          adjustSupply: {
            __typename: "StockItem",
            id: tempStockId, // ✅ non-null
            warehouseId: warehouseId || null,
            onHand: nextOnHand,
            reserved: current.reserved || 0,
            costPerUnit: current.costPerUnit ?? null,
            pricePerUnit: current.pricePerUnit ?? null,
            note: current.note ?? null,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          const updated = data?.adjustSupply;
          const existing = cache.readQuery({
            query: Q_SUPPLIES_WITH_STOCK,
            variables: { restaurantId: restId, warehouseId },
          });
          if (!existing) return;
          const next = (existing.supplies || []).map((s) =>
            s.id === input.supplyId
              ? { ...s, stockItem: { ...(s.stockItem || {}), ...updated } }
              : s
          );
          writeSupplies(cache, restId, warehouseId, next);
        },
      });
    },
    [adjustSupply, getStockItem, restaurantId, warehouseId]
  );

  const handleInbound = useCallback(
    async (input) => {
      const restId = input.restaurantId || restaurantId;
      const current = getStockItem(input.supplyId);
      const nextOnHand = (current.onHand || 0) + Number(input.qty || 0);
      const tempStockId = current.id || "temp-stockitem-" + input.supplyId;

      await inboundSupply({
        variables: { input },
        optimisticResponse: {
          stockInbound: {
            __typename: "StockItem",
            id: tempStockId, // ✅ non-null
            warehouseId: warehouseId || null,
            onHand: nextOnHand,
            reserved: current.reserved || 0,
            costPerUnit: current.costPerUnit ?? null,
            pricePerUnit: current.pricePerUnit ?? null,
            note: current.note ?? null,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          const updated = data?.stockInbound;
          const existing = cache.readQuery({
            query: Q_SUPPLIES_WITH_STOCK,
            variables: { restaurantId: restId, warehouseId },
          });
          if (!existing) return;
          const next = (existing.supplies || []).map((s) =>
            s.id === input.supplyId
              ? { ...s, stockItem: { ...(s.stockItem || {}), ...updated } }
              : s
          );
          writeSupplies(cache, restId, warehouseId, next);
        },
      });
    },
    [inboundSupply, getStockItem, restaurantId, warehouseId]
  );

  const handleOutbound = useCallback(
    async (input) => {
      const restId = input.restaurantId || restaurantId;
      const current = getStockItem(input.supplyId);
      const nextOnHand = (current.onHand || 0) - Number(input.qty || 0);
      const tempStockId = current.id || "temp-stockitem-" + input.supplyId;

      await outboundSupply({
        variables: { input },
        optimisticResponse: {
          stockOutbound: {
            __typename: "StockItem",
            id: tempStockId, // ✅ non-null
            warehouseId: warehouseId || null,
            onHand: nextOnHand,
            reserved: current.reserved || 0,
            costPerUnit: current.costPerUnit ?? null,
            pricePerUnit: current.pricePerUnit ?? null,
            note: current.note ?? null,
            updatedAt: new Date().toISOString(),
          },
        },
        update: (cache, { data }) => {
          const updated = data?.stockOutbound;
          const existing = cache.readQuery({
            query: Q_SUPPLIES_WITH_STOCK,
            variables: { restaurantId: restId, warehouseId },
          });
          if (!existing) return;
          const next = (existing.supplies || []).map((s) =>
            s.id === input.supplyId
              ? { ...s, stockItem: { ...(s.stockItem || {}), ...updated } }
              : s
          );
          writeSupplies(cache, restId, warehouseId, next);
        },
      });
    },
    [outboundSupply, getStockItem, restaurantId, warehouseId]
  );

  const handleTransfer = useCallback(
    async (input) => {
      await transferSupply({ variables: { input } });
      await refresh();
    },
    [transferSupply, refresh]
  );

  const isRefetching = networkStatus === 3;

  return {
    supplies,
    stockMap,
    getStockItem,
    loading: loading || isRefetching,
    error,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleAdjust,
    handleInbound,
    handleOutbound,
    handleTransfer,
    refresh,
  };
};

export default useSupply;
