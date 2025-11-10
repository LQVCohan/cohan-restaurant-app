// src/hooks/useUserManagement.js
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";

/* ========================= GraphQL =========================
 * Lưu ý:
 * - Mỗi User chỉ có 1 role: field user.role (object).
 * - Query danh sách role đặt tên: role (trả về mảng các role).
 * ========================================================== */

// Danh sách role (để map slug -> id khi gán role)
export const GET_ROLE_LIST = gql`
  query GetRoleList {
    role {
      id
      name
      slug
      description
      createdAt
      updatedAt
    }
  }
`;

// Lấy users (dùng chung cho cả all users và customers), filter cơ bản
export const GET_USERS = gql`
  query GetUsers($roleId: ID, $search: String, $isGuest: Boolean) {
    users(roleId: $roleId, search: $search, isGuest: $isGuest) {
      id
      fullName
      username
      email
      phone
      status
      provider
      avatarUrl
      isGuest
      guestExpiresAt
      loyaltyPoints
      customerType
      totalOrders
      totalSpending
      refRestaurants {
        id
        name
      }
      role {
        id
        name
        slug
      } # mỗi user chỉ 1 role
      createdAt
      updatedAt
    }
  }
`;

// Tạo user chuẩn
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
        status
        avatarUrl
        isGuest
        loyaltyPoints
        totalOrders
        totalSpending
        role {
          id
          name
          slug
        }
        createdAt
        updatedAt
      }
    }
  }
`;

// Tạo guest nhanh
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

// Cập nhật user hiện tại (self)
export const UPDATE_MY_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      fullName
      username
      email
      phone
      status
      avatarUrl
      isGuest
      loyaltyPoints
      totalOrders
      totalSpending
      role {
        id
        name
        slug
      }
      createdAt
      updatedAt
    }
  }
`;

// Admin cập nhật user bất kỳ
export const ADMIN_UPDATE_USER = gql`
  mutation AdminUpdateUser($userId: ID!, $input: AdminUpdateUserInput!) {
    adminUpdateUser(userId: $userId, input: $input) {
      id
      fullName
      username
      email
      phone
      status
      avatarUrl
      isGuest
      loyaltyPoints
      totalOrders
      totalSpending
      role {
        id
        name
        slug
      }
      updatedAt
    }
  }
`;

// Gán role cho user
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
      updatedAt
    }
  }
`;

// Đổi status
export const SET_USER_STATUS = gql`
  mutation SetUserStatus($userId: ID!, $status: String!) {
    setUserStatus(userId: $userId, status: $status) {
      id
      status
      updatedAt
    }
  }
`;

// Xoá mềm
export const SOFT_DELETE_USER = gql`
  mutation SoftDeleteUser($userId: ID!) {
    softDeleteUser(userId: $userId)
  }
`;

/* ========================= Hook ========================= */

const useUserManagement = () => {
  // UI states
  const [selectedRestaurant, setSelectedRestaurant] = useState("saigon");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | vip | new | frequent

  // Data state
  const [usersCache, setUsersCache] = useState([]);

  // Lưu ngữ cảnh lần fetch gần nhất để auto-refresh
  const lastFetch = useRef({ purpose: null, variables: {} }); // purpose: 'allUsers' | 'customers'

  // ===== Role list =====
  const { data: rolesData } = useQuery(GET_ROLE_LIST, {
    fetchPolicy: "cache-first",
  });

  const roleMap = useMemo(() => {
    const map = {};
    (rolesData?.role || []).forEach((r) => {
      if (r?.slug) map[r.slug.toLowerCase()] = r.id;
    });
    return map;
  }, [rolesData]);

  // ===== Users =====
  const [fetchUsers, { loading: usersLoading, error: usersError }] =
    useLazyQuery(GET_USERS, {
      fetchPolicy: "network-only",
      onCompleted: (d) => setUsersCache(d?.users || []),
    });

  // ===== Mutations =====
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

  /* ===== Helpers ===== */

  const refreshLast = useCallback(() => {
    const { purpose, variables } = lastFetch.current || {};
    if (!purpose) return;

    if (purpose === "allUsers") {
      fetchUsers({ variables });
    } else if (purpose === "customers") {
      // customers: role = customer (+ tuỳ chọn includeGuests)
      getCustomers(variables);
    }
  }, [fetchUsers]); // eslint-disable-line

  // Initial + khi đổi nhà hàng (nếu cần trigger lại)
  useEffect(() => {
    // mặc định không tự fetch, để trang tự gọi getAllUsers/getCustomers tùy ngữ cảnh
  }, [selectedRestaurant]);

  /* ===== Hai mục đích sử dụng =====
     1) getAllUsers({ roleId, search, isGuest }): lấy toàn bộ user theo filter
     2) getCustomers({ includeGuests=true, search }): lấy customer (role=customer),
        có thể kèm guest (isGuest=true)
  ============================================================ */

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
      const variables = {
        roleId: customerRoleId || undefined, // lấy role=customer
        search:
          (typeof search === "string" ? search : searchQuery) || undefined,
        isGuest: includeGuests ? undefined : false, // nếu không muốn guest, ép false
      };
      lastFetch.current = {
        purpose: "customers",
        variables: { includeGuests, search },
      };

      // Nếu cần kèm guest, ta gọi lần 1 lấy role=customer; sau đó (nếu BE hỗ trợ)
      // có thể gọi thêm users(isGuest:true) rồi merge. Để đơn giản, mặc định BE trả
      // về đủ cả khi roleId=customer (không bao gồm guest). Nếu muốn chắc chắn kèm guest:
      fetchUsers({
        variables: { roleId: customerRoleId, search: variables.search },
      });

      if (includeGuests) {
        // gọi thêm lượt guest và merge client-side
        fetchUsers({
          variables: {
            roleId: undefined,
            search: variables.search,
            isGuest: true,
          },
        }).then(() => {
          // setUsersCache đã được onCompleted; ở đây để đảm bảo lastFetch giữ đúng purpose
          lastFetch.current = {
            purpose: "customers",
            variables: { includeGuests, search },
          };
        });
      }
    },
    [fetchUsers, roleMap, searchQuery]
  );

  /* ===== Derived lists ===== */

  const allUsers = usersCache;

  const customers = useMemo(() => {
    // khách hàng = role customer hoặc isGuest = true
    const roleCustomers = allUsers.filter(
      (u) => u.role?.slug?.toLowerCase() === "customer"
    );
    const guests = allUsers.filter((u) => u.isGuest === true);
    // unique by id
    const merged = [...roleCustomers, ...guests].reduce((acc, cur) => {
      if (!acc.find((x) => x.id === cur.id)) acc.push(cur);
      return acc;
    }, []);
    return merged;
  }, [allUsers]);

  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.fullName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(searchQuery)
      );
    }

    if (activeFilter !== "all") {
      switch (activeFilter) {
        case "vip":
          list = list.filter(
            (c) => (c.customerType || "").toUpperCase() === "VIP"
          );
          break;
        case "new":
          list = list.filter(
            (c) => (c.customerType || "").toUpperCase() === "NEW"
          );
          break;
        case "frequent":
          list = list.filter(
            (c) => (c.customerType || "").toUpperCase() === "OFTEN"
          );
          break;
        default:
          break;
      }
    }
    return list;
  }, [customers, searchQuery, activeFilter]);

  /* ===== Actions tiện ích UI ===== */

  const searchUsers = (query) => setSearchQuery(query);
  const searchCustomers = searchUsers; // tương thích UI cũ
  const filterCustomersByTag = (filterKey) => setActiveFilter(filterKey);
  const filterCustomers = filterCustomersByTag; // tương thích UI cũ

  const switchRestaurant = (restaurantId) =>
    setSelectedRestaurant(restaurantId);

  // Create user (chỉ định role bằng roleSlug/roleId)
  const createUser = async (payload) => {
    const input = { ...payload };
    if (!input.roleId && payload?.roleSlug && roleMap[payload.roleSlug]) {
      input.roleId = roleMap[payload.roleSlug];
    }
    await createUserMut({ variables: { input } });
  };

  // Tạo guest nhanh
  const createGuest = async ({
    fullName = "Guest",
    phone,
    expiresInDays = 30,
  }) => {
    await createGuestMut({ variables: { fullName, phone, expiresInDays } });
  };

  // Update user (self)
  const updateMyProfile = async (partialInput) => {
    await updateMyUserMut({ variables: { input: { ...partialInput } } });
  };

  // Admin update user bất kỳ
  const adminUpdateUser = async (userId, input) => {
    await adminUpdateUserMut({ variables: { userId, input } });
  };

  // Change role
  const assignRole = async ({ userId, roleSlug, roleId }) => {
    const finalRoleId = roleId || roleMap[roleSlug?.toLowerCase()];
    if (!finalRoleId) throw new Error("Không tìm thấy roleId/roleSlug hợp lệ");
    await assignRoleMut({
      variables: { input: { userId, roleId: finalRoleId } },
    });
  };

  // Đổi status
  const setUserStatus = async (
    userId,
    status /* 'active'|'inactive'|'blocked'|'pending' */
  ) => {
    await setStatusMut({ variables: { userId, status } });
  };

  // Xoá mềm (set inactive)
  const softDeleteUser = async (userId) => {
    await softDeleteMut({ variables: { userId } });
  };

  return {
    // dữ liệu đã load
    role: rolesData?.role || [],
    roleMap,

    // danh sách theo mục đích hiển thị
    users: allUsers,
    customers,
    filteredCustomers,

    // trạng thái UI
    selectedRestaurant,
    activeFilter,
    searchQuery,

    // trạng thái network
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

    // ======= HAI HÀM THEO MỤC ĐÍCH SỬ DỤNG =======
    getAllUsers, // lấy toàn bộ user theo filter
    getCustomers, // lấy customer (và tuỳ chọn kèm guest)

    // tiện ích UI cũ
    searchUsers,
    searchCustomers,
    filterCustomersByTag,
    filterCustomers,
    switchRestaurant,

    // tác vụ quản trị
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
