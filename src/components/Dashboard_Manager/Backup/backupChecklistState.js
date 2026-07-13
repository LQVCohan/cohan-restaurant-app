const REQUIRED_EXPORT_VALIDATION_KEYS = [
  "reportsChecked",
  "transactionsReconciled",
  "settingsReviewed",
];

// These are the only user-confirmed checks required before creating a file.
// The remaining checklist items are completed after export or by the server.
export const REQUIRED_EXPORT_CHECKLIST_KEYS = [
  ...REQUIRED_EXPORT_VALIDATION_KEYS,
];

export function selectBackupRuns({ runs = [], selectedRunId = "", currentLastRun = null }) {
  const latestRun = runs[0] || currentLastRun || null;
  if (!selectedRunId) return { latestRun, selectedRun: latestRun };

  const selectedRun = runs.find((run) => run.id === selectedRunId)
    || (currentLastRun?.id === selectedRunId ? currentLastRun : null);

  return { latestRun, selectedRun };
}

export function getExportReadinessState({ latestRun, selectedRun, runDraft }) {
  const savedChecklist = latestRun?.checklist || {};
  const draftChecklist = runDraft?.checklist || {};
  const savedMissingKeys = REQUIRED_EXPORT_VALIDATION_KEYS.filter((key) => !savedChecklist[key]);
  const draftMissingKeys = REQUIRED_EXPORT_VALIDATION_KEYS.filter((key) => !draftChecklist[key]);
  const viewingHistory = Boolean(
    latestRun?.id && selectedRun?.id && selectedRun.id !== latestRun.id,
  );
  const latestIsPlanned = latestRun?.status === "planned";

  return {
    savedMissingKeys,
    draftMissingKeys,
    viewingHistory,
    draftCompleteButUnsaved: latestIsPlanned
      && !viewingHistory
      && savedMissingKeys.length > 0
      && draftMissingKeys.length === 0,
    // The download button must match the backend guard: an active preparation
    // run must exist and its three pre-export checks must already be saved.
    canDownload: Boolean(
      latestRun
        && latestIsPlanned
        && savedMissingKeys.length === 0,
    ),
  };
}
