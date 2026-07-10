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
      layout
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

const TABLE_FIELDS = gql`
  fragment FloorManagementTableFields on Table {
    id
    label: code
    capacity
    type
    deposit
    photos
    vrUrl
    notes
    tags
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
      ...FloorManagementTableFields
    }
  }
  ${TABLE_FIELDS}
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
      ...FloorManagementTableFields
    }
  }
  ${TABLE_FIELDS}
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
 * Shared floor and table data for manager/customer floor maps.
 * Per-table model/AR metadata is intentionally excluded; floor maps use only
 * operational position plus photos and 360° panorama content.
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
    [floorsData, publicAccess],
  );
  const [createFloorMut] = useMutation(M_CREATE_FLOOR);
  const [activeLevel, setActiveLevel] = useState(initialFloorLevel ?? null);

  const getIdFromLevel = (level) =>
    floors.find((floor) => Number(floor.level) === Number(level))?.id ?? null;

  const getLevelFromId = (id) =>
    floors.find((floor) => String(floor.id) === String(id))?.level ?? null;

  useEffect(() => {
    if (activeLevel == null && initialFloorId && floors.length) {
      const initialFloor = floors.find(
        (floor) => String(floor.id) === String(initialFloorId),
      );
      if (initialFloor?.level != null) setActiveLevel(Number(initialFloor.level));
    }
  }, [activeLevel, floors, initialFloorId]);

  const activeFloorData = useMemo(
    () =>
      floors.find((floor) => Number(floor.level) === Number(activeLevel)) ??
      floors[0] ??
      null,
    [activeLevel, floors],
  );
  const activeFloorId = activeFloorData?.id ?? null;

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
    [publicAccess, tablesData],
  );

  const setActiveFloorById = (id) => {
    const level = getLevelFromId(id);
    if (level != null) setActiveLevel(level);
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
      if (!restaurantId) throw new Error("Missing restaurantId");
      if (publicAccess) {
        throw new Error("Không thể tạo tầng từ màn khách hàng.");
      }

      const normalizedName = String(name || "").trim();
      if (!normalizedName) throw new Error("Tên tầng không được để trống.");

      const computedLevel =
        level != null
          ? Number(level)
          : floors.reduce(
              (max, floor) => Math.max(max, Number(floor?.level || 0)),
              0,
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
    [createFloorMut, floors, publicAccess, refetchFloors, restaurantId],
  );

  return {
    floors,
    floorsLoading,
    floorsError,
    refetchFloors,
    activeLevel,
    setActiveLevel,
    activeFloorData,
    activeFloorId,
    setActiveFloorById,
    getIdFromLevel,
    getLevelFromId,
    tables,
    tablesLoading,
    tablesError,
    refetchTables,
    createFloor,
  };
}
