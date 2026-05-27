import { describe, it, expect } from 'vitest';
import { setAuth, getToken, clearAuth } from './authStorage';

describe('authStorage', () => {
  it('stores token in memory only', () => {
    clearAuth();
    setAuth({ token: 'abc' });
    expect(getToken()).toBe('abc');
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('clearAuth removes legacy keys', () => {
    localStorage.setItem('auth_token', 'x');
    localStorage.setItem('auth_user', 'x');
    localStorage.setItem('auth_remember', 'x');
    sessionStorage.setItem('token', 'x');
    sessionStorage.setItem('auth_remember_until', 'x');
    clearAuth();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(localStorage.getItem('auth_remember')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('auth_remember_until')).toBeNull();
  });
});
