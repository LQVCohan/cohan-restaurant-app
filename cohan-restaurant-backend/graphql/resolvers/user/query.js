export const UserQuery = {
  me: (_, __, { user }) => (user ? user : null),
};
