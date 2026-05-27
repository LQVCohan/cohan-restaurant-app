import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { AuthContext } from '../AuthContext';

const navigateMock = vi.fn();
const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ ok: true, token: 'new-token', user: { id: '1', roleName: 'customer' } }) }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@apollo/client/react', () => ({
  useQuery: () => ({ data: null, loading: false, error: null }),
}));

function Consumer() {
  const ctx = useContext(AuthContext);
  return <button onClick={() => ctx.logout()}>logout</button>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockClear();
    navigateMock.mockReset();
  });

  it('calls refresh endpoint on startup with credentials include', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/refresh');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('calls logout endpoint with credentials include', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/auth/logout'))).toBe(true));
  });
});
