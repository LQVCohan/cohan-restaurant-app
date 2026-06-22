import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_PREFIX = "cohan.modalDraft.v1";
const TAB_ID_KEY = "cohan.modalDraft.tabId";
const SESSION_FLAG_KEY = "cohan.modalDraft.sessionActive";
const STALE_TTL_MS = 1000 * 60 * 60 * 24;

const safeNow = () => Date.now();

const randomId = () =>
  `${Math.random().toString(36).slice(2, 10)}-${safeNow().toString(36)}`;

const getTabId = () => {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem(TAB_ID_KEY);
  if (existing) return existing;
  const next = randomId();
  window.sessionStorage.setItem(TAB_ID_KEY, next);
  window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  return next;
};

const normalizePart = (value, fallback = "na") => {
  const s = String(value ?? "").trim();
  if (!s) return fallback;
  return encodeURIComponent(s.toLowerCase());
};

const normalizeRecordId = (value) => {
  if (value === null || value === undefined || value === "") return "none";
  return normalizePart(String(value));
};

const cleanupStaleDrafts = (currentTabId) => {
  if (typeof window === "undefined") return;
  const now = safeNow();
  Object.keys(window.localStorage).forEach((key) => {
    if (!key.startsWith(`${STORAGE_PREFIX}:`)) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        window.localStorage.removeItem(key);
        return;
      }
      const parsed = JSON.parse(raw);
      const updatedAt = Number(parsed?.updatedAt || 0);
      const isStale = !updatedAt || now - updatedAt > STALE_TTL_MS;
      const tabMismatch = parsed?.tabId && parsed.tabId !== currentTabId;
      if (isStale || tabMismatch) {
        window.localStorage.removeItem(key);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  });
};

const readDraftRecord = (storageKey) => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default function useModalDraft({
  enabled,
  draftIdentity,
  formValue,
  isDirty,
  sanitize,
  onRestore,
  onDiscard,
  canRestoreDraft,
  notify,
  debounceMs = 500,
}) {
  const tabIdRef = useRef(getTabId());
  const timerRef = useRef(null);
  const restoredRef = useRef(false);
  const [didRestore, setDidRestore] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);

  const storageKey = useMemo(() => {
    const identity = draftIdentity || {};
    const route =
      identity.route ||
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "na");

    return [
      STORAGE_PREFIX,
      normalizePart(identity.module, "unknown-module"),
      normalizePart(identity.modal, "unknown-modal"),
      normalizePart(route),
      normalizePart(identity.mode, "default"),
      normalizePart(identity.entityType, "entity"),
      normalizeRecordId(identity.recordId),
      normalizePart(identity.context, "default"),
      normalizePart(identity.schemaVersion || "1"),
    ].join(":");
  }, [draftIdentity]);

  const getSanitizedData = useCallback(() => {
    const resolvedFormValue =
      typeof formValue === "function" ? formValue() : formValue;
    const safeValue =
      typeof sanitize === "function"
        ? sanitize(resolvedFormValue)
        : resolvedFormValue;
    return safeValue && typeof safeValue === "object" ? safeValue : null;
  }, [formValue, sanitize]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const saveDraftNow = useCallback(() => {
    if (typeof window === "undefined" || !enabled) return false;
    const safeData = getSanitizedData();
    if (!safeData) return false;
    const payload = {
      version: 1,
      tabId: tabIdRef.current,
      updatedAt: safeNow(),
      data: safeData,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    return true;
  }, [enabled, getSanitizedData, storageKey]);

  const queueSave = useCallback(() => {
    if (!enabled || !isDirty) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      saveDraftNow();
      timerRef.current = null;
    }, debounceMs);
  }, [debounceMs, enabled, isDirty, saveDraftNow]);

  const requestCloseWithDraft = useCallback(
    (onClose) => {
      if (enabled && isDirty) {
        const didSave = saveDraftNow();
        if (didSave) {
          notify?.("Đã lưu tạm dữ liệu nháp.", "info", 2200);
        }
      }
      onClose?.();
    },
    [enabled, isDirty, notify, saveDraftNow],
  );

  const detectRestoreDraft = useCallback(() => {
    if (!enabled || restoredRef.current) return;
    cleanupStaleDrafts(tabIdRef.current);
    const draft = readDraftRecord(storageKey);
    if (!draft?.data) return;
    if (draft.tabId !== tabIdRef.current) return;
    if (typeof canRestoreDraft === "function" && !canRestoreDraft(draft.data)) {
      clearDraft();
      return;
    }

    restoredRef.current = true;
    setPendingRestore(draft.data);
  }, [canRestoreDraft, clearDraft, enabled, storageKey]);

  useEffect(() => {
    if (!enabled) return;
    detectRestoreDraft();
  }, [detectRestoreDraft, enabled]);

  useEffect(() => {
    if (enabled) return;
    restoredRef.current = false;
    setDidRestore(false);
    setPendingRestore(null);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isDirty) return;
    queueSave();
  }, [enabled, formValue, isDirty, queueSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const restorePendingDraft = useCallback(() => {
    if (!pendingRestore) return false;
    onRestore?.(pendingRestore);
    setDidRestore(true);
    setPendingRestore(null);
    notify?.("Đã khôi phục dữ liệu nháp.", "success", 2600);
    return true;
  }, [notify, onRestore, pendingRestore]);

  const discardPendingDraft = useCallback(() => {
    if (!pendingRestore) return false;
    if (typeof onDiscard === "function") onDiscard(pendingRestore);
    clearDraft();
    setPendingRestore(null);
    return true;
  }, [clearDraft, onDiscard, pendingRestore]);

  return {
    storageKey,
    saveDraftNow,
    clearDraft,
    requestCloseWithDraft,
    didRestore,
    pendingRestore,
    restorePendingDraft,
    discardPendingDraft,
  };
}
