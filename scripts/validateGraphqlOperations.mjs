import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseJs } from "@babel/parser";
import {
  buildASTSchema,
  parse as parseGraphql,
  specifiedRules,
  validate,
} from "graphql";
import typeDefs from "../cohan-restaurant-backend/graphql/schema/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sourceRoots = [path.join(repoRoot, "src")];
const extensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const ignoredDirs = new Set(["node_modules", "dist", "build", "coverage", ".git"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, out);
    else if (extensions.has(path.extname(entry.name))) out.push(fullPath);
  }
  return out;
}

function visit(node, cb) {
  if (!node || typeof node !== "object") return;
  cb(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, cb);
    } else if (value && typeof value === "object" && value.type) {
      visit(value, cb);
    }
  }
}

function isGqlTag(node) {
  const callee = node?.callee;
  return callee?.type === "Identifier" && callee.name === "gql";
}

function extractGqlDocuments(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  let ast;
  try {
    ast = parseJs(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript", "decorators-legacy", "classProperties", "importMeta"],
      errorRecovery: true,
    });
  } catch (error) {
    return [{ filePath, parseError: `JS_PARSE_ERROR: ${error.message}` }];
  }

  const docs = [];
  visit(ast, (node) => {
    if (node.type !== "TaggedTemplateExpression" || !isGqlTag(node)) return;
    const quasi = node.quasi;
    const hasDynamicPart = (quasi?.expressions || []).length > 0;
    const text = (quasi?.quasis || []).map((part) => part.value.cooked || part.value.raw || "").join("\n");
    docs.push({
      filePath,
      loc: node.loc?.start || null,
      text,
      hasDynamicPart,
    });
  });
  return docs;
}

let schema;
try {
  schema = buildASTSchema(typeDefs);
} catch (error) {
  console.error("SCHEMA_INVALID");
  console.error(error.message);
  process.exit(1);
}

const errors = [];
const skipped = [];
const files = sourceRoots.flatMap((root) => walk(root));
let checkedCount = 0;

for (const filePath of files) {
  for (const doc of extractGqlDocuments(filePath)) {
    const relPath = path.relative(repoRoot, doc.filePath).replaceAll(path.sep, "/");
    const where = `${relPath}${doc.loc ? `:${doc.loc.line}:${doc.loc.column + 1}` : ""}`;

    if (doc.parseError) {
      errors.push(`${where} ${doc.parseError}`);
      continue;
    }
    if (!doc.text.trim()) continue;
    if (doc.hasDynamicPart) {
      skipped.push(`${where} dynamic gql template`);
      continue;
    }

    let documentNode;
    try {
      documentNode = parseGraphql(doc.text);
    } catch (error) {
      errors.push(`${where} GRAPHQL_PARSE_ERROR: ${error.message.replaceAll("\n", " ")}`);
      continue;
    }

    const result = validate(schema, documentNode, specifiedRules);
    checkedCount += 1;
    for (const error of result) {
      errors.push(`${where} ${error.message}`);
    }
  }
}

if (skipped.length) {
  console.warn("SKIPPED_DYNAMIC_GQL");
  for (const item of skipped) console.warn(`- ${item}`);
}

if (errors.length) {
  console.error("GRAPHQL_OPERATION_ERRORS");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: validated ${checkedCount} frontend GraphQL operation(s).`);
