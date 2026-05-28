import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseJavaScript } from '@babel/parser';

const requireFromBackend = createRequire(
  path.join(process.cwd(), 'cohan-restaurant-backend', 'package.json'),
);

const {
  Kind,
  NoUnusedFragmentsRule,
  parse: parseGraphQL,
  specifiedRules,
  validate,
} = requireFromBackend('graphql');
const { makeExecutableSchema } = requireFromBackend('@graphql-tools/schema');
const { mergeTypeDefs } = requireFromBackend('@graphql-tools/merge');

const BACKEND_SCHEMA_DIR = path.join(
  process.cwd(),
  'cohan-restaurant-backend',
  'graphql',
  'schema',
);
const FRONTEND_SRC_DIR = path.join(process.cwd(), 'src');
const FRONTEND_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const VALIDATION_RULES = specifiedRules.filter((rule) => rule !== NoUnusedFragmentsRule);

function listFilesRecursive(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listFilesRecursive(absolutePath, predicate);
      }

      return predicate(absolutePath) ? [absolutePath] : [];
    })
    .sort();
}

function buildBackendSchema() {
  const schemaFiles = listFilesRecursive(
    BACKEND_SCHEMA_DIR,
    (filePath) => path.extname(filePath) === '.graphql',
  );
  const typeDefs = schemaFiles.map((filePath) => readFileSync(filePath, 'utf8'));

  return makeExecutableSchema({
    typeDefs: mergeTypeDefs(typeDefs),
    resolverValidationOptions: {
      requireResolversForResolveType: 'ignore',
    },
  });
}

function getGraphQLDefinitionNames(document) {
  return document.definitions
    .map((definition) => {
      if (
        definition.kind === Kind.OPERATION_DEFINITION ||
        definition.kind === Kind.FRAGMENT_DEFINITION
      ) {
        return definition.name?.value ?? `anonymous ${definition.operation}`;
      }

      return null;
    })
    .filter(Boolean);
}

function templateLiteralToGraphQLSource(templateLiteral) {
  return templateLiteral.quasis
    .map((quasi, index) => {
      const raw = quasi.value.raw;
      const interpolationPlaceholder = raw.trimEnd().endsWith('{') ? '\n__typename\n' : '\n';
      return index < templateLiteral.expressions.length
        ? `${raw}${interpolationPlaceholder}`
        : raw;
    })
    .join('');
}

function isGqlTag(tag) {
  if (tag.type === 'Identifier') {
    return tag.name === 'gql';
  }

  return tag.type === 'MemberExpression' && tag.property?.name === 'gql';
}

function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;

  visitor(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;

    if (Array.isArray(value)) {
      value.forEach((child) => visitAst(child, visitor));
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      visitAst(value, visitor);
    }
  }
}

function extractGraphQLDocumentsFromFile(filePath) {
  const sourceCode = readFileSync(filePath, 'utf8');
  if (!sourceCode.includes('gql`')) {
    return [];
  }

  const ast = parseJavaScript(sourceCode, {
    sourceType: 'unambiguous',
    plugins: ['jsx', 'typescript', 'classProperties', 'decorators-legacy'],
    errorRecovery: true,
  });
  const relativePath = path.relative(process.cwd(), filePath);
  const documents = [];

  visitAst(ast, (node) => {
    if (node.type !== 'TaggedTemplateExpression' || !isGqlTag(node.tag)) {
      return;
    }

    const source = templateLiteralToGraphQLSource(node.quasi).trim();
    if (!source) return;

    const document = parseGraphQL(source);
    documents.push({
      document,
      filePath: relativePath,
      line: node.loc?.start.line ?? 1,
      names: getGraphQLDefinitionNames(document),
      source,
    });
  });

  return documents;
}

function getFrontendGraphQLDocuments() {
  const sourceFiles = listFilesRecursive(FRONTEND_SRC_DIR, (filePath) =>
    FRONTEND_EXTENSIONS.has(path.extname(filePath)) && statSync(filePath).isFile(),
  );

  return sourceFiles.flatMap(extractGraphQLDocumentsFromFile);
}


function collectFragmentDefinitionNames(document) {
  return new Set(
    document.definitions
      .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
      .map((definition) => definition.name.value),
  );
}

function collectFragmentSpreads(node, names = new Set()) {
  if (!node || typeof node !== 'object') return names;

  if (node.kind === Kind.FRAGMENT_SPREAD) {
    names.add(node.name.value);
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    if (Array.isArray(value)) {
      value.forEach((child) => collectFragmentSpreads(child, names));
    } else if (value && typeof value === 'object') {
      collectFragmentSpreads(value, names);
    }
  }

  return names;
}

function getReferencedFragmentSources(documentUnderTest, fragmentByName) {
  const included = collectFragmentDefinitionNames(documentUnderTest.document);
  const pending = [...collectFragmentSpreads(documentUnderTest.document)];
  const sources = [];

  while (pending.length > 0) {
    const fragmentName = pending.pop();
    if (included.has(fragmentName)) continue;

    const fragmentDocument = fragmentByName.get(fragmentName);
    if (!fragmentDocument) continue;

    included.add(fragmentName);
    sources.push(fragmentDocument.source);
    collectFragmentSpreads(fragmentDocument.document).forEach((nestedFragmentName) => {
      if (!included.has(nestedFragmentName)) pending.push(nestedFragmentName);
    });
  }

  return sources;
}

function isFragmentOnly(document) {
  return document.definitions.every(
    (definition) => definition.kind === Kind.FRAGMENT_DEFINITION,
  );
}

function formatValidationError({ filePath, line, names }, errors) {
  const label = names.length > 0 ? names.join(', ') : 'anonymous document';
  const messages = errors.map((error) => `    - ${error.message}`).join('\n');

  return `  ${filePath}:${line} (${label})\n${messages}`;
}

describe('frontend GraphQL documents', () => {
  it('validate against the backend schema', () => {
    const schema = buildBackendSchema();
    const documents = getFrontendGraphQLDocuments();
    const fragmentDocuments = documents.filter(({ document }) => isFragmentOnly(document));
    const fragmentByName = new Map(
      fragmentDocuments.flatMap((fragmentDocument) =>
        [...collectFragmentDefinitionNames(fragmentDocument.document)].map((fragmentName) => [
          fragmentName,
          fragmentDocument,
        ]),
      ),
    );

    const failures = documents.flatMap((documentUnderTest) => {
      const companionFragments = getReferencedFragmentSources(
        documentUnderTest,
        fragmentByName,
      ).join('\n');
      const sourceWithFragments = [documentUnderTest.source, companionFragments]
        .filter(Boolean)
        .join('\n');
      const parsedDocument = parseGraphQL(sourceWithFragments);
      const errors = validate(schema, parsedDocument, VALIDATION_RULES);

      return errors.length > 0
        ? [formatValidationError(documentUnderTest, errors)]
        : [];
    });

    expect(
      failures,
      `Frontend GraphQL documents must match the backend schema.\n${failures.join('\n')}`,
    ).toEqual([]);
  });
});
