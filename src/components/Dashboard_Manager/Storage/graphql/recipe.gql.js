import { gql } from "@apollo/client";

export const FR_RECIPE_COMPONENT_FIELDS = gql`
  fragment RecipeComponentFields on IngredientsComponent {
    ingredientId
    quantify
    wastePct
    name
    baseUnit
    costPerBaseUnit
  }
`;

export const FR_SERVING_VARIANT_FIELDS = gql`
  fragment ServingVariantFields on ServingVariant {
    key
    mode
    yieldQty
    yieldUnit
    name
    Ingredients {
      ...RecipeComponentFields
    }
  }
  ${FR_RECIPE_COMPONENT_FIELDS}
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
