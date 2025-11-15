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
  uri: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}`
    : "http://localhost:4000/graphql",
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

/* ---------------- Link + Cache ---------------- */
const link = ApolloLink.from([authLink, httpLink]);

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        ordersByRestaurant: {
          keyArgs: ["restaurantId", "limit"],
          merge(existing, incoming, { args }) {
            const edgesIncoming = incoming?.edges ?? [];
            const pageInfoIncoming = incoming?.pageInfo ?? null;

            if (!args || !args.cursor) {
              return {
                __typename: incoming.__typename || "OrderConnection",
                edges: edgesIncoming,
                pageInfo: pageInfoIncoming,
              };
            }

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
    Order: {
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
