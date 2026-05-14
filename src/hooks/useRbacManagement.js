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

export const ASSIGN_STAFF_ROLE_MUTATION = gql`
  mutation AssignStaffRole($input: AssignStaffRoleInput!) {
    assignStaffRole(input: $input) {
      ...RbacStaffRoleFields
    }
  }
  ${STAFF_ROLE_FIELDS}
`;

const normalizeGroup = (permission) => permission?.group || permission?.resource || "Khác";

export function useRbacManagement(restaurantId, options = {}) {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const includeStaffList = Boolean(restaurantId);
  const includeAllRestaurants = Boolean(options.includeAllRestaurants);

  const { data, loading, error, refetch } = useQuery(RBAC_MANAGEMENT_QUERY, {
    variables: {
      restaurantId: restaurantId || null,
      includeStaffList,
      includeAllRestaurants,
    },
    fetchPolicy: "cache-and-network",
  });

  const [assignStaffRole, assignState] = useMutation(ASSIGN_STAFF_ROLE_MUTATION, {
    onCompleted: () => refetch(),
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
  };
}
