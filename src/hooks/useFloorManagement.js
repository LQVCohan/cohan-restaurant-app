import { gql, useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useState } from "react";

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

const Q_PUBLIC_FLOORS = gql`
  query PublicFloors($restaurantId: ID!) {
    publicFloors(restaurantId: $restaurantId) {
      id
      name
      level
      description
      planImage
      isActive
      isWatching
      layout
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
      type
      deposit
      photos
      vrUrl
      notes
      tags
      visualConfig
      position {
        x
        y
        w
        h
        rotation
        shape
        path
      }
      status
      isViewingLocked
      viewLockUserId
      viewLockExpiresAt
      viewLockViewerName
    }
  }
`;

const Q_PUBLIC_TABLES = gql`
  query PublicTables(
    $restaurantId: ID!
    $floorId: ID!
    $status: TableStatus
    $limit: Int
  ) {
    publicTables(
      restaurantId: $restaurantId
      floorId: $floorId
      status: $status
      limit: $limit
    ) {
      id
      label: code
      capacity
      type
      deposit
      photos
      vrUrl
      notes
      tags
      visualConfig
      position {
        x
        y
        w
        h
        rotation
        shape
        path
      }
      status
      isViewingLocked
      viewLockUserId
      viewLockExpiresAt
      viewLockViewerName
    }
  }
`;

const M_CREATE_FLOOR = gql`
  mutation CreateFloor($input: CreateFloorInput!) {
    createFloor(input: $input) {
      id
      restaurantId
      name
      level
      description
      planImage
      isActive
      isWatching
      layout
      meta {
        width
        height
      }
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
 * @param publicAccess: dùng query public cho màn khách hàng
 */
export default function useFloorManagement({
  restaurantId,
  initialFloorLevel = null,
  initialFloorId = null,
  tableStatus = null,
  tableLimit = 200,
  enabled = true,
  publicAccess = false,
}) {
  // 1. Query floors
  const {
    data: floorsData,
    loading: floorsLoading,
    error: floorsError,
    refetch: refetchFloors,
  } = useQuery(publicAccess ? Q_PUBLIC_FLOORS : Q_FLOORS, {
    variables: { restaurantId },
    skip: !enabled || !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const floors = useMemo(
    () => (publicAccess ? floorsData?.publicFloors : floorsData?.floors) ?? [],
    [floorsData, publicAccess]
  );
  const [createFloorMut] = useMutation(M_CREATE_FLOOR);

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
  } = useQuery(publicAccess ? Q_PUBLIC_TABLES : Q_TABLES, {
    variables: {
      restaurantId,
      floorId: activeFloorId,
      status: tableStatus,
      limit: tableLimit,
    },
    skip: !enabled || !restaurantId || !activeFloorId,
    fetchPolicy: "network-only",
  });

  const tables = useMemo(
    () => (publicAccess ? tablesData?.publicTables : tablesData?.tables) ?? [],
    [tablesData, publicAccess]
  );

  // Helpers set floor theo id
  const setActiveFloorById = (id) => {
    const lvl = getLevelFromId(id);
    if (lvl != null) setActiveLevel(lvl);
  };

  const createFloor = useCallback(
    async ({
      name,
      level,
      description = "",
      planImage = "",
      isActive = true,
      isWatching = false,
      layout = [],
      meta = { width: 2000, height: 2000 },
    }) => {
      if (!restaurantId) {
        throw new Error("Missing restaurantId");
      }
      if (publicAccess) {
        throw new Error("Không thể tạo tầng từ màn khách hàng.");
      }
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        throw new Error("Tên tầng không được để trống.");
      }

      const computedLevel =
        level != null
          ? Number(level)
          : (floors || []).reduce(
              (max, floor) => Math.max(max, Number(floor?.level || 0)),
              0
            ) + 1;

      if (!Number.isFinite(computedLevel) || computedLevel < 1) {
        throw new Error("Level tầng không hợp lệ.");
      }

      const created =
        (
          await createFloorMut({
            variables: {
              input: {
                restaurantId,
                name: normalizedName,
                level: Math.trunc(computedLevel),
                description,
                planImage,
                isActive,
                isWatching,
                layout,
                meta,
              },
            },
          })
        )?.data?.createFloor ?? null;

      await refetchFloors();
      return created;
    },
    [restaurantId, floors, createFloorMut, refetchFloors, publicAccess]
  );

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

    // mutations
    createFloor,
  };
}
