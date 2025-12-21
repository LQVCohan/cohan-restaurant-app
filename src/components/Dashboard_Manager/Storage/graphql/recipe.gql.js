import { gql } from "@apollo/client";

/** =========================
 *  FRAGMENTS (NEW RECIPE MODEL)
 *  ========================= */

export const FR_RECIPE_INGREDIENT_LINE_FIELDS = gql`
  fragment RecipeIngredientLineFields on RecipeIngredientLine {
    ingredientId
    qty
    unit
    wastePct
    # Các field dưới nếu BE của bạn có resolver join Ingredient:
    name
    baseUnit
    costPerBaseUnit
  }
`;

export const FR_SERVING_VARIANT_FIELDS = gql`
  fragment ServingVariantFields on ServingVariant {
    key
    name
    mode
    sellQty
    sellUnit
    price
    isDefault
    ingredients {
      ...RecipeIngredientLineFields
    }
  }
  ${FR_RECIPE_INGREDIENT_LINE_FIELDS}
`;

export const FR_RECIPE_FIELDS = gql`
  fragment RecipeFields on Recipe {
    id
    restaurantId
    menuItemId
    notes
    isActive
    createdAt
    updatedAt
    servingVariants {
      ...ServingVariantFields
    }
  }
  ${FR_SERVING_VARIANT_FIELDS}
`;

/** =========================
 *  QUERIES / MUTATIONS
 *  ========================= */

export const Q_MENU_ITEMS_WITH_RECIPES_PAGED = gql`
  query MenuItemsWithRecipes(
    $restaurantId: ID!
    $timeSlot: TimeSlot
    $search: String
    $categoryId: ID
    $first: Int = 30
    $after: String
  ) {
    menuItemsWithRecipes(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      search: $search
      categoryId: $categoryId
      first: $first
      after: $after
    ) {
      items {
        menuItem {
          id
          name
          description
          categoryId
          basePrice
          thumbImage
          status
        }
        recipe {
          ...RecipeFields
        }
      }
      total
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
  ${FR_RECIPE_FIELDS}
`;

export const Q_RECIPE = gql`
  query Recipe($restaurantId: ID!, $menuItemId: ID!) {
    recipe(restaurantId: $restaurantId, menuItemId: $menuItemId) {
      ...RecipeFields
    }
  }
  ${FR_RECIPE_FIELDS}
`;

export const M_UPSERT_RECIPE = gql`
  mutation UpsertRecipe($input: UpsertRecipeInput!) {
    upsertRecipe(input: $input) {
      ...RecipeFields
    }
  }
  ${FR_RECIPE_FIELDS}
`;

export const M_DELETE_RECIPE = gql`
  mutation DeleteRecipe($restaurantId: ID!, $menuItemId: ID!) {
    deleteRecipe(restaurantId: $restaurantId, menuItemId: $menuItemId)
  }
`;

/**
 * Nếu bạn vẫn cần query menuItems thuần để chọn món (không kéo recipe):
 * - Đã bỏ preparationMethods vì dễ không còn trong schema mới.
 */
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
      thumbImage
      status
    }
  }
`;

export const Q_RECIPES_BY_MENUITEMS = gql`
  query RecipesByMenuItems($restaurantId: ID!, $menuItemIds: [ID!]!) {
    recipesByMenuItems(restaurantId: $restaurantId, menuItemIds: $menuItemIds) {
      ...RecipeFields
    }
  }
  ${FR_RECIPE_FIELDS}
`;

export const M_UPDATE_MENU_ITEM_BASIC = gql`
  mutation UpdateMenuItemBasic($input: UpdateMenuItemBasicInput!) {
    updateMenuItemBasic(input: $input) {
      id
      name
      description
      categoryId
      updatedAt
    }
  }
`;
