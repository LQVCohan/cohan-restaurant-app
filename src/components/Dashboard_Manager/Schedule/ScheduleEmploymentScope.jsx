import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { gql, useApolloClient, useQuery } from "@apollo/client";

export const SCHEDULE_EMPLOYMENT_SCOPES = {
  ALL: "all",
  FULL_TIME: "full_time",
  PART_TIME: "part_time",
  ROTATING: "rotating",
};

const FULL_TIME_TYPES = new Set(["full_time", "probation", "contract"]);
const PART_TIME_TYPES = new Set(["part_time", "seasonal"]);

const GET_SCHEDULE_SCOPE_ME = gql`
  query ScheduleScopeMe {
    me {
      id
      roleName
    }
  }
`;

const GET_SCHEDULE_SCOPE_RESTAURANTS = gql`
  query ScheduleScopeRestaurants($limit: Int = 100, $cursor: ID) {
    scopedRestaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const GET_SCHEDULE_SCOPE_ALL_RESTAURANTS = gql`
  query ScheduleScopeAllRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const GET_SCHEDULE_STAFF_SHIFT_TYPES = gql`
  query ScheduleStaffShiftTypes($restaurantId: ID!) {
    staffList(restaurantId: $restaurantId) {
      id
      shiftType
    }
  }
`;

const ScheduleEmploymentScopeContext = createContext(
  SCHEDULE_EMPLOYMENT_SCOPES.ALL,
);
const ScheduleStaffShiftTypeContext = createContext(new Map());

const idString = (value) => String(value?.id || value?._id || value || "");

export function normalizeEmploymentType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeStaffShiftType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function resolveStaffShiftType(staff, shiftTypeByStaffId = new Map()) {
  const directShiftType = normalizeStaffShiftType(staff?.shiftType);
  if (directShiftType) return directShiftType;
  return normalizeStaffShiftType(
    shiftTypeByStaffId?.get?.(idString(staff?.id || staff?._id)),
  );
}

export function matchesScheduleEmploymentScope(
  staff,
  scope,
  shiftTypeByStaffId = new Map(),
) {
  if (!scope || scope === SCHEDULE_EMPLOYMENT_SCOPES.ALL) return true;

  const shiftType = resolveStaffShiftType(staff, shiftTypeByStaffId);
  const isRotatingStaff = shiftType === SCHEDULE_EMPLOYMENT_SCOPES.ROTATING;

  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.ROTATING) {
    return isRotatingStaff;
  }

  // Nhân viên được cấu hình xoay ca có khu vực riêng, tránh bị lẫn hoặc biến mất
  // trong hai khu vực toàn thời gian / bán thời gian.
  if (isRotatingStaff) return false;

  const employmentType = normalizeEmploymentType(staff?.employmentType);
  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.PART_TIME) {
    return PART_TIME_TYPES.has(employmentType);
  }
  if (scope === SCHEDULE_EMPLOYMENT_SCOPES.FULL_TIME) {
    return FULL_TIME_TYPES.has(employmentType);
  }
  return true;
}

export function filterStaffForScheduleScope(
  staffList = [],
  scope = "all",
  shiftTypeByStaffId = new Map(),
) {
  return (staffList || []).filter((staff) =>
    matchesScheduleEmploymentScope(staff, scope, shiftTypeByStaffId),
  );
}

export function ScheduleEmploymentScopeProvider({ scope = "all", children }) {
  const value = useMemo(() => scope || "all", [scope]);
  const apolloClient = useApolloClient();
  const [shiftTypeByStaffId, setShiftTypeByStaffId] = useState(new Map());

  const { data: meData } = useQuery(GET_SCHEDULE_SCOPE_ME, {
    fetchPolicy: "cache-first",
  });
  const isAdmin = meData?.me?.roleName === "admin";

  const { data: scopedRestaurantsData } = useQuery(
    GET_SCHEDULE_SCOPE_RESTAURANTS,
    {
      variables: { limit: 100 },
      skip: !meData?.me?.id || isAdmin,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  );
  const { data: allRestaurantsData } = useQuery(
    GET_SCHEDULE_SCOPE_ALL_RESTAURANTS,
    {
      variables: { limit: 100 },
      skip: !isAdmin,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  );

  const restaurantIds = useMemo(() => {
    const edges = isAdmin
      ? allRestaurantsData?.restaurants?.edges
      : scopedRestaurantsData?.scopedRestaurants?.edges;
    return Array.from(
      new Set((edges || []).map((edge) => idString(edge?.node?.id)).filter(Boolean)),
    );
  }, [allRestaurantsData, isAdmin, scopedRestaurantsData]);
  const restaurantIdsKey = restaurantIds.join("|");

  useEffect(() => {
    let cancelled = false;

    if (!restaurantIds.length) {
      setShiftTypeByStaffId(new Map());
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      restaurantIds.map((restaurantId) =>
        apolloClient.query({
          query: GET_SCHEDULE_STAFF_SHIFT_TYPES,
          variables: { restaurantId },
          fetchPolicy: "cache-first",
        }),
      ),
    )
      .then((responses) => {
        if (cancelled) return;
        const nextMap = new Map();
        responses.forEach((response) => {
          (response?.data?.staffList || []).forEach((staff) => {
            const staffId = idString(staff?.id);
            if (!staffId) return;
            nextMap.set(staffId, normalizeStaffShiftType(staff?.shiftType));
          });
        });
        setShiftTypeByStaffId(nextMap);
      })
      .catch(() => {
        if (!cancelled) setShiftTypeByStaffId(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [apolloClient, restaurantIdsKey]);

  return (
    <ScheduleEmploymentScopeContext.Provider value={value}>
      <ScheduleStaffShiftTypeContext.Provider value={shiftTypeByStaffId}>
        {children}
      </ScheduleStaffShiftTypeContext.Provider>
    </ScheduleEmploymentScopeContext.Provider>
  );
}

export function useScheduleEmploymentScope() {
  return useContext(ScheduleEmploymentScopeContext);
}

export function useScheduleStaffShiftTypes() {
  return useContext(ScheduleStaffShiftTypeContext);
}
