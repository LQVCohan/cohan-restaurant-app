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
const parseDateOrNull = (v) => {
  if (!v) return null;
  const str = typeof v === "string" ? v : v?.toString?.() ?? "";
  const ms = Date.parse(str);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
// put near other utils
const toISODateOrNull = (v) => {
  if (!v) return null;

  // Date instance
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();

  // number ms
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // string
  if (typeof v === "string") {
    const s = v.trim();
    // pure digits => epoch (ms or s)
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const ms = s.length === 10 ? n * 1000 : n; // 10 digits = seconds
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    // ISO-like
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
};

const statusToCardStatus = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "active") return "online";
  if (s === "pending") return "away";
  return "offline"; // inactive/blocked/unknown
};

const avatarEmojiFromType = (customerType) => {
  const t = (customerType || "").toUpperCase();
  if (t === "VIP") return "👑";
  if (t === "OFTEN") return "🔥";
  return "👤"; // NEW/mặc định
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
  const lastFetch = useRef({ purpose: null, variables: {} }); // 'allUsers' | 'customers'

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
    { onCompleted: () => refreshLast() }
  );
  const [updateMyUserMut, { loading: updatingMe }] = useMutation(
    UPDATE_MY_USER,
    { onCompleted: () => refreshLast() }
  );
  const [adminUpdateUserMut, { loading: adminUpdating }] = useMutation(
    ADMIN_UPDATE_USER,
    { onCompleted: () => refreshLast() }
  );
  const [assignRoleMut, { loading: assigningRole }] = useMutation(
    ASSIGN_ROLE_TO_USER,
    { onCompleted: () => refreshLast() }
  );
  const [setStatusMut, { loading: settingStatus }] = useMutation(
    SET_USER_STATUS,
    { onCompleted: () => refreshLast() }
  );
  const [softDeleteMut, { loading: softDeleting }] = useMutation(
    SOFT_DELETE_USER,
    { onCompleted: () => refreshLast() }
  );

  const refreshLast = useCallback(() => {
    const { purpose, variables } = lastFetch.current || {};
    if (!purpose) return;
    if (purpose === "allUsers") {
      fetchUsers({ variables });
    } else if (purpose === "customers") {
      getCustomers(variables);
    }
  }, [fetchUsers]); // eslint-disable-line

  /* ===== Fetch by purpose (đặt tên theo mục đích sử dụng) ===== */

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
      // 1) Lấy role=customer
      const v1 = {
        roleId: customerRoleId || undefined,
        search:
          (typeof search === "string" ? search : searchQuery) || undefined,
      };
      // 2) Nếu includeGuests, gọi thêm isGuest=true (merge bằng setUsersCache ở onCompleted)
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

  /* ===== Derived ===== */

  const allUsers = usersCache;

  // Khách hàng = role 'customer' UNION isGuest=true, sau đó MAP thành đúng shape của CustomerCard
  const customers = useMemo(() => {
    const roleCustomers = allUsers.filter(
      (u) => u.role?.slug?.toLowerCase() === "customer"
    );
    const guests = allUsers.filter((u) => u.isGuest === true);
    const merged = [...roleCustomers, ...guests].reduce((acc, cur) => {
      if (!acc.find((x) => x.id === cur.id)) acc.push(cur);
      return acc;
    }, []);

    // 🔁 Chuẩn hoá shape để CustomerCard nhận "customer" trực tiếp
    return merged.map((u) => ({
      // Card fields
      name: u.fullName || u.username || "Khách hàng",
      avatar: avatarEmojiFromType(u.customerType),
      status: statusToCardStatus(u.status),
      customerType: toVietnamCustomerType(u.customerType),
      totalSpent: u.totalSpending || 0,
      totalOrders: u.totalOrders || 0,
      email: u.email || null,
      phone: u.phone || null,
      currentActivity: u.isGuest ? "Khách vãng lai" : "Không hoạt động", // tuỳ realtime
      loyaltyPoints: u.loyaltyPoints || 0,
      joinDate: toISODateOrNull(u.createdAt),
      favoriteItems: Array.isArray(u.favoriteItems) ? u.favoriteItems : [], // nếu BE chưa có, là []
      recentOrders: Array.isArray(u.recentOrders) ? u.recentOrders : [], // nếu BE chưa có, là []

      // giữ thêm data cần thiết khác
      id: u.id,
      isGuest: !!u.isGuest,
      raw: u,
    }));
  }, [allUsers]);

  const filteredCustomers = useMemo(() => {
    let list = customers;

    // search
    // (hook này vẫn giữ state searchQuery để dùng cho quick filter client-side)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(searchQuery)
      );
    }

    // quick filters
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
  const searchCustomers = searchUsers; // tương thích
  const filterCustomersByTag = (filterKey) => setActiveFilter(filterKey);
  const filterCustomers = filterCustomersByTag; // tương thích
  const switchRestaurant = (restaurantId) =>
    setSelectedRestaurant(restaurantId);

  /* ===== Admin actions ===== */

  const createUser = async (payload) => {
    const input = { ...payload };
    // nếu truyền roleSlug thì map sang roleId
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

  return {
    // data
    roleList: rolesData?.roleList || [],
    roleMap,
    users: allUsers,
    customers, // <-- giờ đã đúng shape cho CustomerCard
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
      softDeleting,
    usersLoading,
    creating,
    creatingGuest,
    updatingMe,
    adminUpdating,
    assigningRole,
    settingStatus,
    softDeleting,
    error: usersError || null,

    // mục đích sử dụng
    getAllUsers,
    getCustomers,

    // tiện ích UI
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
  };
};

export default useUserManagement;
