import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { AuthContext } from '../AuthContext';

const navigateMock = vi.fn();
const originalLocalStorage = window.localStorage;

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
      <button
        onClick={() =>
          ctx.login('abc', { roleName: 'manager' }, null, { persistSession: true })
        }
      >
        login
      </button>
      <button onClick={() => ctx.logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    localStorage.clear();
    sessionStorage.clear();
    navigateMock.mockReset();
  });

  afterAll(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
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

  it('falls back to sessionStorage when localStorage is unavailable', async () => {
    const quotaError = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(quotaError),
        removeItem: vi.fn(quotaError),
        clear: vi.fn(),
        key: vi.fn(() => null),
        length: 0,
      },
    });

    sessionStorage.clear();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('login'));

    await waitFor(() => {
      expect(sessionStorage.getItem('auth_token')).toBe('abc');
      expect(sessionStorage.getItem('token')).toBe('abc');
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
