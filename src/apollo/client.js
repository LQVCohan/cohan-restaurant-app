// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

/* ---------------- HTTP link tới GraphQL server ---------------- */
const httpLink = new HttpLink({
  uri: import.meta.env.VITE_API_URL || "http://localhost:4000/graphql",
  // credentials: "include", // bật nếu bạn dùng cookie
});

/* ---------------- Auth link: chèn header Authorization ---------------- */
const authLink = setContext((_, { headers }) => {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("auth_token") ||
    sessionStorage.getItem("token");

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

/* ---------------- Link chain ---------------- */
const link = ApolloLink.from([authLink, httpLink]);

/* ---------------- Cache + Type Policies ----------------
   - Table/Floor nhận diện theo id
   - Query.tables / Query.floors: key theo restaurantId, không merge cũ
   - Field merge: position/tags luôn replace (đơn giản cho optimistic)
---------------------------------------------------------------- */
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        tables: {
          keyArgs: ["restaurantId"],
          merge(_existing, incoming) {
            // luôn thay danh sách bằng kết quả mới
            return incoming;
          },
        },
        floors: {
          keyArgs: ["restaurantId"],
          merge(_existing, incoming) {
            return incoming;
          },
        },
      },
    },
    Table: {
      keyFields: ["id"],
      fields: {
        position: {
          // tránh merge sâu object position để optimistic đơn giản
          merge(_existing, incoming) {
            return incoming ?? null;
          },
        },
        tags: {
          merge(_existing, incoming) {
            return incoming ?? [];
          },
        },
      },
    },
    Floor: {
      keyFields: ["id"],
    },
  },
});

/* ---------------- Apollo Client ---------------- */
export const apolloClient = new ApolloClient({
  link,
  cache,
  connectToDevTools: import.meta.env.DEV,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      errorPolicy: "all",
    },
    query: {
      fetchPolicy: "cache-first",
      errorPolicy: "all",
    },
    mutate: {
      errorPolicy: "all",
    },
  },
});

/* Dev helper: cho phép truy cập cache trong optimistic/update nếu cần */
if (import.meta.env.DEV) {
  window.__APOLLO_CLIENT__ = apolloClient;
}
