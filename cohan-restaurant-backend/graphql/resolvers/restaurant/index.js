import { RestaurantQuery } from "./query.js";
import { RestaurantMutation } from "./mutation.js";
import Restaurant from "./types.js";

export default {
  Query: { ...RestaurantQuery },
  Mutation: { ...RestaurantMutation },
  ...Restaurant,
};
