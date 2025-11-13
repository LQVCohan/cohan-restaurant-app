// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
  split,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient as createWsClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

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

/* ---------------- WS link (subscriptions) ---------------- */
const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:4000/graphql";

const wsLink =
  typeof window === "undefined"
    ? null
    : new GraphQLWsLink(
        createWsClient({
          url: wsUrl,
          connectionParams: () => {
            const token =
              localStorage.getItem("auth_token") ||
              localStorage.getItem("token") ||
              sessionStorage.getItem("auth_token") ||
              sessionStorage.getItem("token");

            return {
              headers: {
                ...(token ? { authorization: `Bearer ${token}` } : {}),
              },
            };
          },
          // Debug đơn giản
          on: {
            opened: () => {
              console.log("[WS] connected to", wsUrl);
            },
            closed: (event) => {
              console.log("[WS] closed", event.code, event.reason);
            },
            error: (err) => {
              console.error("[WS] error", err);
            },
          },
        })
      );

/* ---------------- Split link: subscription -> WS, others -> HTTP ---------------- */
const httpAuthLink = authLink.concat(httpLink);

const link =
  typeof window === "undefined" || !wsLink
    ? httpAuthLink
    : split(
        ({ query }) => {
          const def = getMainDefinition(query);
          return (
            def.kind === "OperationDefinition" &&
            def.operation === "subscription"
          );
        },
        wsLink,
        httpAuthLink
      );

/* ---------------- Cache + typePolicies (bạn giữ nguyên) ---------------- */
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
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
      fields: {
        items: {
          merge(_existing, incoming) {
            return incoming ?? [];
          },
        },
        totals: {
          merge(_existing, incoming) {
            return incoming ?? null;
          },
        },
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
    OrderEdge: {
      keyFields: ["cursor"],
    },
    OrderConnection: {
      keyFields: false,
    },
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
