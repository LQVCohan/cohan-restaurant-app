import { describe, it, expect, vi } from 'vitest';

describe('apiBaseUrl', () => {
  it('derives from graphql url cases', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'http://localhost:4000/graphql');
    let mod = await import('./apiBaseUrl');
    expect(mod.getRefreshUrl()).toBe('http://localhost:4000/api/auth/refresh');

    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/graphql');
    mod = await import('./apiBaseUrl');
    expect(mod.getRefreshUrl()).toBe('https://api.example.com/api/auth/refresh');

    vi.resetModules();
    vi.stubEnv('VITE_API_URL', '/graphql');
    mod = await import('./apiBaseUrl');
    expect(mod.getRefreshUrl()).toBe('/api/auth/refresh');

    vi.resetModules();
    vi.unstubAllEnvs();
    mod = await import('./apiBaseUrl');
    expect(mod.getRefreshUrl()).toBe('http://localhost:4000/api/auth/refresh');
  });
});
