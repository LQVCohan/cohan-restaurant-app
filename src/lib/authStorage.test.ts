import { describe, it, expect, beforeEach } from 'vitest';
import { clearAuth, getToken, SESSION_ACCESS_TOKEN_KEY, setAuth } from './authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuth();
  });

  it('stores token in memory and sessionStorage without using legacy localStorage keys', () => {
    setAuth({ token: 'abc' });

    expect(getToken()).toBe('abc');
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBe('abc');
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('restores token from sessionStorage when memory token is empty', () => {
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, 'restored-token');

    expect(getToken()).toBe('restored-token');
  });

  it('setAuth without a token removes the sessionStorage access token', () => {
    setAuth({ token: 'abc' });
    setAuth({ token: null });

    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('clearAuth removes sessionStorage token and legacy keys', () => {
    setAuth({ token: 'abc' });
    localStorage.setItem('auth_token', 'x');
    localStorage.setItem('auth_user', 'x');
    localStorage.setItem('auth_remember', 'x');
    sessionStorage.setItem('token', 'x');
    sessionStorage.setItem('auth_remember_until', 'x');

    clearAuth();

    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(localStorage.getItem('auth_remember')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('auth_remember_until')).toBeNull();
  });
});
