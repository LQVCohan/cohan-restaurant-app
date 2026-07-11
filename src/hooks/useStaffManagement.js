// src/hooks/useStaffManagement.js
import { useState, useMemo, useCallback } from "react";
import { gql, useQuery, useLazyQuery, useMutation } from "@apollo/client";

/* ============================================================================
 * GQL FRAGMENTS & OPERATIONS
 * ==========================================================================*/

const STAFF_FIELDS = gql`
  fragment StaffFields on StaffPrivateProfile {
    id
    fullName
    username
    email
    phone
    avatarUrl

    userType
    status
    roleName
    emailVerified
    phoneVerified
    verifiedAt
    emailVerifiedAt
    phoneVerifiedAt

    role {
      id
      name
      slug
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
    hourlyRate
    commissionRate
    salaryType

    isOnline

    lastLoginAt
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
  query StaffRoleListForManagement($restaurantId: ID!) {
    roleList(restaurantId: $restaurantId) {
      id
      name
      slug
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

const MUTATION_RESEND_USER_VERIFICATION = gql`
  mutation ResendStaffVerification(
    $userId: ID!
    $channel: VerificationChannel = AUTO
  ) {
    resendUserVerification(userId: $userId, channel: $channel) {
      ok
      status
      message
      errors
      email {
        channel
        attempted
        sent
        skipped
        status
        provider
        messageId
        error
        lastSentAt
        cooldownUntil
      }
      sms {
        channel
        attempted
        sent
        skipped
        status
        provider
        messageId
        error
        lastSentAt
        cooldownUntil
      }
    }
  }
`;

const MUTATION_SET_STAFF_ACCOUNT_STATUS = gql`
  mutation SetStaffAccountStatus($userId: ID!, $status: String!) {
    setStaffAccountStatus(userId: $userId, status: $status) {
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
    [filters],
  );

  /* -----------------------------------------
   * QUERY: LIST
   * -----------------------------------------*/
  const shouldSkipStaffList = !filters.restaurantId;

  const {
    data: staffListData,
    loading: staffListLoading,
    error: staffListError,
    refetch: refetchStaffList,
  } = useQuery(QUERY_STAFF_LIST, {
    variables: staffListVariables,
    skip: shouldSkipStaffList,
    fetchPolicy: "cache-and-network",
    pollInterval:
      !shouldSkipStaffList && pollInterval > 0 ? pollInterval : undefined,
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: roleListData,
    loading: roleListLoading,
    error: roleListError,
  } = useQuery(QUERY_ROLE_LIST, {
    variables: { restaurantId: filters.restaurantId },
    skip: !filters.restaurantId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const staffList = useMemo(
    () => staffListData?.staffList ?? [],
    [staffListData],
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
    [totalItems, pageSize],
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
    [loadStaffQuery],
  );

  /* -----------------------------------------
   * MUTATIONS
   * -----------------------------------------*/

  /** CREATE */
  const [
    createStaffMutation,
    { loading: creatingStaff, error: createStaffError },
  ] = useMutation(MUTATION_CREATE_STAFF, {
    onCompleted: () => {
      if (filters.restaurantId) refetchStaffList();
    },
  });

  const createStaff = useCallback(
    async (input) => {
      const { roleSlug, ...restInput } = input;
      const finalInput = {
        ...restInput,
        userType: input.userType || "STAFF",
      };

      if (
        roleSlug &&
        (roleListLoading || roleListError || roleList.length === 0)
      ) {
        throw new Error(
          "Vai trò đã chọn chưa được cấu hình hoặc bạn không có quyền tải danh sách vai trò. Vui lòng thử lại.",
        );
      }
      if (!finalInput.roleId && roleSlug) {
        const resolvedRoleId = roleMap[String(roleSlug).toLowerCase()];
        if (!resolvedRoleId) {
          throw new Error(
            `Không tìm thấy roleId hợp lệ cho vai trò "${roleSlug}". Vui lòng kiểm tra roleList backend.`,
          );
        }
        finalInput.roleId = resolvedRoleId;
      }

      const res = await createStaffMutation({
        variables: { input: finalInput },
      });

      return res.data?.createStaff ?? null;
    },
    [createStaffMutation, roleList, roleListError, roleListLoading, roleMap],
  );

  /** UPDATE */
  const [
    updateStaffMutation,
    { loading: updatingStaff, error: updateStaffError },
  ] = useMutation(MUTATION_UPDATE_STAFF, {
    onCompleted: () => {
      if (filters.restaurantId) refetchStaffList();
    },
  });

  const updateStaff = useCallback(
    async (userId, input) => {
      const { roleSlug, ...restInput } = input;
      const finalInput = { ...restInput };
      if (
        roleSlug &&
        (roleListLoading || roleListError || roleList.length === 0)
      ) {
        throw new Error(
          "Vai trò đã chọn chưa được cấu hình hoặc bạn không có quyền tải danh sách vai trò. Vui lòng thử lại.",
        );
      }
      if (!finalInput.roleId && roleSlug) {
        const resolvedRoleId = roleMap[String(roleSlug).toLowerCase()];
        if (!resolvedRoleId) {
          throw new Error(
            `Không tìm thấy roleId hợp lệ cho vai trò "${roleSlug}". Vui lòng kiểm tra roleList backend.`,
          );
        }
        finalInput.roleId = resolvedRoleId;
      }
      const res = await updateStaffMutation({
        variables: { userId, input: finalInput },
      });
      return res.data?.updateStaff ?? null;
    },
    [roleList, roleListError, roleListLoading, roleMap, updateStaffMutation],
  );

  /** DELETE */
  const [
    deleteStaffMutation,
    { loading: deletingStaff, error: deleteStaffError },
  ] = useMutation(MUTATION_DELETE_STAFF, {
    onCompleted: () => {
      if (filters.restaurantId) refetchStaffList();
    },
  });

  const deleteStaff = useCallback(
    async (userId) => {
      const res = await deleteStaffMutation({ variables: { userId } });
      return res.data?.deleteStaff ?? false;
    },
    [deleteStaffMutation],
  );

  const softDeleteStaff = deleteStaff;

  /** SET EMPLOYMENT STATUS (ON_LEAVE, WORKING, ...) */
  const [
    setEmploymentStatusMutation,
    { loading: changingEmploymentStatus, error: setEmploymentStatusError },
  ] = useMutation(MUTATION_SET_STAFF_EMPLOYMENT_STATUS, {
    onCompleted: () => {
      if (filters.restaurantId) refetchStaffList();
    },
  });

  const setStaffEmploymentStatus = useCallback(
    async (userId, employmentStatus) => {
      const res = await setEmploymentStatusMutation({
        variables: { userId, employmentStatus },
      });
      return res.data?.setStaffEmploymentStatus ?? null;
    },
    [setEmploymentStatusMutation],
  );

  /** RESEND ACCOUNT VERIFICATION */
  const [
    resendVerificationMutation,
    { loading: resendingVerification, error: resendVerificationError },
  ] = useMutation(MUTATION_RESEND_USER_VERIFICATION, {
    onCompleted: () => {
      if (filters.restaurantId) refetchStaffList();
    },
  });

  const resendStaffVerification = useCallback(
    async (userId, channel = "AUTO") => {
      const res = await resendVerificationMutation({
        variables: { userId, channel },
      });
      return res.data?.resendUserVerification ?? null;
    },
    [resendVerificationMutation],
  );

  /** SET ACCOUNT STATUS (active, inactive, blocked, pending) */
  const [
    setStaffAccountStatusMutation,
    { loading: changingUserStatus, error: setUserStatusError },
  ] = useMutation(MUTATION_SET_STAFF_ACCOUNT_STATUS, {
    onCompleted: () => {
      if (filters.restaurantId) refetchStaffList();
    },
  });

  const setStaffAccountStatus = useCallback(
    async (userId, status) => {
      const res = await setStaffAccountStatusMutation({
        variables: { userId, status },
      });
      return res.data?.setStaffAccountStatus ?? null;
    },
    [setStaffAccountStatusMutation],
  );

  /* -----------------------------------------
   * Loading + Error
   * -----------------------------------------*/
  const anyLoading =
    staffListLoading ||
    selectedStaffLoading ||
    creatingStaff ||
    updatingStaff ||
    deletingStaff ||
    changingEmploymentStatus ||
    changingUserStatus ||
    resendingVerification;

  const errors = {
    list: staffListError,
    detail: selectedStaffError,
    create: createStaffError,
    update: updateStaffError,
    delete: deleteStaffError,
    softDelete: deleteStaffError,
    setEmploymentStatus: setEmploymentStatusError,
    setUserStatus: setUserStatusError,
    resendVerification: resendVerificationError,
  };

  /* -----------------------------------------
   * RETURN API
   * -----------------------------------------*/
  return {
    // data
    staffList,
    roleList,
    roleListLoading,
    roleListError,
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
    resendStaffVerification,

    // loading
    staffListLoading,
    refetchStaffList,
    selectedStaffLoading,
    creatingStaff,
    updatingStaff,
    deletingStaff,
    softDeletingStaff: deletingStaff,
    changingEmploymentStatus,
    changingUserStatus,
    resendingVerification,
    anyLoading,

    // errors
    errors,
  };
};

export default useStaffManagement;
