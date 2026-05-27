import { describe, expect, it } from 'vitest';
import { buildBackendAuthUrl } from '@/lib/apiBase';

describe('apollo auth endpoint base', () => {
  it('builds refresh endpoint from backend base helper', () => {
    const url = buildBackendAuthUrl('/api/auth/refresh');
    expect(url.endsWith('/api/auth/refresh')).toBe(true);
  });
});
