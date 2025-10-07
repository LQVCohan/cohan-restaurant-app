// src/graphql/resolvers/types/Restaurant.js

export default {
  Permission: {
    id: (p) => p.id ?? String(p._id),
  },
};
