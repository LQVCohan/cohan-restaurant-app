import { useQuery } from "@apollo/client";
import { SEARCH } from "../components/search/query/search.queries.js";

export function useSearch(query, filter = {}, limit = 30, offset = 0) {
  const { data, loading, error, refetch } = useQuery(SEARCH, {
    variables: { query, filter, limit, offset },
    skip: !query || query.trim() === "",
    fetchPolicy: "network-only",
  });

  return {
    results: data?.search || null,
    loading,
    error,
    refetch,
  };
}
