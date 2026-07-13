import { CategoryQuery } from "./query.js";
import { CustomerCategoryQuery } from "./customerQuery.js";
import { CategoryMultiSlotQuery } from "./multiSlotQuery.js";
import { HomeCategoryQuery } from "./homeQuery.js";
import { CategoryMutation } from "./mutation.js";
import Category from "./types.js";

export default {
  Query: {
    ...CategoryQuery,
    ...CustomerCategoryQuery,
    ...CategoryMultiSlotQuery,
    ...HomeCategoryQuery,
  },
  Mutation: { ...CategoryMutation },
  ...Category,
};
