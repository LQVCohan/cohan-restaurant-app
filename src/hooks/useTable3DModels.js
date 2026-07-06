import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LOCAL_TABLE_3D_CATALOG,
  normalizeCatalogItem,
  TABLE_3D_PUBLIC_CATALOG_URL,
} from "@/config/table3dCatalog";

const REQUEST_TIMEOUT_MS = 5000;

export default function useTable3DModels() {
  const [models, setModels] = useState(LOCAL_TABLE_3D_CATALOG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const loadCatalog = useCallback(async () => {
    abortRef.current?.abort?.();

    if (!TABLE_3D_PUBLIC_CATALOG_URL) {
      abortRef.current = null;
      setModels(LOCAL_TABLE_3D_CATALOG);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(TABLE_3D_PUBLIC_CATALOG_URL, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.status}`);
      }
      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data
            .map(normalizeCatalogItem)
            .filter((item) => item.key && item.tableType)
        : [];

      if (!normalized.length) {
        throw new Error("Catalog is empty");
      }

      const mergedCatalog = new Map(
        LOCAL_TABLE_3D_CATALOG.map((item) => [item.key, item]),
      );
      normalized.forEach((item) => mergedCatalog.set(item.key, item));

      setModels(Array.from(mergedCatalog.values()));
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError("Không tải được catalog online, đã dùng catalog dự phòng.");
        setModels(LOCAL_TABLE_3D_CATALOG);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    return () => abortRef.current?.abort?.();
  }, [loadCatalog]);

  const modelsByType = useMemo(() => {
    return models.reduce((acc, model) => {
      if (!acc[model.tableType]) acc[model.tableType] = [];
      acc[model.tableType].push(model);
      return acc;
    }, {});
  }, [models]);

  return {
    models,
    modelsByType,
    loading,
    error,
    reload: loadCatalog,
  };
}
