import { useQuery, useMutation, gql } from "@apollo/client";
import { useState, useMemo } from "react";

// ===== GraphQL =====
const GET_SUPPLIES = gql`
  query Supplies($restaurantId: ID!, $search: String, $category: String) {
    supplies(
      restaurantId: $restaurantId
      search: $search
      category: $category
    ) {
      id
      name
      category
      unit
      costPerUnit
      pricePerUnit
      minStock
      isActive
      updatedAt
    }
  }
`;

const CREATE_SUPPLY = gql`
  mutation CreateSupply($input: CreateSupplyInput!) {
    createSupply(input: $input) {
      id
      name
      category
      unit
      costPerUnit
      isActive
    }
  }
`;

const UPDATE_SUPPLY = gql`
  mutation UpdateSupply($id: ID!, $input: UpdateSupplyInput!) {
    updateSupply(id: $id, input: $input) {
      id
      name
      category
      unit
      costPerUnit
      isActive
    }
  }
`;

const DELETE_SUPPLY = gql`
  mutation DeleteSupply($id: ID!) {
    deleteSupply(id: $id)
  }
`;

// ===== Hook logic =====
export const useSupplies = (restaurantId) => {
  const [filters, setFilters] = useState({
    search: "",
    category: "",
  });

  const { data, loading, refetch } = useQuery(GET_SUPPLIES, {
    variables: { restaurantId, ...filters },
    skip: !restaurantId,
  });

  const [createSupply] = useMutation(CREATE_SUPPLY);
  const [updateSupply] = useMutation(UPDATE_SUPPLY);
  const [deleteSupply] = useMutation(DELETE_SUPPLY);

  const supplies = useMemo(() => data?.supplies || [], [data]);

  // ==== CRUD Wrappers ====
  const addSupply = async (input) => {
    await createSupply({ variables: { input } });
    refetch();
  };

  const editSupply = async (id, input) => {
    await updateSupply({ variables: { id, input } });
    refetch();
  };

  const removeSupply = async (id) => {
    await deleteSupply({ variables: { id } });
    refetch();
  };

  return {
    supplies,
    loading,
    filters,
    setFilters,
    addSupply,
    editSupply,
    removeSupply,
    refetch,
  };
};
