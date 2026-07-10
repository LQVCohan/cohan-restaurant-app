import { gql } from "@apollo/client";

export const UPDATE_WAREHOUSE = gql`
  mutation UpdateWarehouse($input: UpdateWarehouseInput!) {
    updateWarehouse(input: $input) {
      id
      restaurantId
      name
      code
      address
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_WAREHOUSE = gql`
  mutation DeleteWarehouse($id: ID!) {
    deleteWarehouse(id: $id)
  }
`;
