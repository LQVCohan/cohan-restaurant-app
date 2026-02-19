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
    process.env.JWT_SECRET = 'secret';

    const { validateEnv } = await import('../../src/config/env.js');
    validateEnv();

    expect(process.env.MONGO_URI).toBe('mongodb://127.0.0.1:27017');
  });

  it('maps DB_NAME to MONGO_DB when MONGO_DB is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    delete process.env.MONGO_DB;
    process.env.DB_NAME = 'RestaurantDB';
    process.env.JWT_SECRET = 'secret';

    const { validateEnv } = await import('../../src/config/env.js');
    validateEnv();

    expect(process.env.MONGO_DB).toBe('RestaurantDB');
  });
});
