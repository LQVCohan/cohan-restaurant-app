// src/graphql/resolvers/types/Restaurant.js

export default {
  Modifier: {
    id: (parent) => parent.id ?? (parent._id ? String(parent._id) : null),
  },
};
