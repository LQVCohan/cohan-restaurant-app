// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { removeTypenameFromVariables } from "@apollo/client/link/remove-typename";
import { clearAuth, getToken, setAuth } from "@/lib/authStorage";
import { getGraphqlUrl, toApiAssetUrl } from "@/lib/apiBaseUrl";
import { refreshAccessTokenOnce } from "@/lib/authRefresh";

/* ---------------- HTTP link ---------------- */
const httpLink = new HttpLink({
  uri: getGraphqlUrl(),
  credentials: "include",
});

/* ---------------- Auth link ---------------- */
const authLink = setContext((_, { headers }) => {
  const token = getToken();

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

function makeClientIdempotencyKey(operationName = "order") {
  const cryptoApi = globalThis.crypto;
  let randomPart;

  if (typeof cryptoApi?.randomUUID === "function") {
    randomPart = cryptoApi.randomUUID();
  } else if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    randomPart = Array.from(bytes, (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
  } else {
    throw new Error("Secure idempotency key generation is unavailable");
  }

  return `${operationName}:v1:${randomPart}`;
}

function shouldAttachIdempotency(operationName = "") {
  return [
    "CreateOrderForTable",
    "CreateOffPremiseOrder",
    "CreateStaffRemoteOrder",
    "CreateCheckoutOrders",
  ].includes(operationName);
}

const checkoutIdempotencyMemory = new Map();
const CHECKOUT_IDEMPOTENCY_STORAGE_PREFIX = "checkout-idempotency:";

function canonicalizeIdempotencyValue(value) {
  if (Array.isArray(value)) return value.map(canonicalizeIdempotencyValue);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .filter((key) => key !== "idempotencyKey")
    .sort()
    .reduce((acc, key) => {
      acc[key] = canonicalizeIdempotencyValue(value[key]);
      return acc;
    }, {});
}

function hashIdempotencyPayload(value) {
  const serialized = JSON.stringify(canonicalizeIdempotencyValue(value));
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${(hash >>> 0).toString(16)}:${serialized.length}`;
}

function readStoredCheckoutKey(storageKey) {
  if (typeof window === "undefined") {
    return checkoutIdempotencyMemory.get(storageKey) || null;
  }

  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return checkoutIdempotencyMemory.get(storageKey) || null;
  }
}

function storeCheckoutKey(storageKey, key) {
  checkoutIdempotencyMemory.set(storageKey, key);
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(storageKey, key);
  } catch {
    // The in-memory fallback still keeps retries stable for this page session.
  }
}

function getStableCheckoutIdempotencyKey(input) {
  const checkoutAttempt = String(
    input?.idempotencyKey || input?.clientMeta?.idempotencyKey || "",
  ).trim();
  const storageIdentity = checkoutAttempt
    ? `attempt:${checkoutAttempt}`
    : `payload:${hashIdempotencyPayload(input)}`;
  const storageKey = `${CHECKOUT_IDEMPOTENCY_STORAGE_PREFIX}${storageIdentity}`;
  const stored = readStoredCheckoutKey(storageKey);
  if (stored) return stored;

  const key = makeClientIdempotencyKey("CreateCheckoutOrders");
  storeCheckoutKey(storageKey, key);
  return key;
}

export function normalizeScheduleGraphqlVariables(
  operationName,
  variables = {},
) {
  if (operationName !== "ShiftAcknowledgements") return variables;
  if (typeof variables?.status !== "string") return variables;

  const status = variables.status.trim().toUpperCase();
  if (!status || status === variables.status) return variables;

  return { ...variables, status };
}

const scheduleEnumLink = new ApolloLink((operation, forward) => {
  operation.variables = normalizeScheduleGraphqlVariables(
    operation?.operationName,
    operation?.variables,
  );
  return forward(operation);
});

const idempotencyLink = new ApolloLink((operation, forward) => {
  const operationName = operation?.operationName || "";
  const input = operation?.variables?.input;

  if (shouldAttachIdempotency(operationName) && input && typeof input === "object") {
    const isCustomerCheckout = operationName === "CreateCheckoutOrders";
    const hasTopLevelKey = Boolean(input.idempotencyKey);
    const hasClientMetaKey = Boolean(input.clientMeta?.idempotencyKey);

    if (isCustomerCheckout || (!hasTopLevelKey && !hasClientMetaKey)) {
      const key = isCustomerCheckout
        ? getStableCheckoutIdempotencyKey(input)
        : makeClientIdempotencyKey(operationName);
      const nextInput = {
        ...input,
        ...(isCustomerCheckout ? { idempotencyKey: key } : {}),
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

const removeTypenameLink = removeTypenameFromVariables();

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

  const unauthenticated =
    (graphQLErrors || []).some(
      (e) => e?.extensions?.code === "UNAUTHENTICATED",
    ) || networkError?.statusCode === 401;
  if (unauthenticated && !operation.getContext()._retry) {
    operation.setContext({ _retry: true });
    return new ApolloLink((obs) => {
      refreshAccessTokenOnce()
        .then((payload) => {
          if (!payload?.token) {
            clearAuth();
            return obs.error(networkError || new Error("Unauthenticated"));
          }
          setAuth({ token: payload.token });
          forward(operation).subscribe(obs);
        })
        .catch((err) => obs.error(err));
    }).request(operation);
  }
});

/* ---------------- Link + Cache ---------------- */
const link = ApolloLink.from([
  errorLink,
  scheduleEnumLink,
  idempotencyLink,
  removeTypenameLink,
  authLink,
  httpLink,
]);

const imageFieldPolicy = {
  read(existing) {
    return toApiAssetUrl(existing);
  },
};

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
              (existing?.edges ?? []).map((e) => e?.cursor).filter(Boolean),
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
        menuItemsWithRecipes: {
          keyArgs: ["restaurantId", "timeSlot", "search", "categoryId", "first", "after"],
          merge(_existing, incoming) {
            if (!incoming) return incoming;
            return {
              ...incoming,
              items: [...(incoming.items || [])],
              pageInfo: incoming.pageInfo ? { ...incoming.pageInfo } : incoming.pageInfo,
            };
          },
        },
      },
    },
    MenuItem: {
      keyFields: ["id"],
      fields: {
        thumbImage: imageFieldPolicy,
      },
    },
    MenuItemSearchSuggestion: {
      keyFields: ["id"],
      fields: {
        thumbImage: imageFieldPolicy,
      },
    },
    CartItem: {
      keyFields: ["id"],
      fields: {
        thumbImage: imageFieldPolicy,
      },
    },
    OrderItem: {
      fields: {
        thumbImage: imageFieldPolicy,
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
      errorPolicy: "none",
    },
  },
});

if (import.meta.env.DEV) {
  window.__APOLLO_CLIENT__ = apolloClient;
}
