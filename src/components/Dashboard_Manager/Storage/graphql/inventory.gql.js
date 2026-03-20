// src/graphql/inventory.gql.js
import { gql } from "@apollo/client";

/** ===== Restaurants by Manager ===== */
export const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 50, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        cursor
        node {
          id
          name
          avatar
          address {
            city
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

/** ===== Ingredients ===== */
export const INGREDIENTS_QUERY = gql`
  query Ingredients($restaurantId: ID!, $search: String, $limit: Int = 200) {
    ingredients(restaurantId: $restaurantId, search: $search, limit: $limit) {
      id
      restaurantId
      name
      sku
      category
      baseUnit
      conversions {
        from
        to
        ratio
      }
      costPerBaseUnit
      photos
      minStock
      notes
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_INGREDIENT = gql`
  mutation CreateIngredient($input: CreateIngredientInput!) {
    createIngredient(input: $input) {
      id
      restaurantId
      name
      sku
      category
      baseUnit
      conversions {
        from
        to
        ratio
      }
      costPerBaseUnit
      photos
      minStock
      notes
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_INGREDIENT = gql`
  mutation UpdateIngredient($input: UpdateIngredientInput!) {
    updateIngredient(input: $input) {
      id
      restaurantId
      name
      sku
      category
      baseUnit
      conversions {
        from
        to
        ratio
      }
      costPerBaseUnit
      photos
      minStock
      notes
      isActive
      updatedAt
    }
  }
`;

export const DELETE_INGREDIENT = gql`
  mutation DeleteIngredient($id: ID!) {
    deleteIngredient(id: $id)
  }
`;

/** ===== Warehouses & Stock ===== */
export const WAREHOUSES_QUERY = gql`
  query Warehouses($restaurantId: ID!) {
    warehouses(restaurantId: $restaurantId) {
      id
      name
      code
      address
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const STOCK_ITEMS_QUERY = gql`
  query StockItems($restaurantId: ID!, $warehouseId: ID, $limit: Int = 200) {
    stockItems(
      restaurantId: $restaurantId
      warehouseId: $warehouseId
      limit: $limit
    ) {
      id
      warehouseId
      ingredientId
      onHand
      reserved
      batches {
        id
        lot
        qty
        expiry
        costPerBaseUnit
      }
      updatedAt
    }
  }
`;

export const STOCK_MOVEMENTS_QUERY = gql`
  query StockMovements(
    $restaurantId: ID!
    $warehouseId: ID
    $limit: Int = 100
    $sort: Int = -1
  ) {
    stockMovements(
      restaurantId: $restaurantId
      warehouseId: $warehouseId
      limit: $limit
      sort: $sort
    ) {
      id
      warehouseId
      ingredientId
      type
      qty
      reason
      createdAt
    }
  }
`;

/** ===== Recipes ===== */
export const MENU_ITEMS_FOR_RECIPE = gql`
  query MenuItemsForRecipe(
    $restaurantId: ID!
    $timeSlot: TimeSlot
    $limit: Int = 200
  ) {
    menuItems(restaurantId: $restaurantId, timeSlot: $timeSlot, limit: $limit) {
      id
      name
      categoryId
      preparationMethods {
        name
        price
        isDefault
      }
    }
  }
`;

export const RECIPE_QUERY = gql`
  query Recipe($restaurantId: ID!, $menuItemId: ID!) {
    recipe(restaurantId: $restaurantId, menuItemId: $menuItemId) {
      id
      menuItemId
      yieldQty
      yieldUnit
      baseComponents {
        ingredientId
        qty
        unit
        wastePct
      }
      variants {
        preparationMethodName
        components {
          ingredientId
          qty
          unit
          wastePct
        }
      }
      servingVariants {
        key
        mode
        yieldQty
        yieldUnit
        preparationMethodName
        components {
          ingredientId
          qty
          unit
          wastePct
        }
      }
      notes
      isActive
      updatedAt
    }
  }
`;

export const UPSERT_RECIPE = gql`
  mutation UpsertRecipe($input: UpsertRecipeInput!) {
    upsertRecipe(input: $input) {
      id
      menuItemId
      yieldQty
      yieldUnit
      baseComponents {
        ingredientId
        qty
        unit
        wastePct
      }
      servingVariants {
        key
        mode
        yieldQty
        yieldUnit
      }
      isActive
      updatedAt
    }
  }
`;

export const DELETE_RECIPE = gql`
  mutation DeleteRecipe($restaurantId: ID!, $menuItemId: ID!) {
    deleteRecipe(restaurantId: $restaurantId, menuItemId: $menuItemId)
  }
`;
export const ADJUST_STOCK = gql`
  mutation AdjustStock(
    $restaurantId: ID!
    $warehouseId: ID!
    $ingredientId: ID!
    $qty: Int!
    $reason: String
  ) {
    adjustStock(
      restaurantId: $restaurantId
      warehouseId: $warehouseId
      ingredientId: $ingredientId
      qty: $qty
      reason: $reason
    ) {
      id
      onHand
      reserved
      updatedAt
    }
  }
`;
