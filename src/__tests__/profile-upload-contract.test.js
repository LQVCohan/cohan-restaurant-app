import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const requireFromBackend = createRequire(
  path.join(process.cwd(), "cohan-restaurant-backend", "package.json"),
);
const { makeExecutableSchema } = requireFromBackend("@graphql-tools/schema");

const buildSchema = async () => {
  const { default: typeDefs } = await import(
    "../../cohan-restaurant-backend/graphql/schema/index.js"
  );
  return makeExecutableSchema({ typeDefs });
};

describe("profile upload contracts", () => {
  it("keeps updateUser aligned with current-user callers and avatar updates", async () => {
    const schema = await buildSchema();
    const updateUser = schema.getType("Mutation").getFields().updateUser;
    const inputFields = schema.getType("UpdateUserInput").getFields();

    expect(updateUser.args.map((arg) => `${arg.name}:${arg.type}`)).toEqual([
      "input:UpdateUserInput!",
    ]);
    expect(inputFields).toHaveProperty("avatarUrl");
  });

  it("proxies root upload routes to the backend in development", () => {
    const viteConfig = readFileSync(path.join(process.cwd(), "vite.config.js"), "utf8");
    expect(viteConfig).toMatch(/["']\/upload["']\s*:/);
  });
});
