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
