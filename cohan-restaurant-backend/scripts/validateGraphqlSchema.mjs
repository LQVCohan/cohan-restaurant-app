import { buildASTSchema, isObjectType, isInterfaceType } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "../graphql/schema/index.js";
import resolvers from "../graphql/resolvers/index.js";

const ignoredTypeResolvers = new Set([
  "DateTime",
  "JSON",
  "JSONObject",
  "Upload",
]);

function listFields(type) {
  if (!type || (!isObjectType(type) && !isInterfaceType(type))) return new Set();
  return new Set(Object.keys(type.getFields()));
}

function resolverFieldNames(resolverMap) {
  return Object.keys(resolverMap || {}).filter((key) => !key.startsWith("__"));
}

let schema;
try {
  schema = buildASTSchema(typeDefs);
} catch (error) {
  console.error("SDL_INVALID");
  console.error(error.message);
  process.exit(1);
}

const typeMap = schema.getTypeMap();
const errors = [];

for (const [typeName, resolverMap] of Object.entries(resolvers || {})) {
  if (ignoredTypeResolvers.has(typeName) || typeName.startsWith("__")) continue;
  if (!resolverMap || typeof resolverMap !== "object") continue;

  const schemaType = typeMap[typeName];
  if (!schemaType) {
    errors.push(`Resolver type missing in schema: ${typeName}`);
    continue;
  }

  const schemaFields = listFields(schemaType);
  if (!schemaFields.size) continue;

  for (const fieldName of resolverFieldNames(resolverMap)) {
    if (!schemaFields.has(fieldName)) {
      errors.push(`${typeName}.${fieldName} defined in resolvers, but not in schema`);
    }
  }
}

if (errors.length) {
  console.error("RESOLVER_SCHEMA_MISMATCH");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

try {
  makeExecutableSchema({ typeDefs, resolvers });
} catch (error) {
  console.error("EXECUTABLE_SCHEMA_INVALID");
  console.error(error.message);
  process.exit(1);
}

console.log("OK: GraphQL schema/resolvers match.");
