// src/graphql/resolvers/types/Restaurant.js

export default {
  Menu: {
    id: (p) => p.id ?? String(p._id),
  },
};
