import { createContext } from "react";

// Nếu sau này bạn có query "me" bằng Apollo, có thể import client để soft-verify:
// import { useApolloClient, gql } from "@apollo/client";

export const AuthContext = createContext({ user: null });
