import { describe, expect, it } from "vitest";
import {
  getExportReadinessState,
  selectBackupRuns,
} from "./backupChecklistState";

const emptyChecklist = {
  reportsChecked: false,
  transactionsReconciled: false,
  settingsReviewed: false,
};

const completeChecklist = {
  reportsChecked: true,
  transactionsReconciled: true,
  settingsReviewed: true,
};

describe("backup checklist state", () => {
  it("does not fall back to an older run while a newly created run is refetching", () => {
    const oldRun = { id: "old", status: "checklist_completed", checklist: completeChecklist };
    const result = selectBackupRuns({
      runs: [oldRun],
      selectedRunId: "new-run-not-returned-yet",
      currentLastRun: oldRun,
    });

    expect(result.latestRun).toBe(oldRun);
    expect(result.selectedRun).toBeNull();
  });

  it("distinguishes checked-but-unsaved items from saved readiness", () => {
    const latestRun = { id: "latest", status: "planned", checklist: emptyChecklist };
    const state = getExportReadinessState({
      latestRun,
      selectedRun: latestRun,
      runDraft: { checklist: completeChecklist },
    });

    expect(state.draftCompleteButUnsaved).toBe(true);
    expect(state.canDownload).toBe(false);
    expect(state.savedMissingKeys).toHaveLength(3);
  });

  it("marks an explicitly selected older run as history", () => {
    const latestRun = { id: "latest", status: "planned", checklist: emptyChecklist };
    const historicalRun = { id: "old", status: "checklist_completed", checklist: completeChecklist };
    const state = getExportReadinessState({
      latestRun,
      selectedRun: historicalRun,
      runDraft: { checklist: completeChecklist },
    });

    expect(state.viewingHistory).toBe(true);
    expect(state.canDownload).toBe(false);
  });

  it("allows download only when the latest planned run has the required saved checks", () => {
    const latestRun = { id: "latest", status: "planned", checklist: completeChecklist };
    const state = getExportReadinessState({
      latestRun,
      selectedRun: latestRun,
      runDraft: { checklist: completeChecklist },
    });

    expect(state.canDownload).toBe(true);
    expect(state.savedMissingKeys).toEqual([]);
  });
});
