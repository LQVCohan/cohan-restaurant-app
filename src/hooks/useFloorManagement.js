// useFloorManagement.js
import { gql, useQuery } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";

const Q_FLOORS = gql`
  query Floors($restaurantId: ID!) {
    floors(restaurantId: $restaurantId) {
      id
      name
      level
    }
  }
`;

export default function useFloorManagement({
  restaurantId,
  initialFloorLevel = null,
  initialFloorId = null,
}) {
  const { data, loading, error, refetch } = useQuery(Q_FLOORS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  // Danh sách tầng
  const floors = useMemo(() => data?.floors ?? [], [data]);

  // activeLevel: filter chính trên FE
  const [activeLevel, setActiveLevel] = useState(initialFloorLevel ?? null);

  // Nếu không truyền initialFloorLevel nhưng có initialFloorId → map sang level khi floors sẵn sàng
  useEffect(() => {
    if (activeLevel == null && initialFloorId && floors.length) {
      const f = floors.find((x) => String(x.id) === String(initialFloorId));
      if (f?.level != null) setActiveLevel(Number(f.level));
    }
  }, [floors, initialFloorId, activeLevel]);

  // helper: tra level/id
  const getIdFromLevel = (lvl) =>
    floors.find((f) => f.level === Number(lvl))?.id ?? null;
  const getLevelFromId = (id) =>
    floors.find((f) => String(f.id) === String(id))?.level ?? null;

  return {
    floors,
    floorsLoading: loading,
    floorsError: error,
    refetchFloors: refetch,
    activeLevel,
    setActiveLevel,
    getIdFromLevel,
    getLevelFromId,
  };
}
