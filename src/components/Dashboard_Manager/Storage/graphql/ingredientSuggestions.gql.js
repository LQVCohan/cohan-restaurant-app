import { gql } from "@apollo/client";

export const Q_INGREDIENT_SUGGESTIONS = gql`
  query IngredientSuggestions($restaurantId: ID!, $limit: Int = 8) {
    ingredientSuggestions(restaurantId: $restaurantId, limit: $limit) {
      recentUsed {
        id
        name
        baseUnit
        costPerBaseUnit
      }
      topUsed {
        id
        name
        baseUnit
        costPerBaseUnit
      }
      recentCreated {
        id
        name
        baseUnit
        costPerBaseUnit
      }
    }
  }
`;

export const M_RECORD_INGREDIENT_USED = gql`
  mutation RecordIngredientUsed($restaurantId: ID!, $ingredientId: ID!) {
    recordIngredientUsed(
      restaurantId: $restaurantId
      ingredientId: $ingredientId
    )
  }
`;
