import { CategoryQuery } from "./query.js";
import { CustomerCategoryQuery } from "./customerQuery.js";
import { CategoryMutation } from "./mutation.js";
import Category from "./types.js";

export default {
  Query: {
    ...CategoryQuery,
    ...CustomerCategoryQuery,
  },
  Mutation: { ...CategoryMutation },
  ...Category,
};
