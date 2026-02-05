import { gql, useQuery } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";

const Q_FLOORS = gql`
  query Floors($restaurantId: ID!) {
    floors(restaurantId: $restaurantId) {
      id
      name
      level
      description
      planImage
      isActive
      isWatching

      # Dữ liệu layout (tường, cửa, bếp, quầy bar...)
      layout

      # Kích thước / meta (nếu có dùng)
      meta {
        width
        height
      }
    }
  }
`;

const Q_TABLES = gql`
  query Tables(
    $restaurantId: ID!
    $floorId: ID!
    $status: TableStatus
    $limit: Int
  ) {
    tables(
      restaurantId: $restaurantId
      floorId: $floorId
      status: $status
      limit: $limit
    ) {
      id
      label: code
      capacity
      position {
        x
        y
      }
      status
    }
  }
`;

/**
 * Hook quản lý tầng + bàn + layout
 *
 * @param restaurantId: ID nhà hàng
 * @param initialFloorLevel: level ban đầu muốn chọn
 * @param initialFloorId: nếu có id tầng cụ thể ban đầu
 * @param tableStatus: filter status bàn (optional)
 * @param tableLimit: limit số bàn (default 200)
 */
export default function useFloorManagement({
  restaurantId,
  initialFloorLevel = null,
  initialFloorId = null,
  tableStatus = null,
  tableLimit = 200,
}) {
  // 1. Query floors
  const {
    data: floorsData,
    loading: floorsLoading,
    error: floorsError,
    refetch: refetchFloors,
  } = useQuery(Q_FLOORS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const floors = useMemo(() => floorsData?.floors ?? [], [floorsData]);

  // 2. Active level / floor
  const [activeLevel, setActiveLevel] = useState(initialFloorLevel ?? null);

  // Helper: tra id từ level / level từ id
  const getIdFromLevel = (lvl) =>
    floors.find((f) => Number(f.level) === Number(lvl))?.id ?? null;

  const getLevelFromId = (id) =>
    floors.find((f) => String(f.id) === String(id))?.level ?? null;

  // Nếu chưa có activeLevel mà có initialFloorId -> map sang level
  useEffect(() => {
    if (activeLevel == null && initialFloorId && floors.length) {
      const f = floors.find((x) => String(x.id) === String(initialFloorId));
      if (f?.level != null) setActiveLevel(Number(f.level));
    }
  }, [floors, initialFloorId, activeLevel]);

  // Tầng đang active (object đầy đủ)
  const activeFloorData = useMemo(
    () =>
      floors.find((f) => Number(f.level) === Number(activeLevel)) ??
      floors[0] ??
      null,
    [floors, activeLevel]
  );

  const activeFloorId = activeFloorData?.id ?? null;

  // 3. Query tables của tầng đang chọn
  const {
    data: tablesData,
    loading: tablesLoading,
    error: tablesError,
    refetch: refetchTables,
  } = useQuery(Q_TABLES, {
    variables: {
      restaurantId,
      floorId: activeFloorId,
      status: tableStatus,
      limit: tableLimit,
    },
    skip: !restaurantId || !activeFloorId,
    fetchPolicy: "network-only",
  });

  const tables = useMemo(() => tablesData?.tables ?? [], [tablesData]);

  // Helpers set floor theo id
  const setActiveFloorById = (id) => {
    const lvl = getLevelFromId(id);
    if (lvl != null) setActiveLevel(lvl);
  };

  return {
    // floors
    floors,
    floorsLoading,
    floorsError,
    refetchFloors,

    // active floor
    activeLevel,
    setActiveLevel,
    activeFloorData,
    activeFloorId,
    setActiveFloorById,
    getIdFromLevel,
    getLevelFromId,

    // tables
    tables,
    tablesLoading,
    tablesError,
    refetchTables,
  };
}
