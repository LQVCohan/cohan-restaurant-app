// src/hooks/useUserManagement.js
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";

/* ========================= GraphQL ========================= */

export const GET_ROLE_LIST = gql`
  query GetRoleList {
    roleList {
      id
      name
      slug
      description
      createdAt
      updatedAt
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers($roleId: ID, $search: String, $isGuest: Boolean) {
    users(roleId: $roleId, search: $search, isGuest: $isGuest) {
      id
      fullName
      username
      email
      phone
      address {
        line1
        line2
        ward
        district
        city
        country
      }
      role {
        id
        name
        slug
      }
      roleName
      status
      provider
      avatarUrl
      refRestaurants {
        id
        name
      }
      point
      loyaltyPoints
      customerType
      totalOrders
      totalSpending
      emailVerified
      isGuest
      guestExpiresAt
      createdAt
      updatedAt
      createdBy {
        id
        fullName
      }
      updatedBy {
        id
        fullName
      }
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      token
      user {
        id
        fullName
        username
        email
        phone
        address {
          line1
          line2
          ward
          district
          city
          country
        }
        role {
          id
          name
          slug
        }
        roleName
        status
        provider
        avatarUrl
        refRestaurants {
          id
          name
        }
        point
        loyaltyPoints
        customerType
        totalOrders
        totalSpending
        emailVerified
        isGuest
        guestExpiresAt
        createdAt
        updatedAt
        createdBy {
          id
          fullName
        }
        updatedBy {
          id
          fullName
        }
      }
    }
  }
`;

export const CREATE_GUEST_USER = gql`
  mutation CreateGuestUser(
    $fullName: String
    $phone: String
    $expiresInDays: Int
  ) {
    createGuestUser(
      fullName: $fullName
      phone: $phone
      expiresInDays: $expiresInDays
    ) {
      id
      fullName
      phone
      isGuest
      guestExpiresAt
      status
      createdAt
    }
  }
`;

export const UPDATE_MY_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      fullName
      username
      email
      phone
      address {
        line1
        line2
        ward
        district
        city
        country
      }
      role {
        id
        name
        slug
      }
      roleName
      status
      provider
      avatarUrl
      refRestaurants {
        id
        name
      }
      point
      loyaltyPoints
      customerType
      totalOrders
      totalSpending
      emailVerified
      isGuest
      guestExpiresAt
      createdAt
      updatedAt
      createdBy {
        id
        fullName
      }
      updatedBy {
        id
        fullName
      }
    }
  }
`;

export const ADMIN_UPDATE_USER = gql`
  mutation AdminUpdateUser($userId: ID!, $input: AdminUpdateUserInput!) {
    adminUpdateUser(userId: $userId, input: $input) {
      id
      fullName
      username
      email
      phone
      address {
        line1
        line2
        ward
        district
        city
        country
      }
      role {
        id
        name
        slug
      }
      roleName
      status
      provider
      avatarUrl
      refRestaurants {
        id
        name
      }
      point
      loyaltyPoints
      customerType
      totalOrders
      totalSpending
      emailVerified
      isGuest
      guestExpiresAt
      createdAt
      updatedAt
      createdBy {
        id
        fullName
      }
      updatedBy {
        id
        fullName
      }
    }
  }
`;

/* NEW: mutation dùng riêng cho CustomerModal để đồng bộ điểm & phân hạng */
export const UPDATE_CUSTOMER_METRICS = gql`
  mutation UpdateCustomerMetrics(
    $id: ID!
    $loyaltyPoints: Int!
    $customerType: CustomerType!
  ) {
    updateCustomerMetrics(
      id: $id
      loyaltyPoints: $loyaltyPoints
      customerType: $customerType
    ) {
      id
      loyaltyPoints
      customerType
      updatedAt
    }
  }
`;

export const ASSIGN_ROLE_TO_USER = gql`
  mutation AssignRoleToUser($input: AssignRoleToUserInput!) {
    assignRoleToUser(input: $input) {
      id
      fullName
      email
      phone
      status
      isGuest
      role {
        id
        name
        slug
      }
      roleName
      updatedAt
    }
  }
`;

export const SET_USER_STATUS = gql`
  mutation SetUserStatus($userId: ID!, $status: String!) {
    setUserStatus(userId: $userId, status: $status) {
      id
      status
      roleName
      updatedAt
    }
  }
`;

export const SOFT_DELETE_USER = gql`
  mutation SoftDeleteUser($userId: ID!) {
    softDeleteUser(userId: $userId)
  }
`;

/* ========================= Utils mapping ========================= */

const toVietnamCustomerType = (customerType) => {
  const t = (customerType || "").toUpperCase();
  if (t === "VIP") return "VIP";
  if (t === "OFTEN") return "Thường xuyên";
  return "Mới"; // NEW
};

const toISODateOrNull = (v) => {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const ms = s.length === 10 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
};

const statusToCardStatus = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "active") return "online";
  if (s === "pending") return "away";
  return "offline";
};

const avatarEmojiFromType = (customerType) => {
  const t = (customerType || "").toUpperCase();
  if (t === "VIP") return "👑";
  if (t === "OFTEN") return "🔥";
  return "👤";
};

/* === Loyalty compute (chuẩn hoá theo yêu cầu) === */
const computePointsFromSpending = (spending) =>
  Math.max(0, Math.floor((Number(spending) || 0) / 1000));
const computeTypeFromPoints = (points) => {
  if (points < 5000) return "NEW";
  if (points <= 15000) return "OFTEN";
  return "VIP";
};

/* ========================= Hook ========================= */

const useUserManagement = () => {
  // UI states
  const [selectedRestaurant, setSelectedRestaurant] = useState("saigon");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | vip | new | frequent

  // Data
  const [usersCache, setUsersCache] = useState([]);

  // Remember last fetch purpose
  const lastFetch = useRef({ purpose: null, variables: {} });

  // Roles
  const { data: rolesData } = useQuery(GET_ROLE_LIST, {
    fetchPolicy: "cache-first",
  });
  const roleMap = useMemo(() => {
    const map = {};
    (rolesData?.roleList || []).forEach((r) => {
      if (r?.slug) map[r.slug.toLowerCase()] = r.id;
    });
    return map;
  }, [rolesData]);

  // Users
  const [fetchUsers, { loading: usersLoading, error: usersError }] =
    useLazyQuery(GET_USERS, {
      fetchPolicy: "network-only",
      onCompleted: (d) => setUsersCache(d?.users || []),
    });

  // Mutations
  const [createUserMut, { loading: creating }] = useMutation(CREATE_USER, {
    onCompleted: () => refreshLast(),
  });
  const [createGuestMut, { loading: creatingGuest }] = useMutation(
    CREATE_GUEST_USER,
    {
      onCompleted: () => refreshLast(),
    }
  );
  const [updateMyUserMut, { loading: updatingMe }] = useMutation(
    UPDATE_MY_USER,
    {
      onCompleted: () => refreshLast(),
    }
  );
  const [adminUpdateUserMut, { loading: adminUpdating }] = useMutation(
    ADMIN_UPDATE_USER,
    {
      onCompleted: () => refreshLast(),
    }
  );
  const [assignRoleMut, { loading: assigningRole }] = useMutation(
    ASSIGN_ROLE_TO_USER,
    {
      onCompleted: () => refreshLast(),
    }
  );
  const [setStatusMut, { loading: settingStatus }] = useMutation(
    SET_USER_STATUS,
    {
      onCompleted: () => refreshLast(),
    }
  );
  const [softDeleteMut, { loading: softDeleting }] = useMutation(
    SOFT_DELETE_USER,
    {
      onCompleted: () => refreshLast(),
    }
  );

  // NEW: mutation chuyên cập nhật loyaltyPoints + customerType (được CustomerModal dùng thẳng)
  const [updateMetricsMut, { loading: updatingMetrics }] = useMutation(
    UPDATE_CUSTOMER_METRICS
  );

  const refreshLast = useCallback(() => {
    const { purpose, variables } = lastFetch.current || {};
    if (!purpose) return;
    if (purpose === "allUsers") fetchUsers({ variables });
    else if (purpose === "customers") getCustomers(variables);
  }, [fetchUsers]); // eslint-disable-line

  /* ===== Fetch ===== */

  const getAllUsers = useCallback(
    ({ roleId, search, isGuest } = {}) => {
      const variables = {
        roleId: roleId || undefined,
        search:
          (typeof search === "string" ? search : searchQuery) || undefined,
        isGuest: typeof isGuest === "boolean" ? isGuest : undefined,
      };
      lastFetch.current = { purpose: "allUsers", variables };
      return fetchUsers({ variables });
    },
    [fetchUsers, searchQuery]
  );

  const getCustomers = useCallback(
    ({ includeGuests = true, search } = {}) => {
      const customerRoleId = roleMap["customer"];
      const v1 = {
        roleId: customerRoleId || undefined,
        search:
          (typeof search === "string" ? search : searchQuery) || undefined,
      };
      lastFetch.current = {
        purpose: "customers",
        variables: { includeGuests, search },
      };

      fetchUsers({ variables: v1 });
      if (includeGuests) {
        fetchUsers({
          variables: { roleId: undefined, search: v1.search, isGuest: true },
        });
      }
    },
    [fetchUsers, roleMap, searchQuery]
  );

  /* ===== Auto-sync loyalty (theo FE rule) =====
     - Tính points từ totalSpending
     - Tính customerType từ points
     - Nếu khác DB ⇒ gọi adminUpdateUser để đồng bộ
     - Giới hạn mỗi đợt tối đa 10 user để tránh spam
  */
  useEffect(() => {
    if (!usersCache?.length) return;
    const candidates = [];
    for (const u of usersCache) {
      const computedPoints = computePointsFromSpending(u?.totalSpending || 0);
      const computedType = computeTypeFromPoints(computedPoints);
      const dbPoints = Number(u?.loyaltyPoints || 0);
      const dbType = (u?.customerType || "").toUpperCase();

      if (computedPoints !== dbPoints || computedType !== dbType) {
        candidates.push({
          id: u.id,
          loyaltyPoints: computedPoints,
          customerType: computedType,
        });
        if (candidates.length >= 10) break; // throttle
      }
    }
    if (!candidates.length) return;

    (async () => {
      try {
        for (const c of candidates) {
          await adminUpdateUserMut({
            variables: {
              userId: c.id,
              input: {
                loyaltyPoints: c.loyaltyPoints,
                customerType: c.customerType,
              },
            },
          });
        }
      } catch {
        // im lặng — không block UI
      }
    })();
  }, [usersCache, adminUpdateUserMut]);

  /* ===== Derived ===== */

  const allUsers = usersCache;

  const customers = useMemo(() => {
    const roleCustomers = allUsers.filter(
      (u) => u.role?.slug?.toLowerCase() === "customer"
    );
    const guests = allUsers.filter((u) => u.isGuest === true);
    const merged = [...roleCustomers, ...guests].reduce((acc, cur) => {
      if (!acc.find((x) => x.id === cur.id)) acc.push(cur);
      return acc;
    }, []);

    return merged.map((u) => {
      const totalSpending = Number(u.totalSpending || 0);
      const computedPoints = computePointsFromSpending(totalSpending);
      const computedType = computeTypeFromPoints(computedPoints);
      return {
        name: u.fullName || u.username || "Khách hàng",
        avatar: avatarEmojiFromType(computedType),
        status: statusToCardStatus(u.status),
        customerType: toVietnamCustomerType(computedType),
        totalSpent: totalSpending,
        totalOrders: u.totalOrders || 0,
        email: u.email || null,
        phone: u.phone || null,
        currentActivity: "Đang hoạt động",
        loyaltyPoints: computedPoints,
        joinDate: toISODateOrNull(u.createdAt),
        favoriteItems: Array.isArray(u.favoriteItems) ? u.favoriteItems : [],
        recentOrders: Array.isArray(u.recentOrders) ? u.recentOrders : [],
        id: u.id,
        isGuest: !!u.isGuest,
        raw: u,
      };
    });
  }, [allUsers]);

  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(searchQuery)
      );
    }

    if (activeFilter !== "all") {
      switch (activeFilter) {
        case "vip":
          list = list.filter((c) => c.customerType === "VIP");
          break;
        case "new":
          list = list.filter((c) => c.customerType === "Mới");
          break;
        case "frequent":
          list = list.filter((c) => c.customerType === "Thường xuyên");
          break;
        default:
          break;
      }
    }
    return list;
  }, [customers, searchQuery, activeFilter]);

  /* ===== UI helpers ===== */

  const searchUsers = (query) => setSearchQuery(query);
  const searchCustomers = searchUsers;
  const filterCustomersByTag = (filterKey) => setActiveFilter(filterKey);
  const filterCustomers = filterCustomersByTag;
  const switchRestaurant = (restaurantId) =>
    setSelectedRestaurant(restaurantId);

  /* ===== Admin actions ===== */

  const createUser = async (payload) => {
    const input = { ...payload };
    if (!input.roleId && payload?.roleSlug && roleMap[payload.roleSlug]) {
      input.roleId = roleMap[payload.roleSlug];
    }
    await createUserMut({ variables: { input } });
  };

  const createGuest = async ({
    fullName = "Guest",
    phone,
    expiresInDays = 30,
  }) => {
    await createGuestMut({ variables: { fullName, phone, expiresInDays } });
  };

  const updateMyProfile = async (partialInput) => {
    await updateMyUserMut({ variables: { input: { ...partialInput } } });
  };

  const adminUpdateUser = async (userId, input) => {
    await adminUpdateUserMut({ variables: { userId, input } });
  };

  const assignRole = async ({ userId, roleSlug, roleId }) => {
    const finalRoleId = roleId || roleMap[roleSlug?.toLowerCase()];
    if (!finalRoleId) throw new Error("Không tìm thấy roleId/roleSlug hợp lệ");
    await assignRoleMut({
      variables: { input: { userId, roleId: finalRoleId } },
    });
  };

  const setUserStatus = async (userId, status) => {
    await setStatusMut({ variables: { userId, status } });
  };

  const softDeleteUser = async (userId) => {
    await softDeleteMut({ variables: { userId } });
  };

  /* ====== Expose helper để FE tái sử dụng trực tiếp ====== */
  const updateCustomerMetrics = async (userId, totalSpending) => {
    const loyaltyPoints = computePointsFromSpending(totalSpending);
    const customerType = computeTypeFromPoints(loyaltyPoints);
    // dùng mutation chuyên biệt (nhanh) — nếu BE không bật có thể fallback adminUpdateUser
    try {
      await updateMetricsMut({
        variables: { id: userId, loyaltyPoints, customerType },
      });
    } catch {
      await adminUpdateUserMut({
        variables: { userId, input: { loyaltyPoints, customerType } },
      });
    }
  };

  return {
    // data
    roleList: rolesData?.roleList || [],
    roleMap,
    users: allUsers,
    customers,
    filteredCustomers,

    // ui
    selectedRestaurant,
    activeFilter,
    searchQuery,

    // network
    loading:
      usersLoading ||
      creating ||
      creatingGuest ||
      updatingMe ||
      adminUpdating ||
      assigningRole ||
      settingStatus ||
      softDeleting ||
      updatingMetrics,
    usersLoading,
    creating,
    creatingGuest,
    updatingMe,
    adminUpdating,
    assigningRole,
    settingStatus,
    softDeleting,
    updatingMetrics,
    error: usersError || null,

    // fetch
    getAllUsers,
    getCustomers,

    // ui helpers
    searchUsers,
    searchCustomers,
    filterCustomersByTag,
    filterCustomers,
    switchRestaurant,

    // actions
    createUser,
    createGuest,
    updateMyProfile,
    adminUpdateUser,
    assignRole,
    setUserStatus,
    softDeleteUser,

    // loyalty helpers
    updateCustomerMetrics,
  };
};

export default useUserManagement;
