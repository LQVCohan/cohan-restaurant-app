import { gql } from "@apollo/client";
import { FR_RECIPE_FIELDS } from "./recipe.gql";

export const Q_RECIPE_TRASH = gql`
  query RecipeTrash($restaurantId: ID!, $limit: Int = 200) {
    recipeTrash(restaurantId: $restaurantId, limit: $limit) {
      recipe {
        ...RecipeFields
      }
      menuItem {
        id
        name
        description
        categoryId
        basePrice
        thumbImage
        status
      }
    }
  }
  ${FR_RECIPE_FIELDS}
`;

export const M_RESTORE_RECIPE = gql`
  mutation RestoreRecipe($restaurantId: ID!, $menuItemId: ID!) {
    restoreRecipe(restaurantId: $restaurantId, menuItemId: $menuItemId) {
      ...RecipeFields
    }
  }
  ${FR_RECIPE_FIELDS}
`;
