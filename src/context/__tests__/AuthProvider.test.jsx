import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { AuthContext } from '../AuthContext';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@apollo/client/react', () => ({
  useQuery: () => ({ data: null, loading: false, error: null }),
}));

function Consumer() {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <div data-testid="is-auth">{String(ctx?.isAuthenticated)}</div>
      <button onClick={() => ctx.login('abc', { roleName: 'manager' }, null, true)}>login</button>
      <button onClick={() => ctx.logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigateMock.mockReset();
  });

  it('writes auth data to storage on login', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('login'));

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBe('abc');
      expect(localStorage.getItem('token')).toBe('abc');
      expect(screen.getByTestId('is-auth')).toHaveTextContent('true');
    });
  });

  it('clears auth data and navigates to login on logout', async () => {
    localStorage.setItem('auth_token', 'abc');
    localStorage.setItem('token', 'abc');

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    });
  });
});
