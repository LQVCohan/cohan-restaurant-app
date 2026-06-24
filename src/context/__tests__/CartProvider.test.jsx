import React from 'react';
import { render, screen } from '@testing-library/react';
import { CartProvider, useCart } from '../CartProvider';

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual('@apollo/client');
  return { ...actual, useQuery: () => ({ data: null, refetch: vi.fn(), loading: false }) };
});

vi.mock('../../hooks/useCart', () => ({
  useCart: () => ({ items: [{ id: 1 }], totalItems: 1 }),
}));

function Consumer() {
  const cart = useCart();
  return <div data-testid="items">{cart.totalItems}</div>;
}

describe('CartProvider', () => {
  it('provides cart state from hook to descendants', () => {
    render(
      <CartProvider>
        <Consumer />
      </CartProvider>
    );

    expect(screen.getByTestId('items')).toHaveTextContent('1');
  });

  it('throws when useCart is used outside provider', () => {
    expect(() => render(<Consumer />)).toThrow('useCart must be used inside <CartProvider>');
  });
});
