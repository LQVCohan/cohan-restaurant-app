import { SEARCH_SUGGESTIONS } from "../components/search/query/search.queries.js";
// src/hooks/useSearchSuggestions.js
import { useLazyQuery } from "@apollo/client";
import { useRef } from "react";

export function useSearchSuggestions() {
  const abortRef = useRef(null);

  const [fetchSuggestions, { data, loading, error }] = useLazyQuery(
    SEARCH_SUGGESTIONS,
    {
      fetchPolicy: "network-only",
    }
  );

  const run = (query, limitPerType = 5) => {
    if (!query || query.trim().length < 2) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    fetchSuggestions({
      variables: { query, limitPerType },
      context: {
        fetchOptions: {
          signal: controller.signal,
        },
      },
    });
  };

  const cancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  return {
    run,
    cancel,
    suggestions: data?.searchSuggestions || null,
    loading,
    error,
  };
}
