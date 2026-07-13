// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
  Observable,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { removeTypenameFromVariables } from "@apollo/client/link/remove-typename";
import { clearAuth, getToken, setAuth } from "@/lib/authStorage";
import { getGraphqlUrl, toApiAssetUrl } from "@/lib/apiBaseUrl";
import { refreshAccessTokenOnce } from "@/lib/authRefresh";
import { managerMenuSelectionLink } from "./managerMenuSelectionLink";

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

const ORDER_CLIENT_META_OPERATIONS = new Set([
  "CreateOrderForTable",
  "CreateOffPremiseOrder",
  "CreateStaffRemoteOrder",
]);

const PAYMENT_RESULT_FIELD = Object.freeze({
  CreateCheckoutOrders: "createCheckoutOrders",
  CreateWalletTopup: "createWalletTopup",
  CreateOrderPayment: "createOrderPayment",
  CreateCheckoutOrderPayment: "createOrderPayment",
  CreateReservationPayment: "createReservationPayment",
  PayOrdersByTableId: "payOrdersByTableId",
  PayOrdersByOrderIds: "payOrdersByOrderIds",
  PayOrdersWithWallet: "payOrdersWithWallet",
  RefundToWallet: "refundToWallet",
  AdjustWalletBalance: "adjustWalletBalance",
});

const idempotencyMemory = new Map();
const PAYMENT_IDEMPOTENCY_STORAGE_PREFIX = "payment-idempotency:";

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

function readStoredIdempotencyKey(storageKey) {
  if (typeof window === "undefined") {
    return idempotencyMemory.get(storageKey) || null;
  }

  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return idempotencyMemory.get(storageKey) || null;
  }
}

function storeIdempotencyKey(storageKey, key) {
  idempotencyMemory.set(storageKey, key);
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(storageKey, key);
  } catch {
    // The in-memory fallback still keeps retries stable for this page session.
  }
}

function removeStoredIdempotencyKey(storageKey, key) {
  if (!storageKey) return;

  if (idempotencyMemory.get(storageKey) === key) {
    idempotencyMemory.delete(storageKey);
  }
  if (typeof window === "undefined") return;

  try {
    if (window.sessionStorage.getItem(storageKey) === key) {
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // The in-memory entry was already cleared.
  }
}

function getStablePaymentIdempotencyKey(operationName, input) {
  const fingerprint = hashIdempotencyPayload(input);
  const storageKey = `${PAYMENT_IDEMPOTENCY_STORAGE_PREFIX}${operationName}:${fingerprint}`;
  const stored = readStoredIdempotencyKey(storageKey);
  if (stored) return { key: stored, storageKey };

  const key = makeClientIdempotencyKey(operationName);
  storeIdempotencyKey(storageKey, key);
  return { key, storageKey };
}

function resolvePaymentIdempotencyKey(operationName, input) {
  const explicitKey = String(input?.idempotencyKey || "").trim();
  if (explicitKey) {
    return { key: explicitKey, storageKey: null };
  }
  return getStablePaymentIdempotencyKey(operationName, input);
}

function orderSource(operationName, currentSource) {
  if (currentSource) return currentSource;
  if (operationName === "CreateOrderForTable") return "pos_dine_in";
  if (operationName === "CreateStaffRemoteOrder") return "staff_remote";
  return "off_premise";
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
  const paymentResultField = PAYMENT_RESULT_FIELD[operationName] || null;
  let paymentKeyState = null;

  if (input && typeof input === "object" && paymentResultField) {
    paymentKeyState = resolvePaymentIdempotencyKey(operationName, input);
    const key = paymentKeyState.key;
    const nextInput = {
      ...input,
      idempotencyKey: key,
      ...(operationName === "CreateCheckoutOrders"
        ? {
            clientMeta: {
              ...(input.clientMeta || {}),
              idempotencyKey: key,
              source: input.clientMeta?.source || "customer_checkout",
            },
          }
        : {}),
    };
    operation.variables = {
      ...operation.variables,
      input: nextInput,
    };
  } else if (
    input &&
    typeof input === "object" &&
    ORDER_CLIENT_META_OPERATIONS.has(operationName) &&
    !input.clientMeta?.idempotencyKey
  ) {
    const key = makeClientIdempotencyKey(operationName);
    operation.variables = {
      ...operation.variables,
      input: {
        ...input,
        clientMeta: {
          ...(input.clientMeta || {}),
          idempotencyKey: key,
          source: orderSource(operationName, input.clientMeta?.source),
        },
      },
    };
  }

  const observable = forward(operation);
  if (!paymentKeyState || !paymentResultField) return observable;

  return new Observable((observer) => {
    const subscription = observable.subscribe({
      next(result) {
        if (
          !result?.errors?.length &&
          result?.data?.[paymentResultField] != null
        ) {
          removeStoredIdempotencyKey(
            paymentKeyState.storageKey,
            paymentKeyState.key,
          );
        }
        observer.next(result);
      },
      error(error) {
        observer.error(error);
      },
      complete() {
        observer.complete();
      },
    });

    return () => subscription.unsubscribe();
  });
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
  managerMenuSelectionLink,
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
          keyArgs: [
            "restaurantId",
            "timeSlot",
            "search",
            "categoryId",
            "first",
            "after",
          ],
          merge(_existing, incoming) {
            if (!incoming) return incoming;
            return {
              ...incoming,
              items: [...(incoming.items || [])],
              pageInfo: incoming.pageInfo
                ? { ...incoming.pageInfo }
                : incoming.pageInfo,
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
