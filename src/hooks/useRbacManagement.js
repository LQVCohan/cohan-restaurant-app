import { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

const ROLE_FIELDS = gql`
  fragment RbacRoleFields on Role {
    id
    name
    slug
    description
    department
    isSystem
    parentRole {
      id
      name
      slug
      description
      permissions {
        id
        code
        name
        description
        group
        resource
        action
        isSystem
        isActive
      }
    }
    directPermissions {
      id
      code
      name
      description
      group
      resource
      action
      isSystem
      isActive
    }
    permissions {
      id
      code
      name
      description
      group
      resource
      action
      isSystem
      isActive
    }
  }
`;

const STAFF_ROLE_FIELDS = gql`
  fragment RbacStaffRoleFields on User {
    id
    fullName
    email
    phone
    employeeCode
    restaurantForStaff
    roleName
    role {
      id
      name
      slug
      department
    }
  }
`;

export const RBAC_MANAGEMENT_QUERY = gql`
  query RbacManagementData($restaurantId: ID, $includeStaffList: Boolean!, $includeAllRestaurants: Boolean!) {
    permissions {
      id
      code
      name
      description
      group
      resource
      action
      isSystem
      isActive
    }
    role {
      ...RbacRoleFields
    }
    parentRoles {
      id
      name
      slug
      description
      permissions {
        id
        code
        name
        description
        group
        resource
        action
        isSystem
        isActive
      }
    }
    staffList(restaurantId: $restaurantId) @include(if: $includeStaffList) {
      ...RbacStaffRoleFields
    }
    restaurants(limit: 100) @include(if: $includeAllRestaurants) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
  ${ROLE_FIELDS}
  ${STAFF_ROLE_FIELDS}
`;

export const RBAC_AUDIT_LOGS_QUERY = gql`
  query RbacAuditLogs($filter: AuditLogFilter, $limit: Int, $offset: Int) {
    rbacAuditLogs(filter: $filter, limit: $limit, offset: $offset) {
      id
      createdAt
      action
      actorId
      actorName
      actorRole
      module
      targetType
      targetId
      targetName
      restaurantId
      before
      after
      metadata
    }
  }
`;

export const ASSIGN_STAFF_ROLE_MUTATION = gql`
  mutation AssignStaffRole($input: AssignStaffRoleInput!) {
    assignStaffRole(input: $input) {
      ...RbacStaffRoleFields
    }
  }
  ${STAFF_ROLE_FIELDS}
`;

export const CREATE_ROLE_MUTATION = gql`
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) {
      ...RbacRoleFields
    }
  }
  ${ROLE_FIELDS}
`;

export const UPDATE_ROLE_MUTATION = gql`
  mutation UpdateRole($input: UpdateRoleInput!) {
    updateRole(input: $input) {
      ...RbacRoleFields
    }
  }
  ${ROLE_FIELDS}
`;

const normalizeGroup = (permission) => permission?.group || permission?.resource || "Khác";

export function useRbacManagement(restaurantId, options = {}) {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [auditLogFilters, setAuditLogFilters] = useState({ action: "", targetType: "" });
  const [auditLogLimit, setAuditLogLimit] = useState(50);
  const includeStaffList = Boolean(restaurantId);
  const includeAllRestaurants = Boolean(options.includeAllRestaurants);
  const canViewGlobalAuditLogs = Boolean(options.canViewGlobalAuditLogs);
  const auditRestaurantId = restaurantId || options.auditRestaurantId || "";
  const auditFilter = useMemo(() => {
    const filter = {};
    if (auditLogFilters.action) filter.action = auditLogFilters.action;
    if (auditLogFilters.targetType) filter.targetType = auditLogFilters.targetType;
    if (!canViewGlobalAuditLogs && auditRestaurantId) filter.restaurantId = auditRestaurantId;
    if (canViewGlobalAuditLogs && auditLogFilters.restaurantId) filter.restaurantId = auditLogFilters.restaurantId;
    return filter;
  }, [auditLogFilters, auditRestaurantId, canViewGlobalAuditLogs]);
  const shouldSkipAuditLogs = Boolean(options.skipAuditLogs) || (!canViewGlobalAuditLogs && !auditRestaurantId);

  const { data, loading, error, refetch } = useQuery(RBAC_MANAGEMENT_QUERY, {
    variables: {
      restaurantId: restaurantId || null,
      includeStaffList,
      includeAllRestaurants,
    },
    fetchPolicy: "cache-and-network",
  });

  const {
    data: auditLogsData,
    loading: auditLogsLoading,
    error: auditLogsError,
    refetch: refetchAuditLogs,
  } = useQuery(RBAC_AUDIT_LOGS_QUERY, {
    variables: {
      filter: auditFilter,
      limit: auditLogLimit,
      offset: 0,
    },
    skip: shouldSkipAuditLogs,
    fetchPolicy: "cache-and-network",
  });

  const [assignStaffRole, assignState] = useMutation(ASSIGN_STAFF_ROLE_MUTATION, {
    onCompleted: () => {
      refetch();
      if (!shouldSkipAuditLogs) refetchAuditLogs?.();
    },
  });

  const [createRole, createRoleState] = useMutation(CREATE_ROLE_MUTATION, {
    onCompleted: () => {
      refetch();
      if (!shouldSkipAuditLogs) refetchAuditLogs?.();
    },
  });

  const [updateRole, updateRoleState] = useMutation(UPDATE_ROLE_MUTATION, {
    onCompleted: () => {
      refetch();
      if (!shouldSkipAuditLogs) refetchAuditLogs?.();
    },
  });

  const roles = data?.role || [];
  const permissions = data?.permissions || [];
  const parentRoles = data?.parentRoles || [];
  const staff = data?.staffList || [];
  const allRestaurants = (data?.restaurants?.edges || []).map((edge) => edge.node).filter(Boolean);

  const selectedRole = useMemo(() => {
    if (selectedRoleId) return roles.find((role) => role.id === selectedRoleId) || null;
    return roles[0] || null;
  }, [roles, selectedRoleId]);

  const permissionsByGroup = useMemo(() => {
    return permissions.reduce((acc, permission) => {
      const group = normalizeGroup(permission);
      acc[group] = acc[group] || [];
      acc[group].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  return {
    roles,
    permissions,
    permissionsByGroup,
    parentRoles,
    staff,
    allRestaurants,
    selectedRole,
    selectedRoleId: selectedRoleId || selectedRole?.id || "",
    setSelectedRoleId,
    loading,
    error,
    refetch,
    includeStaffList,
    assignStaffRole,
    assigning: assignState.loading,
    assignError: assignState.error,
    createRole,
    creatingRole: createRoleState.loading,
    createRoleError: createRoleState.error,
    updateRole,
    updatingRole: updateRoleState.loading,
    updateRoleError: updateRoleState.error,
    auditLogs: auditLogsData?.rbacAuditLogs || [],
    auditLogsLoading,
    auditLogsError,
    auditLogFilters,
    setAuditLogFilters,
    auditLogLimit,
    setAuditLogLimit,
    refetchAuditLogs,
    auditLogsSkipped: shouldSkipAuditLogs,
  };
}