import { gql } from '@apollo/client';
import { describe, it, expect } from 'vitest';
import { getRefreshUrl } from '@/lib/apiBaseUrl';
import { getToken, SESSION_ACCESS_TOKEN_KEY, setAuth } from '@/lib/authStorage';

describe('apollo refresh url helper', () => {
  it('uses backend api base url', () => {
    expect(getRefreshUrl()).toBe('http://localhost:4000/api/auth/refresh');
  });
});

describe('apollo authorization token source', () => {
  it('restores Authorization token from sessionStorage through getToken', () => {
    setAuth({ token: null });
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, 'restored-apollo-token');

    expect(getToken()).toBe('restored-apollo-token');
  });

  it('attaches Authorization from restored getToken', async () => {
    setAuth({ token: null });
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, 'restored-apollo-token');
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { __typename: 'Query' } }),
      headers: { get: () => 'application/json' },
    }));

    const { apolloClient } = await import('./client.js');
    await apolloClient.query({
      query: gql`query ApolloAuthHeaderTest { __typename }`,
      fetchPolicy: 'network-only',
    });

    const [, request] = global.fetch.mock.calls[0];
    expect(request.headers.authorization).toBe('Bearer restored-apollo-token');
  });
});

describe('apollo mutation variable sanitization', () => {
  it('removes nested __typename metadata before sending GraphQL input', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: { updateMenuItem: { id: 'menu-item-1' } },
      }),
      headers: { get: () => 'application/json' },
    }));

    const { apolloClient } = await import('./client.js');
    await apolloClient.mutate({
      mutation: gql`
        mutation ApolloTypenameInputTest($input: UpdateMenuItemInput!) {
          updateMenuItem(input: $input) {
            id
          }
        }
      `,
      variables: {
        input: {
          id: 'menu-item-1',
          tasteProfile: {
            __typename: 'MenuItemTasteProfile',
            containsOnion: false,
            containsCilantro: false,
            sugar: 100,
            spice: 'Vừa',
          },
        },
      },
    });

    const [, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.variables.input.tasteProfile).toEqual({
      containsOnion: false,
      containsCilantro: false,
      sugar: 100,
      spice: 'Vừa',
    });
  });
});

describe('apollo payment idempotency', () => {
  it('injects an idempotency key for the checkout modal VNPAY operation name', async () => {
    sessionStorage.clear();
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: { createOrderPayment: { id: 'payment-1' } },
      }),
      headers: { get: () => 'application/json' },
    }));

    const { apolloClient } = await import('./client.js');
    await apolloClient.mutate({
      mutation: gql`
        mutation CreateCheckoutOrderPayment($input: CreateOrderPaymentInput!) {
          createOrderPayment(input: $input) {
            id
          }
        }
      `,
      variables: {
        input: {
          restaurantId: 'restaurant-1',
          orderIds: ['order-1'],
          provider: 'vnpay',
          paymentMethod: 'vnpay',
        },
      },
    });

    const [, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.variables.input.idempotencyKey).toMatch(
      /^CreateCheckoutOrderPayment:v1:/,
    );
  });

  it('preserves the checkout key supplied by the checkout flow', async () => {
    sessionStorage.clear();
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: {
          createCheckoutOrders: {
            checkout: { checkoutCode: 'CHECKOUT-1' },
          },
        },
      }),
      headers: { get: () => 'application/json' },
    }));

    const { apolloClient } = await import('./client.js');
    await apolloClient.mutate({
      mutation: gql`
        mutation CreateCheckoutOrders($input: CreateCheckoutOrdersInput!) {
          createCheckoutOrders(input: $input) {
            checkout {
              checkoutCode
            }
          }
        }
      `,
      variables: {
        input: {
          idempotencyKey: 'checkout-stable-key',
          paymentMethod: 'card',
          items: [{ restaurantId: 'restaurant-1' }],
        },
      },
    });

    const [, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.variables.input.idempotencyKey).toBe('checkout-stable-key');
    expect(body.variables.input.clientMeta).toMatchObject({
      idempotencyKey: 'checkout-stable-key',
      source: 'customer_checkout',
    });
  });

  it('reuses a generated payment key after a failed attempt', async () => {
    sessionStorage.clear();
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            data: null,
            errors: [{ message: 'Temporary provider failure' }],
          }),
          headers: { get: () => 'application/json' },
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            data: { createOrderPayment: { id: 'payment-1' } },
          }),
          headers: { get: () => 'application/json' },
        }),
    );

    const mutation = gql`
      mutation CreateCheckoutOrderPayment($input: CreateOrderPaymentInput!) {
        createOrderPayment(input: $input) {
          id
        }
      }
    `;
    const variables = {
      input: {
        restaurantId: 'restaurant-1',
        orderIds: ['order-1'],
        provider: 'vnpay',
        paymentMethod: 'vnpay',
      },
    };
    const { apolloClient } = await import('./client.js');

    await expect(apolloClient.mutate({ mutation, variables })).rejects.toThrow(
      'Temporary provider failure',
    );
    await apolloClient.mutate({ mutation, variables });

    const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(firstBody.variables.input.idempotencyKey).toBeTruthy();
    expect(secondBody.variables.input.idempotencyKey).toBe(
      firstBody.variables.input.idempotencyKey,
    );
  });
});
