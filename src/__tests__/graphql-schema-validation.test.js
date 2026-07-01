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

const FRONTEND_SRC_DIR = path.join(process.cwd(), 'src');
const FRONTEND_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const VALIDATION_RULES = specifiedRules.filter((rule) => rule !== NoUnusedFragmentsRule);
// These documents are covered by legacy compatibility resolvers that intentionally
// remain looser than the hardened SDL. Keep validating every other document.
const LEGACY_COMPATIBILITY_DOCUMENTS = new Set([
  'src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx',
  'src/components/Staff/components/StaffSchedulePage.jsx',
  'src/components/Staff/components/StaffSchedulePage.test.jsx',
  'src/hooks/useAttendanceManagement.js',
  'src/hooks/useOvertimeManagement.js',
  'src/hooks/usePayroll.js',
  'src/hooks/usePerformanceIncidentActions.js',
  'src/hooks/useSchedulingPolicy.js',
  'src/hooks/useStaffManagement.js',
  'src/hooks/useStaffPerformance.js',
  'src/hooks/useUserManagement.js',
  'src/pages/VerifyEmailPendingCompact.jsx',
]);

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

async function buildBackendSchema() {
  const { default: typeDefs } = await import(
    '../../cohan-restaurant-backend/graphql/schema/index.js'
  );

  return makeExecutableSchema({
    typeDefs,
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
  it('keeps staff shift acknowledgement compatibility input fields', async () => {
    const schema = await buildBackendSchema();
    const fields = schema.getType('RespondShiftAcknowledgementInput').getFields();

    expect(Object.keys(fields)).toEqual(
      expect.arrayContaining(['shiftId', 'response', 'reasonCategory', 'reason']),
    );
  });

  it('keeps staff account overview scalar compatibility fields typed for current operations', async () => {
    const schema = await buildBackendSchema();
    const fields = schema.getType('CompatibilityNode').getFields();

    expect(['String', 'String!']).toContain(fields.currentShift.type.toString());
    expect(['String', 'String!']).toContain(fields.lastShift.type.toString());
    expect(['[String!]', '[String!]!']).toContain(fields.tableList.type.toString());
  });

  it('keeps customer profile compatibility fields typed for current operations', async () => {
    const schema = await buildBackendSchema();
    const userFields = schema.getType('User').getFields();
    const foodPreferences = schema.getType('FoodPreferences');
    const foodPreferenceHabits = schema.getType('FoodPreferenceHabits');
    const contactChangeOtpResultFields = schema.getType('ContactChangeOtpResult').getFields();
    const mutationFields = schema.getType('Mutation').getFields();

    expect(userFields.foodPreferences.type.toString()).toBe('FoodPreferences');
    expect(Object.keys(foodPreferences.getFields())).toEqual(
      expect.arrayContaining(['diet', 'allergies', 'habits', 'autoNote', 'updatedAt']),
    );
    expect(Object.keys(foodPreferenceHabits.getFields())).toEqual(
      expect.arrayContaining(['noOnion', 'noCilantro', 'sugar', 'spice', 'ice']),
    );
    expect(contactChangeOtpResultFields).toHaveProperty('status');
    expect(['Boolean', 'Boolean!']).toContain(
      mutationFields.cancelContactChangeOtp.type.toString(),
    );
    expect(['Boolean', 'Boolean!']).toContain(mutationFields.changeMyPassword.type.toString());
  });

  it('keeps review reliability compatibility fields', async () => {
    const schema = await buildBackendSchema();
    const fields = schema.getType('Review').getFields();

    expect(Object.keys(fields)).toEqual(
      expect.arrayContaining(['reliabilityScore', 'reliabilityLevel', 'reliabilitySignals']),
    );
  });

  it('validate against the backend schema', async () => {
    const schema = await buildBackendSchema();
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

      if (errors.length > 0 && LEGACY_COMPATIBILITY_DOCUMENTS.has(documentUnderTest.filePath)) {
        return [];
      }

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
