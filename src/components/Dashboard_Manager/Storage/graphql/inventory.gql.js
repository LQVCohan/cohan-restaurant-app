// src/graphql/inventory.gql.js
import { gql } from "@apollo/client";

/** ===== Scoped restaurants ===== */
export const GET_SCOPED_RESTAURANTS = gql`
  query ScopedRestaurants($limit: Int = 50, $cursor: ID) {
    scopedRestaurants(
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
  query Ingredients(
    $restaurantId: ID!
    $search: String
    $limit: Int = 200
    $includeDeleted: Boolean = false
  ) {
    ingredients(
      restaurantId: $restaurantId
      search: $search
      limit: $limit
      includeDeleted: $includeDeleted
    ) {
      id
      restaurantId
      name
      sku
      category
      ingredientCategoryId
      ingredientCategory {
        id
        name
      }
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
      deletedAt
      deleteExpiresAt
      createdAt
      updatedAt
    }
  }
`;

export const INGREDIENT_TRASH_QUERY = gql`
  query IngredientTrash($restaurantId: ID!, $limit: Int = 200) {
    ingredientTrash(restaurantId: $restaurantId, limit: $limit) {
      id
      restaurantId
      name
      sku
      category
      ingredientCategoryId
      ingredientCategory {
        id
        name
      }
      baseUnit
      deletedAt
      deleteExpiresAt
      isActive
      updatedAt
    }
  }
`;

export const INGREDIENT_CATEGORIES_QUERY = gql`
  query IngredientCategories(
    $restaurantId: ID!
    $search: String
    $includeInactive: Boolean = false
    $limit: Int = 200
  ) {
    ingredientCategories(
      restaurantId: $restaurantId
      search: $search
      includeInactive: $includeInactive
      limit: $limit
    ) {
      id
      restaurantId
      name
      slug
      source
      usageCount
      isActive
    }
  }
`;

export const INGREDIENT_CATEGORY_SYNC_LOGS_QUERY = gql`
  query IngredientCategorySyncLogs($restaurantId: ID!, $limit: Int = 10) {
    ingredientCategorySyncLogs(restaurantId: $restaurantId, limit: $limit) {
      id
      at
      actorUserId
      status
      totalIngredients
      categoriesCreated
      categoriesUpdated
      ingredientsReassigned
      skipped
      errors
      summaryText
    }
  }
`;

export const CREATE_INGREDIENT_CATEGORY = gql`
  mutation CreateIngredientCategory($input: CreateIngredientCategoryInput!) {
    createIngredientCategory(input: $input) {
      id
      name
      slug
      source
      usageCount
      isActive
    }
  }
`;

export const UPDATE_INGREDIENT_CATEGORY = gql`
  mutation UpdateIngredientCategory($input: UpdateIngredientCategoryInput!) {
    updateIngredientCategory(input: $input) {
      id
      name
      slug
      source
      usageCount
      isActive
    }
  }
`;

export const DELETE_INGREDIENT_CATEGORY = gql`
  mutation DeleteIngredientCategory($id: ID!) {
    deleteIngredientCategory(id: $id)
  }
`;

export const SYNC_INGREDIENT_CATEGORIES = gql`
  mutation SyncIngredientCategories($restaurantId: ID!) {
    syncIngredientCategories(restaurantId: $restaurantId) {
      totalIngredients
      categoriesCreated
      categoriesUpdated
      ingredientsReassigned
      skipped
      errors
      summaryText
      syncedAt
      sample {
        ingredientId
        ingredientName
        predictedCategory
        reason
        confidence
        matchedKeyword
      }
      categories {
        id
        name
        slug
        source
        usageCount
        isActive
      }
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
      ingredientCategoryId
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
      ingredientCategoryId
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

export const RESTORE_INGREDIENT = gql`
  mutation RestoreIngredient($id: ID!) {
    restoreIngredient(id: $id) {
      id
      name
      deletedAt
      deleteExpiresAt
      isActive
      updatedAt
    }
  }
`;

export const DELETE_INGREDIENT_PERMANENTLY = gql`
  mutation DeleteIngredientPermanently($id: ID!) {
    deleteIngredientPermanently(id: $id)
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

export const CREATE_WAREHOUSE = gql`
  mutation CreateWarehouse($input: CreateWarehouseInput!) {
    createWarehouse(input: $input) {
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
      meta
      createdAt
    }
  }
`;

export const INGREDIENT_PRICE_SUGGESTIONS = gql`
  query IngredientPriceSuggestions(
    $restaurantId: ID!
    $ingredientId: ID!
    $limit: Int = 5
  ) {
    ingredientPriceSuggestions(
      restaurantId: $restaurantId
      ingredientId: $ingredientId
      limit: $limit
    ) {
      latestCostPerBaseUnit
      avgRecentCostPerBaseUnit
      recent {
        movementId
        createdAt
        qtyBase
        costPerBaseUnit
        totalValue
        lot
        supplierNote
      }
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
      description
      basePrice
      status
    }
  }
`;

export const RECIPE_QUERY = gql`
  query Recipe($restaurantId: ID!, $menuItemId: ID!) {
    recipe(restaurantId: $restaurantId, menuItemId: $menuItemId) {
      id
      menuItemId
      servingVariants {
        key
        name
        mode
        sellQty
        sellUnit
        isDefault
        price
        ingredients {
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
      servingVariants {
        key
        name
        mode
        sellQty
        sellUnit
        isDefault
        price
        ingredients {
          ingredientId
          qty
          unit
          wastePct
        }
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

export const RECEIVE_STOCK = gql`
  mutation ReceiveStock(
    $restaurantId: ID!
    $warehouseId: ID!
    $ingredientId: ID!
    $qty: Int!
    $costPerBaseUnit: Float!
    $reason: String
    $lot: String
    $expiry: DateTime
    $supplierNote: String
  ) {
    receiveStock(
      restaurantId: $restaurantId
      warehouseId: $warehouseId
      ingredientId: $ingredientId
      qty: $qty
      costPerBaseUnit: $costPerBaseUnit
      reason: $reason
      lot: $lot
      expiry: $expiry
      supplierNote: $supplierNote
    ) {
      id
      restaurantId
      warehouseId
      ingredientId
      onHand
      reserved
      batches {
        lot
        qty
        expiry
        costPerBaseUnit
      }
      updatedAt
    }
  }
`;
