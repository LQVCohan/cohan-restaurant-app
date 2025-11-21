// src/graphql/menuItem/type.js
import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLList,
  GraphQLBoolean,
} from "graphql";
import { ServingVariantType } from "../recipe/type.js";

export const MenuItemType = new GraphQLObjectType({
  name: "MenuItem",
  fields: () => ({
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    description: { type: GraphQLString },
    basePrice: { type: GraphQLFloat },
    byWeight: { type: GraphQLBoolean },
    status: { type: GraphQLString },
    avgPrepTimeMin: { type: GraphQLFloat },
    point: { type: GraphQLFloat },

    // ⚡ FE chỉ cần gọi item.servingVariants
    servingVariants: {
      type: new GraphQLList(ServingVariantType),
      resolve(parent) {
        // parent = MenuItem document đã autoPopulate recipe
        return parent?.recipe?.servingVariants || [];
      },
    },
  }),
});
