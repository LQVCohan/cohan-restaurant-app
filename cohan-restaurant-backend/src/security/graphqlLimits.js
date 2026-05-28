import { GraphQLError, Kind } from "graphql";

export const DEFAULT_GRAPHQL_MAX_DEPTH = 12;
export const DEFAULT_GRAPHQL_MAX_FIELD_COUNT = 500;

const MAX_SAFE_PRODUCTION_DEPTH = 25;
const MAX_SAFE_PRODUCTION_FIELD_COUNT = 2000;

function parsePositiveInteger(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

export function getGraphqlLimitsFromEnv(env = process.env) {
  const allowUnsafe = String(env.ALLOW_UNSAFE_GRAPHQL_LIMITS || "false").toLowerCase() === "true";
  const inProduction = String(env.NODE_ENV || "development").toLowerCase() === "production";
  let maxDepth = parsePositiveInteger(env.GRAPHQL_MAX_DEPTH, DEFAULT_GRAPHQL_MAX_DEPTH);
  let maxFieldCount = parsePositiveInteger(env.GRAPHQL_MAX_FIELD_COUNT, DEFAULT_GRAPHQL_MAX_FIELD_COUNT);

  if (inProduction && !allowUnsafe) {
    maxDepth = Math.min(maxDepth, MAX_SAFE_PRODUCTION_DEPTH);
    maxFieldCount = Math.min(maxFieldCount, MAX_SAFE_PRODUCTION_FIELD_COUNT);
  }

  return { maxDepth, maxFieldCount };
}

function createLimitError(message, code, nodes) {
  return new GraphQLError(message, {
    nodes,
    extensions: { code },
  });
}

function selectionDepth(selectionSet, context, depth, visitedFragments) {
  if (!selectionSet) return depth - 1;

  let maxDepth = depth;
  for (const selection of selectionSet.selections || []) {
    if (selection.kind === Kind.FIELD) {
      const childDepth = selection.selectionSet
        ? selectionDepth(selection.selectionSet, context, depth + 1, visitedFragments)
        : depth;
      maxDepth = Math.max(maxDepth, childDepth);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      maxDepth = Math.max(maxDepth, selectionDepth(selection.selectionSet, context, depth + 1, visitedFragments));
      continue;
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value;
      if (visitedFragments.has(fragmentName)) continue;
      const fragment = context.getFragment(fragmentName);
      if (!fragment) continue;
      const nextVisited = new Set(visitedFragments);
      nextVisited.add(fragmentName);
      maxDepth = Math.max(maxDepth, selectionDepth(fragment.selectionSet, context, depth + 1, nextVisited));
    }
  }

  return maxDepth;
}

function countSelectedFields(selectionSet, context, visitedFragments) {
  if (!selectionSet) return 0;

  let count = 0;
  for (const selection of selectionSet.selections || []) {
    if (selection.kind === Kind.FIELD) {
      count += 1;
      count += countSelectedFields(selection.selectionSet, context, visitedFragments);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      count += countSelectedFields(selection.selectionSet, context, visitedFragments);
      continue;
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value;
      if (visitedFragments.has(fragmentName)) continue;
      const fragment = context.getFragment(fragmentName);
      if (!fragment) continue;
      const nextVisited = new Set(visitedFragments);
      nextVisited.add(fragmentName);
      count += countSelectedFields(fragment.selectionSet, context, nextVisited);
    }
  }

  return count;
}

export function createGraphqlDepthLimitRule(maxDepth) {
  const effectiveMaxDepth = parsePositiveInteger(maxDepth, DEFAULT_GRAPHQL_MAX_DEPTH);

  return function graphqlDepthLimitRule(context) {
    return {
      OperationDefinition(node) {
        const depth = selectionDepth(node.selectionSet, context, 1, new Set());
        if (depth > effectiveMaxDepth) {
          context.reportError(createLimitError(
            `GraphQL query depth ${depth} exceeds maximum depth ${effectiveMaxDepth}.`,
            "GRAPHQL_DEPTH_LIMIT_EXCEEDED",
            [node],
          ));
        }
      },
    };
  };
}

export function createGraphqlFieldCountLimitRule(maxFieldCount) {
  const effectiveMaxFieldCount = parsePositiveInteger(maxFieldCount, DEFAULT_GRAPHQL_MAX_FIELD_COUNT);

  return function graphqlFieldCountLimitRule(context) {
    return {
      OperationDefinition(node) {
        const fieldCount = countSelectedFields(node.selectionSet, context, new Set());
        if (fieldCount > effectiveMaxFieldCount) {
          context.reportError(createLimitError(
            `GraphQL query field count ${fieldCount} exceeds maximum field count ${effectiveMaxFieldCount}.`,
            "GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED",
            [node],
          ));
        }
      },
    };
  };
}

export function createGraphqlValidationRules(env = process.env) {
  const { maxDepth, maxFieldCount } = getGraphqlLimitsFromEnv(env);
  return [
    createGraphqlDepthLimitRule(maxDepth),
    createGraphqlFieldCountLimitRule(maxFieldCount),
  ];
}
