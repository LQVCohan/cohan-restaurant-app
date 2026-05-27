// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { clearAuth, getToken, setAuth } from "@/lib/authStorage";

/* ---------------- HTTP link ---------------- */
const httpLink = new HttpLink({
  uri: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}`
    : "http://localhost:4000/graphql",
  credentials: "include",
});

/* ---------------- Auth link ---------------- */
const authLink = setContext((_, { headers }) => {
  const token =
    getToken();

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

function makeClientIdempotencyKey(operationName = "order") {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${operationName}:${randomPart}`;
}

function shouldAttachIdempotency(operationName = "") {
  return [
    "CreateOrderForTable",
    "CreateOffPremiseOrder",
    "CreateStaffRemoteOrder",
    "CreateCheckoutOrders",
  ].includes(operationName);
}

const idempotencyLink = new ApolloLink((operation, forward) => {
  const operationName = operation?.operationName || "";
  const input = operation?.variables?.input;

  if (shouldAttachIdempotency(operationName) && input && typeof input === "object") {
    const hasTopLevelKey = Boolean(input.idempotencyKey);
    const hasClientMetaKey = Boolean(input.clientMeta?.idempotencyKey);
    if (!hasTopLevelKey && !hasClientMetaKey) {
      const key = makeClientIdempotencyKey(operationName);
      const nextInput = {
        ...input,
        ...(operationName === "CreateCheckoutOrders" ? { idempotencyKey: key } : {}),
        clientMeta: {
          ...(input.clientMeta || {}),
          idempotencyKey: key,
          source:
            input.clientMeta?.source ||
            (operationName === "CreateOrderForTable"
              ? "pos_dine_in"
              : operationName === "CreateStaffRemoteOrder"
                ? "staff_remote"
                : operationName === "CreateCheckoutOrders"
                  ? "customer_checkout"
                  : "off_premise"),
        },
      };
      operation.variables = {
        ...operation.variables,
        input: nextInput,
      };
    }
  }

  return forward(operation);
});

function dispatchOutOfStockPrompt({ operation, graphQLError }) {
  if (typeof window === "undefined") return;

  const input = operation?.variables?.input || {};
  const hasUsefulContext = Boolean(
    input.restaurantId &&
      (input.menuItemId ||
        input.dishId ||
        (Array.isArray(input.items) && input.items.length > 0)),
  );

  if (!hasUsefulContext) return;

  window.dispatchEvent(
    new CustomEvent("menu-availability:out-of-stock", {
      detail: {
        operationName: operation?.operationName || null,
        variables: operation?.variables || {},
        message:
          graphQLError?.message ||
          "Món vừa hết khả dụng hoặc không đủ tồn kho để giữ chỗ.",
      },
    }),
  );
}

let refreshPromise = null;
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload?.token) setAuth({ token: payload.token });
        else clearAuth();
        return payload?.token || null;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

const errorLink = onError(({ graphQLErrors, operation, forward, networkError }) => {
  const outOfStockError = (graphQLErrors || []).find((error) => {
    const code = error?.extensions?.code;
    const message = String(error?.message || "").toLowerCase();
    return (
      code === "OUT_OF_STOCK" ||
      message.includes("hết hàng") ||
      message.includes("không đủ tồn kho") ||
      message.includes("out of stock")
    );
  });

  if (outOfStockError) {
    dispatchOutOfStockPrompt({ operation, graphQLError: outOfStockError });
  }

  const unauthenticated = (graphQLErrors || []).some((e) => e?.extensions?.code === "UNAUTHENTICATED") || networkError?.statusCode === 401;
  if (unauthenticated && !operation.getContext()._retry) {
    operation.setContext({ _retry: true });
    return new ApolloLink((obs) => {
      refreshAccessToken().then((token) => {
        if (!token) return obs.error(networkError || new Error("Unauthenticated"));
        forward(operation).subscribe(obs);
      }).catch((err) => obs.error(err));
    }).request(operation);
  }
});

/* ---------------- Link + Cache ---------------- */
const link = ApolloLink.from([errorLink, idempotencyLink, authLink, httpLink]);

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
