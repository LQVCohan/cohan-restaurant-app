import { SEARCH_SUGGESTIONS } from "../components/search/query/search.queries.js";
import { useLazyQuery } from "@apollo/client";
import { useCallback } from "react";

export function useSearchSuggestions() {
  const [fetchSuggestions, { data, loading, error }] = useLazyQuery(
    SEARCH_SUGGESTIONS,
    {
      fetchPolicy: "network-only",
    },
  );

  const run = useCallback(
    (query, limitPerType = 5) => {
      if (!query || query.trim().length < 2) return;
      fetchSuggestions({ variables: { query, limitPerType } });
    },
    [fetchSuggestions],
  );

  const cancel = useCallback(() => {}, []);

  return {
    run,
    cancel,
    suggestions: data?.searchSuggestions || null,
    loading,
    error,
  };
}
