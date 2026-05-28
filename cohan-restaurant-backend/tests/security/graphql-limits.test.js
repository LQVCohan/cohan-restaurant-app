import { describe, expect, it } from "vitest";
import { buildSchema, parse, validate } from "graphql";
import { validateEnv } from "../../src/config/env.js";
import {
  DEFAULT_GRAPHQL_MAX_DEPTH,
  DEFAULT_GRAPHQL_MAX_FIELD_COUNT,
  createGraphqlValidationRules,
  getGraphqlLimitsFromEnv,
} from "../../src/security/graphqlLimits.js";

const schema = buildSchema(`
  type Query {
    root: Node
  }

  type Node {
    id: ID
    name: String
    child: Node
  }
`);

function validateWithLimits(source, env = {}) {
  return validate(schema, parse(source), createGraphqlValidationRules(env));
}

function errorCodes(errors) {
  return errors.map((error) => error.extensions?.code);
}

describe("GraphQL limit validation rules", () => {
  it("allows a shallow query within the depth limit", () => {
    const errors = validateWithLimits(`
      query Shallow {
        root {
          id
          name
        }
      }
    `, { GRAPHQL_MAX_DEPTH: "2", GRAPHQL_MAX_FIELD_COUNT: "10" });

    expect(errors).toEqual([]);
  });

  it("rejects a deeply nested query over the depth limit", () => {
    const errors = validateWithLimits(`
      query TooDeep {
        root {
          child {
            child {
              id
            }
          }
        }
      }
    `, { GRAPHQL_MAX_DEPTH: "3", GRAPHQL_MAX_FIELD_COUNT: "20" });

    expect(errorCodes(errors)).toContain("GRAPHQL_DEPTH_LIMIT_EXCEEDED");
  });

  it("counts fragment selection sets toward the depth limit", () => {
    const errors = validateWithLimits(`
      query FragmentDepth {
        root {
          ...NodeFields
        }
      }

      fragment NodeFields on Node {
        child {
          child {
            id
          }
        }
      }
    `, { GRAPHQL_MAX_DEPTH: "4", GRAPHQL_MAX_FIELD_COUNT: "20" });

    expect(errorCodes(errors)).toContain("GRAPHQL_DEPTH_LIMIT_EXCEEDED");
  });

  it("rejects a query with too many selected fields", () => {
    const errors = validateWithLimits(`
      query TooManyFields {
        root {
          id
          name
          first: id
          second: name
          third: id
        }
      }
    `, { GRAPHQL_MAX_DEPTH: "3", GRAPHQL_MAX_FIELD_COUNT: "5" });

    expect(errorCodes(errors)).toContain("GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED");
  });

  it("returns safe defaults for missing or invalid env values", () => {
    expect(getGraphqlLimitsFromEnv({})).toEqual({
      maxDepth: DEFAULT_GRAPHQL_MAX_DEPTH,
      maxFieldCount: DEFAULT_GRAPHQL_MAX_FIELD_COUNT,
    });
    expect(getGraphqlLimitsFromEnv({ GRAPHQL_MAX_DEPTH: "abc", GRAPHQL_MAX_FIELD_COUNT: "0" })).toEqual({
      maxDepth: DEFAULT_GRAPHQL_MAX_DEPTH,
      maxFieldCount: DEFAULT_GRAPHQL_MAX_FIELD_COUNT,
    });
  });

  it("clamps unsafe huge production values unless explicitly allowed", () => {
    expect(getGraphqlLimitsFromEnv({
      NODE_ENV: "production",
      GRAPHQL_MAX_DEPTH: "100",
      GRAPHQL_MAX_FIELD_COUNT: "10000",
    })).toEqual({ maxDepth: 25, maxFieldCount: 2000 });

    expect(getGraphqlLimitsFromEnv({
      NODE_ENV: "production",
      ALLOW_UNSAFE_GRAPHQL_LIMITS: "true",
      GRAPHQL_MAX_DEPTH: "100",
      GRAPHQL_MAX_FIELD_COUNT: "10000",
    })).toEqual({ maxDepth: 100, maxFieldCount: 10000 });
  });

  it("rejects unsafe production GraphQL limit env values during env validation", () => {
    const originalEnv = process.env;
    process.env = {
      NODE_ENV: "production",
      MONGO_URI: "mongodb://127.0.0.1:27017/test",
      JWT_SECRET: "a-strong-production-jwt-secret-32-chars",
      TABLE_ACCESS_TOKEN_SECRET: "different-table-secret-32-chars",
      GRAPHQL_MAX_DEPTH: "100",
      GRAPHQL_MAX_FIELD_COUNT: "10000",
      ENABLE_RECAPTCHA: "false",
      ALLOW_DISABLE_RECAPTCHA_IN_PRODUCTION: "true",
    };

    try {
      expect(() => validateEnv()).toThrow(/GRAPHQL_MAX_DEPTH.*GRAPHQL_MAX_FIELD_COUNT/s);
    } finally {
      process.env = originalEnv;
    }
  });
});
