const REQUIRED_EXPORT_VALIDATION_KEYS = [
  "reportsChecked",
  "transactionsReconciled",
  "settingsReviewed",
];

// Required items are named in the export status message instead of being
// appended to each label, so the existing concise accessible labels stay stable.
export const REQUIRED_EXPORT_CHECKLIST_KEYS = [];

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
    // The resolver remains the canonical guard when no run has been loaded yet.
    canDownload: !latestRun || (latestIsPlanned && savedMissingKeys.length === 0),
  };
}
