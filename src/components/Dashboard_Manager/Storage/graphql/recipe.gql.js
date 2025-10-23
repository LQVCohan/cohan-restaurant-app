import { gql } from "@apollo/client";

/** Lấy menu items để gắn recipe */
export const Q_MENU_ITEMS_FOR_RECIPE = gql`
  query MenuItemsForRecipe(
    $restaurantId: ID!
    $timeSlot: TimeSlot
    $limit: Int = 200
  ) {
    menuItems(restaurantId: $restaurantId, timeSlot: $timeSlot, limit: $limit) {
      id
      restaurantId
      name
      description
      categoryId
      basePrice
      preparationMethods {
        name
        price
        isDefault
      }
      thumbImage
    }
  }
`;

/** Lấy 1 recipe theo (restaurantId + menuItemId) */
export const Q_RECIPE = gql`
  query Recipe($restaurantId: ID!, $menuItemId: ID!) {
    recipe(restaurantId: $restaurantId, menuItemId: $menuItemId) {
      id
      restaurantId
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
      createdAt
      updatedAt
    }
  }
`;

/** Tạo/cập nhật recipe */
export const M_UPSERT_RECIPE = gql`
  mutation UpsertRecipe($input: UpsertRecipeInput!) {
    upsertRecipe(input: $input) {
      id
      restaurantId
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
      createdAt
      updatedAt
    }
  }
`;

/** Xoá recipe */
export const M_DELETE_RECIPE = gql`
  mutation DeleteRecipe($restaurantId: ID!, $menuItemId: ID!) {
    deleteRecipe(restaurantId: $restaurantId, menuItemId: $menuItemId)
  }
`;
