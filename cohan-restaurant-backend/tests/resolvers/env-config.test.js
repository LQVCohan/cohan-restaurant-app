import { validateEnv } from '../../src/config/env.js';

describe('env config normalization', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv }; });
  afterAll(() => { process.env = originalEnv; });

  it('normalizes mongo uri from DATABASE_URL', () => {
    delete process.env.MONGO_URI; process.env.DATABASE_URL='mongodb://127.0.0.1:27017'; process.env.JWT_SECRET='secret'; process.env.TABLE_ACCESS_TOKEN_SECRET='table-secret-123456789';
    validateEnv();
    expect(process.env.MONGO_URI).toBe('mongodb://127.0.0.1:27017');
  });

  it('production access token duration policy', () => {
    process.env.NODE_ENV='production'; process.env.MONGO_URI='mongodb://127.0.0.1:27017'; process.env.JWT_SECRET='a'.repeat(40); process.env.TABLE_ACCESS_TOKEN_SECRET='b'.repeat(40);
    for (const v of ['15m','30m','1h','1440m']) { process.env.ACCESS_TOKEN_EXPIRES_IN=v; expect(() => validateEnv()).not.toThrow(); }
    for (const v of ['48h','86401s','2d','invalid']) { process.env.ACCESS_TOKEN_EXPIRES_IN=v; expect(() => validateEnv()).toThrow(/ACCESS_TOKEN_EXPIRES_IN/); }
  });
});
