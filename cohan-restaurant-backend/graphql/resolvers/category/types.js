export default {
  Category: {
    id: (p) => p.id ?? String(p._id),
  },
};
