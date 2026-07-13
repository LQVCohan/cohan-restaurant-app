import { RestaurantQuery } from "./query.js";
import { RestaurantMutation } from "./mutation.js";
import {
  RestaurantInitialSetupMutation,
  RestaurantInitialSetupQuery,
} from "./initialSetup.js";
import Restaurant from "./types.js";
import { withRestaurantCategoryIndexId } from "./categoryIndexPayload.js";

async function restaurantCategoryIndexes(...args) {
  const rows = await RestaurantQuery.restaurantCategoryIndexes(...args);
  const filters = args?.[1] || {};

  return (rows || []).map((row) =>
    withRestaurantCategoryIndexId(row, {
      restaurantId: filters.restaurantId,
      timeSlot: filters.timeSlot,
    }),
  );
}

async function updateRestaurantCategoryIndex(...args) {
  const row = await RestaurantMutation.updateRestaurantCategoryIndex(...args);
  const input = args?.[1]?.input || {};

  return withRestaurantCategoryIndexId(row, {
    restaurantId: input.restaurantId,
    timeSlot: input.timeSlot,
  });
}

export default {
  Query: {
    ...RestaurantQuery,
    ...RestaurantInitialSetupQuery,
    restaurantCategoryIndexes,
  },
  Mutation: {
    ...RestaurantMutation,
    ...RestaurantInitialSetupMutation,
    updateRestaurantCategoryIndex,
  },
  ...Restaurant,
};
