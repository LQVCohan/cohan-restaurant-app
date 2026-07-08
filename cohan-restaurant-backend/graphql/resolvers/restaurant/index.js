import { RestaurantQuery } from "./query.js";
import { RestaurantMutation } from "./mutation.js";
import {
  RestaurantInitialSetupMutation,
  RestaurantInitialSetupQuery,
} from "./initialSetup.js";
import Restaurant from "./types.js";

export default {
  Query: { ...RestaurantQuery, ...RestaurantInitialSetupQuery },
  Mutation: { ...RestaurantMutation, ...RestaurantInitialSetupMutation },
  ...Restaurant,
};
