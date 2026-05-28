import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../../src/server/createServer.js";

const originalEnv = process.env;

async function postGraphql(app, query) {
  return app.inject({
    method: "POST",
    url: "/graphql",
    headers: { "content-type": "application/json" },
    payload: { query },
  });
}

describe("GraphQL limit server integration", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      CORS_ORIGINS: "http://allowed.test",
      JWT_SECRET: "secret",
      MONGO_URI: "mongodb://127.0.0.1:27017/t",
      GRAPHQL_MAX_DEPTH: "3",
      GRAPHQL_MAX_FIELD_COUNT: "100",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns a GraphQL error for an over-deep request", async () => {
    const app = await createServer();
    try {
      const res = await postGraphql(app, `
        query TooDeepIntrospection {
          __schema {
            types {
              fields {
                type {
                  name
                }
              }
            }
          }
        }
      `);

      expect(res.statusCode).toBe(400);
      expect(res.json().errors?.map((error) => error.extensions?.code)).toContain("GRAPHQL_DEPTH_LIMIT_EXCEEDED");
    } finally {
      await app.close();
    }
  });

  it("does not block a normal schema-safe query", async () => {
    const app = await createServer();
    try {
      const res = await postGraphql(app, `
        query HealthcheckGraphql {
          _empty
        }
      `);

      expect(res.statusCode).toBe(200);
      expect(res.json().errors).toBeUndefined();
      expect(res.json().data).toEqual({ _empty: null });
    } finally {
      await app.close();
    }
  });
});
