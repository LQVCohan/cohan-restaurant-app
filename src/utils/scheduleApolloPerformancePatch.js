const SCHEDULE_QUERY_NAMES = new Set([
  "Me",
  "AllRestaurants",
  "ScopedRestaurants",
  "StaffList",
  "ScheduleAvailabilityWindows",
  "ScheduleAvailabilitySubmissions",
]);

let activeCleanup = null;

const getOperationName = (query) => {
  const definition = query?.definitions?.find(
    (item) => item?.kind === "OperationDefinition",
  );
  return definition?.name?.value || "";
};

const shouldOptimizeScheduleQuery = (options = {}) => {
  const operationName = getOperationName(options.query);
  return SCHEDULE_QUERY_NAMES.has(operationName);
};

const withSchedulePerformanceOptions = (options = {}) => {
  if (!shouldOptimizeScheduleQuery(options)) return options;

  const fetchPolicy = String(options.fetchPolicy || "");
  const shouldRewriteFetchPolicy =
    !fetchPolicy || fetchPolicy === "network-only" || fetchPolicy === "no-cache";

  return {
    ...options,
    fetchPolicy: shouldRewriteFetchPolicy ? "cache-and-network" : options.fetchPolicy,
    nextFetchPolicy: options.nextFetchPolicy || "cache-first",
    initialFetchPolicy: shouldRewriteFetchPolicy
      ? "cache-and-network"
      : options.initialFetchPolicy,
    returnPartialData: options.returnPartialData ?? true,
    notifyOnNetworkStatusChange: options.notifyOnNetworkStatusChange ?? true,
    errorPolicy: options.errorPolicy || "all",
  };
};

export const installScheduleApolloPerformancePatch = (client) => {
  if (!client || typeof client.watchQuery !== "function") return undefined;

  activeCleanup?.();

  const originalWatchQuery = client.watchQuery.bind(client);
  const originalQuery = typeof client.query === "function" ? client.query.bind(client) : null;

  client.watchQuery = (options = {}) =>
    originalWatchQuery(withSchedulePerformanceOptions(options));

  if (originalQuery) {
    client.query = (options = {}) =>
      originalQuery(withSchedulePerformanceOptions(options));
  }

  const cleanup = () => {
    if (client.watchQuery !== originalWatchQuery) {
      client.watchQuery = originalWatchQuery;
    }
    if (originalQuery && client.query !== originalQuery) {
      client.query = originalQuery;
    }
    if (activeCleanup === cleanup) {
      activeCleanup = null;
    }
  };

  activeCleanup = cleanup;
  return cleanup;
};
