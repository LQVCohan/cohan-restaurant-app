describe('env config normalization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('maps DATABASE_URL to MONGO_URI before validation', async () => {
    delete process.env.MONGO_URI;
    process.env.DATABASE_URL = 'mongodb://127.0.0.1:27017';
    process.env.JWT_SECRET = 'this-is-a-strong-jwt-secret-with-32-characters-min';
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'table-secret-123456789';

    const { validateEnv } = await import('../../src/config/env.js');
    validateEnv();

    expect(process.env.MONGO_URI).toBe('mongodb://127.0.0.1:27017');
  });


  it('does not silently default MONGO_URI in development', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.MONGO_URI;
    delete process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'this-is-a-strong-jwt-secret-with-32-characters-min';
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'table-secret-123456789';

    const { validateEnv } = await import('../../src/config/env.js');

    expect(() => validateEnv()).toThrow(/MONGO_URI/);
  });

  it('maps DB_NAME to MONGO_DB when MONGO_DB is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    delete process.env.MONGO_DB;
    process.env.DB_NAME = 'RestaurantDB';
    process.env.JWT_SECRET = 'this-is-a-strong-jwt-secret-with-32-characters-min';
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'table-secret-123456789';

    const { validateEnv } = await import('../../src/config/env.js');
    validateEnv();

    expect(process.env.MONGO_DB).toBe('RestaurantDB');
  });
});


describe('table access token production validation', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017', JWT_SECRET: 'jwt-secret-123456789' };
  });
  afterAll(() => { process.env = originalEnv; });

  it('fails when TABLE_ACCESS_TOKEN_SECRET is missing in production', async () => {
    delete process.env.TABLE_ACCESS_TOKEN_SECRET;
    const { validateEnv } = await import('../../src/config/env.js');
    expect(() => validateEnv()).toThrow(/TABLE_ACCESS_TOKEN_SECRET/);
  });

  it('fails when TABLE_ACCESS_TOKEN_SECRET equals JWT_SECRET in production', async () => {
    process.env.TABLE_ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
    const { validateEnv } = await import('../../src/config/env.js');
    expect(() => validateEnv()).toThrow(/must differ/);
  });

  it('fails when TABLE_ACCESS_TOKEN_SECRET uses the development fallback in production', async () => {
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'dev_table_access_secret_change_me';
    const { validateEnv } = await import('../../src/config/env.js');
    expect(() => validateEnv()).toThrow(/weak value/);
  });
});

describe('production access token expiry validation', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017', JWT_SECRET: 'this-is-a-strong-jwt-secret-with-32-characters-min', TABLE_ACCESS_TOKEN_SECRET: 'table-secret-123456789' };
  });
  afterAll(() => { process.env = originalEnv; });

  it('accepts 15m and 30m', async () => {
    const { validateEnv } = await import('../../src/config/env.js');
    process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
    expect(() => validateEnv()).not.toThrow();
    process.env.ACCESS_TOKEN_EXPIRES_IN = '30m';
    expect(() => validateEnv()).not.toThrow();
    process.env.ACCESS_TOKEN_EXPIRES_IN = '1h';
    expect(() => validateEnv()).not.toThrow();
  });

  it('rejects >=1d and invalid values', async () => {
    const { validateEnv } = await import('../../src/config/env.js');
    for (const value of ['48h', '1440m', '86401s', '2d', 'invalid']) {
      process.env.ACCESS_TOKEN_EXPIRES_IN = value;
      expect(() => validateEnv()).toThrow(/ACCESS_TOKEN_EXPIRES_IN/);
    }
  });
});
