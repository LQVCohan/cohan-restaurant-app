// src/hooks/useStaffManagement.js
import { useState, useMemo, useCallback } from "react";
import { gql, useQuery, useLazyQuery, useMutation } from "@apollo/client";

/* ============================================================================
 * GQL FRAGMENTS & OPERATIONS
 * ==========================================================================*/

const STAFF_FIELDS = gql`
  fragment StaffFields on User {
    id
    fullName
    username
    email
    phone
    avatarUrl

    userType
    status
    roleName

    role {
      id
      name
      slug
    }


    refRestaurants {
      id
      name
    }

    address {
      line1
      line2
      ward
      district
      city
      country
    }

    employeeCode
    positionTitle
    department
    employmentType
    employmentStatus
    shiftType
    workingDays

    taxCode
    dateJoined
    dateLeft
    baseSalary


    isOnline

    lastLoginAt
    lastLoginIp
    forcePasswordChange

    noteInternal
    emergencyContact {
      name
      phone
      relation
    }

    createdAt
    updatedAt
  }
`;

const QUERY_ROLE_LIST = gql`
  query StaffRoleListForManagement {
    roleList {
      id
      name
      slug
      department
      parentRole {
        id
        slug
      }
    }
  }
`;

const QUERY_STAFF = gql`
  query Staff($id: ID!) {
    staff(id: $id) {
      ...StaffFields
    }
  }
  ${STAFF_FIELDS}
`;

const QUERY_STAFF_LIST = gql`
  query StaffList(
    $restaurantId: ID
    $roleId: ID
    $search: String
    $employmentStatus: EmploymentStatus
  ) {
    staffList(
      restaurantId: $restaurantId
      roleId: $roleId
      search: $search
      employmentStatus: $employmentStatus
    ) {
      ...StaffFields
    }
  }
  ${STAFF_FIELDS}
`;

const MUTATION_CREATE_STAFF = gql`
  mutation CreateStaff($input: CreateUserInput!) {
    createStaff(input: $input) {
      ...StaffFields
    }
  }
  ${STAFF_FIELDS}
`;

const MUTATION_UPDATE_STAFF = gql`
  mutation UpdateStaff($userId: ID!, $input: AdminUpdateUserInput!) {
    updateStaff(userId: $userId, input: $input) {
      ...StaffFields
    }
  }
  ${STAFF_FIELDS}
`;

const MUTATION_DELETE_STAFF = gql`
  mutation DeleteStaff($userId: ID!) {
    deleteStaff(userId: $userId)
  }
`;

const MUTATION_SOFT_DELETE_USER = gql`
  mutation SoftDeleteUser($userId: ID!) {
    softDeleteUser(userId: $userId)
  }
`;

const MUTATION_SET_STAFF_EMPLOYMENT_STATUS = gql`
  mutation SetStaffEmploymentStatus(
    $userId: ID!
    $employmentStatus: EmploymentStatus!
  ) {
    setStaffEmploymentStatus(
      userId: $userId
      employmentStatus: $employmentStatus
    ) {
      ...StaffFields
    }
  }
  ${STAFF_FIELDS}
`;

const MUTATION_SET_USER_STATUS = gql`
  mutation SetUserStatus($userId: ID!, $status: String!) {
    setUserStatus(userId: $userId, status: $status) {
      ...StaffFields
    }
  }
  ${STAFF_FIELDS}
`;


/* ============================================================================
 * HOOK: useStaffManagement
 * ==========================================================================*/

const useStaffManagement = (initialFilters = {}) => {
  /* -----------------------------------------
   * FILTERS
   * -----------------------------------------*/
  const [filters, setFilters] = useState({
    restaurantId: initialFilters.restaurantId || null,
    roleId: initialFilters.roleId || null,
    search: initialFilters.search || "",
    employmentStatus: initialFilters.employmentStatus || null,
  });

  /* -----------------------------------------
   * PAGINATION
   * -----------------------------------------*/
  const [page, setPage] = useState(initialFilters.page || 1);
  const [pageSize, setPageSize] = useState(initialFilters.pageSize || 20);
  const pollInterval = Number(initialFilters.pollInterval) || 0;

  const staffListVariables = useMemo(
    () => ({
      restaurantId: filters.restaurantId || undefined,
      roleId: filters.roleId || undefined,
      search: filters.search || undefined,
      employmentStatus: filters.employmentStatus || undefined,
    }),
    [filters]
  );

  /* -----------------------------------------
   * QUERY: LIST
   * -----------------------------------------*/
  const {
    data: staffListData,
    loading: staffListLoading,
    error: staffListError,
    refetch: refetchStaffList,
  } = useQuery(QUERY_STAFF_LIST, {
    variables: staffListVariables,
    fetchPolicy: "cache-and-network",
    pollInterval: pollInterval > 0 ? pollInterval : undefined,
    notifyOnNetworkStatusChange: true,
  });

  const { data: roleListData } = useQuery(QUERY_ROLE_LIST, {
    fetchPolicy: "cache-first",
  });

  const staffList = useMemo(
    () => staffListData?.staffList ?? [],
    [staffListData]
  );

  const roleList = useMemo(() => roleListData?.roleList ?? [], [roleListData]);

  const roleMap = useMemo(() => {
    const map = {};
    roleList.forEach((role) => {
      if (role?.slug) map[role.slug.toLowerCase()] = role.id;
    });
    return map;
  }, [roleList]);

  const totalItems = staffList.length;
  const totalPages = useMemo(
    () => (pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1),
    [totalItems, pageSize]
  );

  const safePage = useMemo(() => {
    if (totalPages === 0) return 1;
    if (page > totalPages) return totalPages;
    if (page < 1) return 1;
    return page;
  }, [page, totalPages]);

  const paginatedStaff = useMemo(() => {
    if (!pageSize || pageSize <= 0) return staffList;
    const start = (safePage - 1) * pageSize;
    return staffList.slice(start, start + pageSize);
  }, [staffList, safePage, pageSize]);

  /* -----------------------------------------
   * QUERY: DETAIL
   * -----------------------------------------*/
  const [
    loadStaffQuery,
    {
      data: selectedStaffData,
      loading: selectedStaffLoading,
      error: selectedStaffError,
    },
  ] = useLazyQuery(QUERY_STAFF);

  const selectedStaff = selectedStaffData?.staff ?? null;

  const loadStaff = useCallback(
    async (id) => {
      if (!id) return null;
      const res = await loadStaffQuery({ variables: { id } });
      return res.data?.staff ?? null;
    },
    [loadStaffQuery]
  );

  /* -----------------------------------------
   * MUTATIONS
   * -----------------------------------------*/

  /** CREATE */
  const [
    createStaffMutation,
    { loading: creatingStaff, error: createStaffError },
  ] = useMutation(MUTATION_CREATE_STAFF, {
    onCompleted: () => refetchStaffList(),
  });

  const createStaff = useCallback(
    async (input) => {
      const { roleSlug, ...restInput } = input;
      const finalInput = {
        ...restInput,
        userType: input.userType || "STAFF",
      };
      if (!finalInput.roleId && roleSlug) {
        const resolvedRoleId = roleMap[String(roleSlug).toLowerCase()];
        if (!resolvedRoleId) {
          throw new Error("Không tìm thấy roleId hợp lệ cho vai trò nhân viên đã chọn");
        }
        finalInput.roleId = resolvedRoleId;
      }

      const res = await createStaffMutation({
        variables: { input: finalInput },
      });

      return res.data?.createStaff ?? null;
    },
    [createStaffMutation, roleMap]
  );

  /** UPDATE */
  const [
    updateStaffMutation,
    { loading: updatingStaff, error: updateStaffError },
  ] = useMutation(MUTATION_UPDATE_STAFF, {
    onCompleted: () => refetchStaffList(),
  });

  const updateStaff = useCallback(
    async (userId, input) => {
      const { roleSlug, ...restInput } = input;
      const finalInput = { ...restInput };
      if (!finalInput.roleId && roleSlug) {
        const resolvedRoleId = roleMap[String(roleSlug).toLowerCase()];
        if (!resolvedRoleId) {
          throw new Error("Không tìm thấy roleId hợp lệ cho vai trò nhân viên đã chọn");
        }
        finalInput.roleId = resolvedRoleId;
      }
      const res = await updateStaffMutation({
        variables: { userId, input: finalInput },
      });
      return res.data?.updateStaff ?? null;
    },
    [roleMap, updateStaffMutation]
  );

  /** DELETE */
  const [
    deleteStaffMutation,
    { loading: deletingStaff, error: deleteStaffError },
  ] = useMutation(MUTATION_DELETE_STAFF, {
    onCompleted: () => refetchStaffList(),
  });

  const [
    softDeleteUserMutation,
    { loading: softDeletingStaff, error: softDeleteStaffError },
  ] = useMutation(MUTATION_SOFT_DELETE_USER, {
    onCompleted: () => refetchStaffList(),
  });

  const deleteStaff = useCallback(
    async (userId) => {
      const res = await deleteStaffMutation({ variables: { userId } });
      return res.data?.deleteStaff ?? false;
    },
    [deleteStaffMutation]
  );

  const softDeleteStaff = useCallback(
    async (userId) => {
      const res = await softDeleteUserMutation({ variables: { userId } });
      return res.data?.softDeleteUser ?? false;
    },
    [softDeleteUserMutation]
  );

  /** SET EMPLOYMENT STATUS (ON_LEAVE, WORKING, ...) */
  const [
    setEmploymentStatusMutation,
    { loading: changingEmploymentStatus, error: setEmploymentStatusError },
  ] = useMutation(MUTATION_SET_STAFF_EMPLOYMENT_STATUS, {
    onCompleted: () => refetchStaffList(),
  });

  const setStaffEmploymentStatus = useCallback(
    async (userId, employmentStatus) => {
      const res = await setEmploymentStatusMutation({
        variables: { userId, employmentStatus },
      });
      return res.data?.setStaffEmploymentStatus ?? null;
    },
    [setEmploymentStatusMutation]
  );

  /** SET ACCOUNT STATUS (active, inactive, blocked, pending) */
  const [
    setUserStatusMutation,
    { loading: changingUserStatus, error: setUserStatusError },
  ] = useMutation(MUTATION_SET_USER_STATUS, {
    onCompleted: () => refetchStaffList(),
  });

  const setStaffAccountStatus = useCallback(
    async (userId, status) => {
      const res = await setUserStatusMutation({
        variables: { userId, status },
      });
      return res.data?.setUserStatus ?? null;
    },
    [setUserStatusMutation]
  );

  /** RATE STAFF 1–5 STAR */

  /* -----------------------------------------
   * Loading + Error
   * -----------------------------------------*/
  const anyLoading =
    staffListLoading ||
    selectedStaffLoading ||
    creatingStaff ||
    updatingStaff ||
    deletingStaff ||
    softDeletingStaff ||
    changingEmploymentStatus ||
    changingUserStatus ||
    ratingStaff;

  const errors = {
    list: staffListError,
    detail: selectedStaffError,
    create: createStaffError,
    update: updateStaffError,
    delete: deleteStaffError,
    softDelete: softDeleteStaffError,
    setEmploymentStatus: setEmploymentStatusError,
    setUserStatus: setUserStatusError,
  };

  /* -----------------------------------------
   * RETURN API
   * -----------------------------------------*/
  return {
    // data
    staffList,
    roleList,
    roleMap,
    paginatedStaff,
    selectedStaff,

    // filters
    filters,
    setFilters,

    // pagination
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,

    // APIs
    loadStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    softDeleteStaff,
    setStaffEmploymentStatus,
    setStaffAccountStatus,

    // loading
    staffListLoading,
    selectedStaffLoading,
    creatingStaff,
    updatingStaff,
    deletingStaff,
    softDeletingStaff,
    changingEmploymentStatus,
    changingUserStatus,
    anyLoading,

    // errors
    errors,
  };
};

export default useStaffManagement;
