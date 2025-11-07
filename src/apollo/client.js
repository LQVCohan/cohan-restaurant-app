// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

/* ---------------- HTTP link ---------------- */
const httpLink = new HttpLink({
  uri: import.meta.env.VITE_API_URL || "http://localhost:4000/graphql",
});

/* ---------------- Auth link ---------------- */
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

const link = ApolloLink.from([authLink, httpLink]);

/* ---------------- Cache + Type Policies ----------------
   Bổ sung:
   - Query.ordersByRestaurant: paginate theo cursor (concat edges nếu có cursor),
     reset list nếu không truyền cursor (lần fetch đầu).
   - Order: items/totals/currentStatus/updatedAt: replace (merge: false/replace).
   - Edge/Connection: set keyFields cho ổn định cache.
---------------------------------------------------------------- */
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Các field sẵn có
        tables: {
          keyArgs: ["restaurantId"],
          merge(_existing, incoming) {
            return incoming;
          },
        },
        floors: {
          keyArgs: ["restaurantId"],
          merge(_existing, incoming) {
            return incoming;
          },
        },

        /* === NEW: paginate OrdersByRestaurant theo cursor === */
        ordersByRestaurant: {
          // Không khóa theo cursor để có thể merge trang tiếp theo
          keyArgs: ["restaurantId", "limit"],
          merge(existing, incoming, { args }) {
            const edgesIncoming = incoming?.edges ?? [];
            const pageInfoIncoming = incoming?.pageInfo ?? null;

            // Nếu không có cursor (lần đầu hoặc refetch đầu danh sách) -> replace
            if (!args || !args.cursor) {
              return {
                __typename: incoming.__typename || "OrderConnection",
                edges: edgesIncoming,
                pageInfo: pageInfoIncoming,
              };
            }

            // Có cursor -> concat (tránh trùng cursor)
            const seen = new Set(
              (existing?.edges ?? []).map((e) => e?.cursor).filter(Boolean)
            );
            const mergedEdges = [
              ...(existing?.edges ?? []),
              ...edgesIncoming.filter((e) => !seen.has(e?.cursor)),
            ];

            return {
              __typename:
                incoming.__typename ||
                existing?.__typename ||
                "OrderConnection",
              edges: mergedEdges,
              pageInfo: pageInfoIncoming ?? existing?.pageInfo ?? null,
            };
          },
        },
      },
    },

    /* === NEW: Chuẩn hóa Order === */
    Order: {
      keyFields: ["id"],
      fields: {
        // items thay thế toàn bộ sau mutation (không merge từng phần tử)
        items: {
          merge(_existing, incoming) {
            return incoming ?? [];
          },
        },
        // totals thay toàn bộ
        totals: {
          merge(_existing, incoming) {
            return incoming ?? null;
          },
        },
        // các field primitive chỉ cần replace
        currentStatus: {
          merge(_existing, incoming) {
            return incoming ?? _existing ?? "pending";
          },
        },
        updatedAt: {
          merge(_existing, incoming) {
            return incoming ?? _existing ?? null;
          },
        },
      },
    },

    /* === NEW: Node con của connection === */
    OrderEdge: {
      keyFields: ["cursor"],
    },
    OrderConnection: {
      keyFields: false,
    },

    /* (giữ nguyên) */
    Table: {
      keyFields: ["id"],
      fields: {
        position: {
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

if (import.meta.env.DEV) {
  window.__APOLLO_CLIENT__ = apolloClient;
}
