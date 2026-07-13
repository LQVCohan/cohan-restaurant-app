// src/hooks/useUserManagement.js
import { useMemo, useState, useCallback, useRef } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { verificationLabel, verificationStatus as resolveVerificationStatus } from "@/utils/accountVerification";

/* ========================= GraphQL ========================= */

export const GET_ROLE_LIST = gql`
  query GetRoleList {
    roleList {
      id
      name
      slug
      department
      parentRole {
        id
        slug
      }
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
      phoneVerified
      verifiedAt
      emailVerifiedAt
      phoneVerifiedAt
      isOnline
      loyaltyDurationScore
      lastLoginAt
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

export const GET_CUSTOMERS = gql`
  query GetCustomers(
    $search: String
    $includeGuests: Boolean
    $restaurantId: ID
  ) {
    customers(
      search: $search
      includeGuests: $includeGuests
      restaurantId: $restaurantId
    ) {
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
      phoneVerified
      verifiedAt
      emailVerifiedAt
      phoneVerifiedAt
      isOnline
      loyaltyDurationScore
      lastLoginAt
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
export const GET_CUSTOMER_LIST_PAGE = gql`
  query GetCustomerListPage(
    $restaurantId: ID!
    $search: String
    $includeGuests: Boolean
    $customerKind: CustomerKindFilter
    $customerRank: CustomerRankFilterInput
    $sortBy: CustomerSortBy
    $sortDirection: SortDirection
    $limit: Int
    $cursor: String
  ) {
    customerListPage(
      restaurantId: $restaurantId
      search: $search
      includeGuests: $includeGuests
      customerKind: $customerKind
      customerRank: $customerRank
      sortBy: $sortBy
      sortDirection: $sortDirection
      limit: $limit
      cursor: $cursor
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
        limit
      }
      items {
        id
        fullName
        username
        email
        phone
        role { id name slug }
        status
        avatarUrl
        refRestaurants { id name }
        loyaltyPoints
        customerType
        totalOrders
        totalSpending
        emailVerified
      phoneVerified
      verifiedAt
      emailVerifiedAt
      phoneVerifiedAt
        isOnline
        loyaltyDurationScore
        lastLoginAt
          isGuest
        createdAt
      }
    }
  }
`;
export const GET_CUSTOMER_EXPORT_ROWS = gql`
  query GetCustomerExportRows($restaurantId: ID!, $search: String, $includeGuests: Boolean, $customerKind: CustomerKindFilter, $customerRank: CustomerRankFilterInput, $sortBy: CustomerSortBy, $sortDirection: SortDirection, $limit: Int) {
    customerExportRows(restaurantId: $restaurantId, search: $search, includeGuests: $includeGuests, customerKind: $customerKind, customerRank: $customerRank, sortBy: $sortBy, sortDirection: $sortDirection, limit: $limit) {
      id fullName username email phone loyaltyPoints customerType totalOrders totalSpending isOnline lastLoginAt isGuest createdAt emailVerified phoneVerified verifiedAt emailVerifiedAt phoneVerifiedAt
      refRestaurants { id name }
    }
  }
`;

export const GET_CUSTOMERS_FOR_TABLE_INFO = gql`
  query GetCustomersForTableInfo($search: String, $includeGuests: Boolean) {
    customers(search: $search, includeGuests: $includeGuests) {
      name: fullName
      phone
      email
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
      phoneVerified
      verifiedAt
      emailVerifiedAt
      phoneVerifiedAt
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

export const RESEND_USER_VERIFICATION = gql`
  mutation ResendUserVerification($userId: ID!, $channel: VerificationChannel = AUTO) {
    resendUserVerification(userId: $userId, channel: $channel) {
      ok
      status
      message
      errors
      email { channel attempted sent skipped status provider messageId error lastSentAt cooldownUntil }
      sms { channel attempted sent skipped status provider messageId error lastSentAt cooldownUntil }
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
      phoneVerified
      verifiedAt
      emailVerifiedAt
      phoneVerifiedAt
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
      phoneVerified
      verifiedAt
      emailVerifiedAt
      phoneVerifiedAt
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
    $restaurantId: ID!
    $loyaltyPoints: Int!
    $customerType: CustomerType!
  ) {
    updateCustomerMetrics(
      id: $id
      restaurantId: $restaurantId
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

export const UPDATE_CUSTOMER_NOTE = gql`
  mutation UpdateCustomerNote(
    $customerId: ID!
    $restaurantId: ID!
    $noteInternal: String
  ) {
    updateCustomerNote(
      customerId: $customerId
      restaurantId: $restaurantId
      noteInternal: $noteInternal
    ) {
      id
      fullName
      email
      phone
      isGuest
      refRestaurants {
        id
        name
      }
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
  Math.max(0, Math.floor((Number(spending) || 0) / 1000000));
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
  const [customerPageItems, setCustomerPageItems] = useState([]);
  const [customerPageInfo, setCustomerPageInfo] = useState(null);
  const [customerTotalCount, setCustomerTotalCount] = useState(0);

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
  const [fetchCustomers, { loading: customersLoading, error: customersError }] =
    useLazyQuery(GET_CUSTOMERS, {
      fetchPolicy: "network-only",
      onCompleted: (d) => setUsersCache(d?.customers || []),
    });
  const [fetchCustomerPage, { loading: customerPageLoading, error: customerPageError }] =
    useLazyQuery(GET_CUSTOMER_LIST_PAGE, { fetchPolicy: "network-only" });
  const [fetchCustomerExportRows] =
    useLazyQuery(GET_CUSTOMER_EXPORT_ROWS, { fetchPolicy: "network-only" });

  // Mutations
  const [createUserMut, { loading: creating }] = useMutation(CREATE_USER, {
    onCompleted: () => refreshLast(),
  });
  const [createGuestMut, { loading: creatingGuest }] = useMutation(
    CREATE_GUEST_USER,
    {
      onCompleted: () => refreshLast(),
    },
  );
  const [updateMyUserMut, { loading: updatingMe }] = useMutation(
    UPDATE_MY_USER,
    {
      onCompleted: () => refreshLast(),
    },
  );
  const [adminUpdateUserMut, { loading: adminUpdating }] = useMutation(
    ADMIN_UPDATE_USER,
    {
      onCompleted: () => refreshLast(),
    },
  );
  const [assignRoleMut, { loading: assigningRole }] = useMutation(
    ASSIGN_ROLE_TO_USER,
    {
      onCompleted: () => refreshLast(),
    },
  );
  const [setStatusMut, { loading: settingStatus }] = useMutation(
    SET_USER_STATUS,
    {
      onCompleted: () => refreshLast(),
    },
  );
  const [softDeleteMut, { loading: softDeleting }] = useMutation(
    SOFT_DELETE_USER,
    {
      onCompleted: () => refreshLast(),
    },
  );

  // NEW: mutation chuyên cập nhật loyaltyPoints + customerType (được CustomerModal dùng thẳng)
  const [updateMetricsMut, { loading: updatingMetrics }] = useMutation(
    UPDATE_CUSTOMER_METRICS,
  );
  const [resendVerificationMut, { loading: resendingVerification }] = useMutation(
    RESEND_USER_VERIFICATION,
    { onCompleted: () => refreshLast() },
  );

  const refreshLast = useCallback(() => {
    const { purpose, variables } = lastFetch.current || {};
    if (!purpose) return;
    if (purpose === "allUsers") fetchUsers({ variables });
    else if (purpose === "customers") fetchCustomers({ variables });
  }, [fetchUsers, fetchCustomers]);

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
    [fetchUsers, searchQuery],
  );

  const getCustomers = useCallback(
    ({ includeGuests = true, search, restaurantId } = {}) => {
      const variables = {
        includeGuests,
        restaurantId: restaurantId || undefined,
        search:
          (typeof search === "string" ? search : searchQuery) || undefined,
      };

      lastFetch.current = {
        purpose: "customers",
        variables,
      };

      return fetchCustomers({ variables });
    },
    [fetchCustomers, searchQuery],
  );
  const mapCustomerCard = useCallback((u) => {
    const computedType = (u.customerType || "").toUpperCase();
    return {
      id: u.id,
      name: u.fullName || u.username || "Khách hàng",
      avatar: u.avatarUrl || avatarEmojiFromType(computedType),
      status: u.isOnline ? "online" : statusToCardStatus(u.status),
      customerType: toVietnamCustomerType(computedType || "NEW"),
      loyaltyPoints: Number(u.loyaltyPoints ?? 0),
      totalOrders: Number(u.totalOrders || 0),
      totalSpending: Number(u.totalSpending || 0),
      noteInternal: u.noteInternal || "",
      isGuest: !!u.isGuest,
      refRestaurants: u.refRestaurants || [],
      joinDate: toISODateOrNull(u.createdAt),
      raw: u,
      email: u.email || null,
      phone: u.phone || null,
      online: !!u.isOnline,
      lastLoginAt: u.lastLoginAt || null,
      verificationStatus: resolveVerificationStatus(u),
      verificationLabel: verificationLabel(u),
      canResendVerification: Boolean((u.email && !u.emailVerified) || (u.phone && !u.phoneVerified)),
      emailVerified: Boolean(u.emailVerified),
      phoneVerified: Boolean(u.phoneVerified),
      verifiedAt: u.verifiedAt || null,
      emailVerifiedAt: u.emailVerifiedAt || null,
      phoneVerifiedAt: u.phoneVerifiedAt || null,
    };
  }, []);
  const getCustomersPage = useCallback(async ({
    restaurantId, search, includeGuests = true, customerKind = "ALL", customerRank, sortBy = "CREATED_AT", sortDirection = "DESC", limit = 30, cursor, append = false,
  } = {}) => {
    const variables = { restaurantId, search: typeof search === "string" ? search : undefined, includeGuests, customerKind, customerRank, sortBy, sortDirection, limit, cursor };
    const { data } = await fetchCustomerPage({ variables });
    const page = data?.customerListPage;
    const mapped = (page?.items || []).map(mapCustomerCard);
    setCustomerPageItems((prev) => (append ? [...prev, ...mapped] : mapped));
    setCustomerPageInfo(page?.pageInfo || null);
    setCustomerTotalCount(Number(page?.totalCount || 0));
    return page;
  }, [fetchCustomerPage, mapCustomerCard]);
  const getCustomerExportRows = useCallback(async ({
    restaurantId, search, includeGuests = true, customerKind = "ALL", customerRank, sortBy = "CREATED_AT", sortDirection = "DESC", limit = 1000,
  } = {}) => {
    const { data } = await fetchCustomerExportRows({
      variables: { restaurantId, search: typeof search === "string" ? search : undefined, includeGuests, customerKind, customerRank, sortBy, sortDirection, limit },
    });
    return (data?.customerExportRows || []).map(mapCustomerCard);
  }, [fetchCustomerExportRows, mapCustomerCard]);

  /* ===== Derived ===== */

  const allUsers = usersCache;

  const customers = useMemo(() => {
    const roleCustomers = allUsers.filter(
      (u) => u.role?.slug?.toLowerCase() === "customer",
    );
    const guests = allUsers.filter((u) => u.isGuest === true);
    const merged = [...roleCustomers, ...guests].reduce((acc, cur) => {
      if (!acc.find((x) => x.id === cur.id)) acc.push(cur);
      return acc;
    }, []);

    return merged.map((u) => {
      const totalSpending = Number(u.totalSpending || 0);
      const computedPoints = Number(u.loyaltyPoints ?? 0);
      const computedType = (
        u.customerType || computeTypeFromPoints(computedPoints)
      ).toUpperCase();
      return {
        name: u.fullName || u.username || "Khách hàng",
        avatar: u.avatarUrl || avatarEmojiFromType(computedType),
        status: u.isOnline ? "online" : statusToCardStatus(u.status),
        customerType: toVietnamCustomerType(computedType),
        totalSpent: totalSpending,
        totalOrders: u.totalOrders || 0,
        email: u.email || null,
        phone: u.phone || null,
        verificationStatus: resolveVerificationStatus(u),
        verificationLabel: verificationLabel(u),
        canResendVerification: Boolean((u.email && !u.emailVerified) || (u.phone && !u.phoneVerified)),
        emailVerified: Boolean(u.emailVerified),
        phoneVerified: Boolean(u.phoneVerified),
        currentActivity: u.isOnline ? "Online" : "Offline",
        loyaltyPoints: computedPoints,
        loyaltyDurationScore: Number(u.loyaltyDurationScore || 0),
        online: !!u.isOnline,
        lastLoginAt: u.lastLoginAt || null,
        noteInternal: u.noteInternal || "",
        refRestaurants: u.refRestaurants || [],
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
          c.phone?.includes(searchQuery),
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
    const { roleSlug: rawRoleSlug, ...input } = payload;
    const roleSlug = rawRoleSlug ? String(rawRoleSlug).toLowerCase() : "";
    if (!input.roleId && roleSlug && roleMap[roleSlug]) {
      input.roleId = roleMap[roleSlug];
    }
    return createUserMut({ variables: { input } });
  };

  const createGuest = async ({
    fullName = "Guest",
    phone,
    expiresInDays = 30,
  }) => {
    const result = await createGuestMut({
      variables: { fullName, phone, expiresInDays },
    });
    return result?.data?.createGuestUser || null;
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
  const resendUserVerification = async (userId, channel = "AUTO") => {
    const res = await resendVerificationMut({ variables: { userId, channel } });
    return res.data?.resendUserVerification ?? null;
  };

  const updateCustomerMetrics = async (userId, totalSpending, restaurantId = selectedRestaurant?.id) => {
    if (!restaurantId) {
      throw new Error("Missing restaurantId for customer metrics update");
    }
    const loyaltyPoints = computePointsFromSpending(totalSpending);
    const customerType = computeTypeFromPoints(loyaltyPoints);
    await updateMetricsMut({
      variables: { id: userId, restaurantId, loyaltyPoints, customerType },
    });
  };

  return {
    // data
    roleList: rolesData?.roleList || [],
    roleMap,
    users: allUsers,
    customers,
    filteredCustomers,
    customerPageItems,
    customerPageInfo,
    customerTotalCount,

    // ui
    selectedRestaurant,
    activeFilter,
    searchQuery,

    // network
    loading:
      usersLoading ||
      customersLoading ||
      customerPageLoading ||
      creating ||
      creatingGuest ||
      updatingMe ||
      adminUpdating ||
      assigningRole ||
      settingStatus ||
      softDeleting ||
      updatingMetrics ||
      resendingVerification,
    usersLoading,
    customersLoading,
    creating,
    creatingGuest,
    updatingMe,
    adminUpdating,
    assigningRole,
    settingStatus,
    softDeleting,
    updatingMetrics,
    resendingVerification,
    error: usersError || customersError || customerPageError || null,

    // fetch
    getAllUsers,
    getCustomers,
    getCustomersPage,
    getCustomerExportRows,

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
    resendUserVerification,

    // loyalty helpers
    updateCustomerMetrics,
  };
};

export default useUserManagement;
