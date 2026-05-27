import { describe, it, expect } from 'vitest';
import { getRefreshUrl } from '@/lib/apiBaseUrl';

describe('apollo refresh url helper', () => {
  it('uses backend api base url', () => {
    expect(getRefreshUrl()).toBe('http://localhost:4000/api/auth/refresh');
  });
});
