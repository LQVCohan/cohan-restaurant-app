import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { validateEnv } from '../../src/config/env.js';

describe('env config normalization and production guards', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('maps DATABASE_URL to MONGO_URI', () => {
    delete process.env.MONGO_URI;
    process.env.DATABASE_URL = 'mongodb://127.0.0.1:27017';
    process.env.JWT_SECRET = 'secret';
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'table-secret-123456789';

    validateEnv();
    expect(process.env.MONGO_URI).toBe('mongodb://127.0.0.1:27017');
  });

  it('does not silently default MONGO_URI in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.MONGO_URI;
    delete process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'secret';
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'table-secret-123456789';

    expect(() => validateEnv()).toThrow(/MONGO_URI/);
  });

  it('maps DB_NAME to MONGO_DB when MONGO_DB is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    delete process.env.MONGO_DB;
    process.env.DB_NAME = 'RestaurantDB';
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'b'.repeat(40);

    validateEnv();
    expect(process.env.MONGO_DB).toBe('RestaurantDB');
  });

  it('fails in production when TABLE_ACCESS_TOKEN_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    process.env.JWT_SECRET = 'a'.repeat(40);
    delete process.env.TABLE_ACCESS_TOKEN_SECRET;

    expect(() => validateEnv()).toThrow(/TABLE_ACCESS_TOKEN_SECRET/);
  });

  it('fails in production when TABLE_ACCESS_TOKEN_SECRET equals JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.TABLE_ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

    expect(() => validateEnv()).toThrow(/must differ from JWT_SECRET/);
  });

  it('fails in production when TABLE_ACCESS_TOKEN_SECRET uses dev fallback', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'dev_table_access_secret_change_me';

    expect(() => validateEnv()).toThrow(/weak value is not allowed/);
  });

  it('rejects weak TABLE_ACCESS_TOKEN_SECRET placeholders in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    process.env.JWT_SECRET = 'a'.repeat(40);

    for (const weakSecret of ['changeme', 'secret', 'password', 'short']) {
      process.env.TABLE_ACCESS_TOKEN_SECRET = weakSecret;
      expect(() => validateEnv()).toThrow(/TABLE_ACCESS_TOKEN_SECRET/);
    }
  });

  it('enforces ACCESS_TOKEN_EXPIRES_IN production policy (<= 1 day allowed)', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.TABLE_ACCESS_TOKEN_SECRET = 'b'.repeat(40);

    for (const value of ['15m', '30m', '1h', '1440m']) {
      process.env.ACCESS_TOKEN_EXPIRES_IN = value;
      expect(() => validateEnv()).not.toThrow();
    }

    for (const value of ['48h', '86401s', '2d', 'invalid']) {
      process.env.ACCESS_TOKEN_EXPIRES_IN = value;
      expect(() => validateEnv()).toThrow(/ACCESS_TOKEN_EXPIRES_IN/);
    }
  });
});
