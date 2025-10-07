// src/graphql/resolvers/query.js

export default {
  menuItems: (_, { restaurantId, categoryId, search, limit = 20 }) => {
    const q = { restaurantId };
    if (categoryId) q.categoryId = categoryId;
    if (search) q.name = new RegExp(search, "i");
    return MenuItem.find(q).limit(limit);
  },

  order: (_, { id }) => Order.findById(id),
};
