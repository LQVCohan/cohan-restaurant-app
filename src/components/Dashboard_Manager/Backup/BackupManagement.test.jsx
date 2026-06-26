import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BackupManagement from "./BackupManagement";
import { AuthContext } from "../../../context/AuthContext";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const useLazyQueryMock = vi.fn();
const previewExport = vi.fn();
const exportBackup = vi.fn();
const previewImport = vi.fn();
const importBackup = vi.fn();
const createBackupRun = vi.fn();
const updateBackupRun = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
  useLazyQuery: (...args) => useLazyQueryMock(...args),
}));

vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ title, subtitle, customControls }) => <header><h1>{title}</h1><p>{subtitle}</p>{customControls}</header>,
}));

const restaurants = [{ id: "r1", name: "Nhà hàng 1" }, { id: "r2", name: "Nhà hàng 2" }];
const renderPage = () => render(<AuthContext.Provider value={{ restaurants }}><BackupManagement /></AuthContext.Provider>);

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockImplementation((query) => {
    const text = String(query);
    if (text.includes("backupRuns")) return { data: { backupRuns: [] }, loading: false, error: null, refetch: vi.fn() };
    return {
      data: {
        backupReadiness: {
          ready: false,
          risks: [],
          checklist: { reportsChecked: false, transactionsReconciled: false, settingsReviewed: false, exportPrepared: false, safeCopyStored: false, operatorRecorded: false },
          scope: { ordersAndPayments: true, tablesAndFloorPlan: true, menuAndPricing: true, inventory: true, staffAndPermissions: true, schedules: true, customersAndPromotions: true, reportsAndReconciliation: true },
          lastRun: null,
        },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    };
  });
  previewExport.mockResolvedValue({ data: { restaurantConfigBackupPreview: { restaurantId: "r1", fileName: "backup.json", schemaVersion: 1, createdAt: "2026-06-02T00:00:00.000Z", warnings: ["preview warning"], counts: [{ key: "systemSettings", label: "Cấu hình hệ thống", count: 1, enabled: true }] } } });
  exportBackup.mockResolvedValue({ data: { exportRestaurantConfigBackup: { fileName: "backup.json", mimeType: "application/json", encoding: "base64", contentBase64: window.btoa('{"kind":"cohan.restaurant_config_snapshot"}'), checksum: "sha256:abc", sizeBytes: 42, createdAt: "2026-06-02T00:00:00.000Z" } } });
  previewImport.mockResolvedValue({ data: { previewRestaurantConfigImport: { valid: true, schemaVersion: 1, sourceRestaurantName: "Nguồn", targetRestaurantId: "r2", mode: "clone", warnings: ["preview ok"], errors: [], changes: [{ section: "systemSettings", action: "create", label: "Cấu hình hệ thống", count: 1 }], conflictSummary: [], conflicts: [] } } });
  importBackup.mockResolvedValue({ data: { importRestaurantConfigBackup: { success: true, dryRun: false, targetRestaurantId: "r2", mode: "clone", warnings: ["Skipped recipe ingredient line because ingredient was not imported or could not be remapped."], errors: [], changes: [], conflicts: [], appliedResolutions: [], backupRun: { id: "br1", status: "checklist_completed", note: "Imported", createdAt: "2026-06-02T00:00:00.000Z", completedAt: "2026-06-02T00:00:00.000Z" } } } });
  createBackupRun.mockResolvedValue({ data: { createBackupRun: { id: "br-new", restaurantId: "r1", status: "planned", checklist: {}, scope: {}, note: "" } } });
  updateBackupRun.mockResolvedValue({ data: { updateBackupRun: { id: "br1", restaurantId: "r1", status: "checklist_completed", checklist: {}, scope: {}, note: "" } } });
  useLazyQueryMock.mockImplementation((query, options = {}) => [async (variables) => {
    try {
      return await previewExport(variables);
    } catch (error) {
      options.onError?.(error);
      return {};
    }
  }, { loading: false }]);
  useMutationMock.mockImplementation((mutation) => {
    const text = String(mutation);
    if (text.includes("createBackupRun")) return [createBackupRun, { loading: false }];
    if (text.includes("updateBackupRun")) return [updateBackupRun, { loading: false }];
    if (text.includes("exportRestaurantConfigBackup")) return [exportBackup, { loading: false }];
    if (text.includes("previewRestaurantConfigImport")) return [previewImport, { loading: false }];
    if (text.includes("importRestaurantConfigBackup")) return [importBackup, { loading: false }];
    return [vi.fn(), { loading: false }];
  });
  global.URL.createObjectURL = vi.fn(() => "blob:backup");
  global.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("BackupManagement config snapshot UI", () => {
  it("renders export/import sections and database backup warning", () => {
    renderPage();
    expect(screen.getByText("Xuất cấu hình")).toBeInTheDocument();
    expect(screen.getByText("Khôi phục cấu hình")).toBeInTheDocument();
    expect(screen.getByText(/không thay thế/i)).toBeInTheDocument();
  });

  it("creates a manual backup run from checklist workflow", async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Kiểm tra báo cáo cuối ngày"));
    fireEvent.click(screen.getByText("Tạo lần sao lưu mới"));
    await waitFor(() => expect(createBackupRun).toHaveBeenCalled());
    expect(createBackupRun.mock.calls[0][0].variables.input.checklist.reportsChecked).toBe(true);
  });

  it("select sections and click preview export", async () => {
    renderPage();
    fireEvent.click(screen.getAllByLabelText("Cấu hình hệ thống")[0]);
    fireEvent.click(screen.getByText("Xem trước"));
    await waitFor(() => expect(previewExport).toHaveBeenCalled());
    expect(previewExport.mock.calls[0][0].variables.input.sections.systemSettings).toBe(false);
  });

  it("export button downloads JSON file from base64", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    renderPage();
    fireEvent.click(screen.getByText("Tải file sao lưu JSON"));
    await waitFor(() => expect(exportBackup).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(await screen.findByText(/Mã kiểm tra: sha256:abc/)).toBeInTheDocument();
  });

  it("file input preview import calls preview mutation", async () => {
    renderPage();
    const file = new File([JSON.stringify({ kind: "cohan.restaurant_config_snapshot" })], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText(/File sao lưu JSON/i), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Đã chọn: backup.json/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Xem trước khôi phục")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Xem trước khôi phục"));
    await waitFor(() => expect(previewImport).toHaveBeenCalled());
    expect(await screen.findByText(/Xem trước: Hợp lệ/)).toBeInTheDocument();
  });

  it("import button disabled until preview valid + confirmation", async () => {
    renderPage();
    const importButton = screen.getByText("Áp dụng khôi phục");
    expect(importButton).toBeDisabled();
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText(/File sao lưu JSON/i), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Đã chọn/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Xem trước khôi phục")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Xem trước khôi phục"));
    await waitFor(() => expect(previewImport).toHaveBeenCalled());
    expect(importButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Tôi hiểu thao tác khôi phục/));
    await waitFor(() => expect(importButton).not.toBeDisabled());
    fireEvent.click(importButton);
    await waitFor(() => expect(importBackup).toHaveBeenCalled());
    expect(await screen.findByText(/Skipped recipe ingredient line/)).toBeInTheDocument();
  });

  it("handles backend error", async () => {
    previewExport.mockRejectedValueOnce(new Error("resolver missing"));
    renderPage();
    fireEvent.click(screen.getByText("Xem trước"));
    await waitFor(() => expect(screen.getByText(/resolver missing/)).toBeInTheDocument());
  });
});

const conflictPreviewPayload = (overrides = {}) => ({
  data: {
    previewRestaurantConfigImport: {
      valid: true,
      schemaVersion: 1,
      sourceRestaurantName: "Nguồn",
      targetRestaurantId: "r2",
      mode: "clone",
      warnings: [],
      errors: [],
      changes: [],
      conflictSummary: [{ key: "section:menuCatalog", label: "section menuCatalog", count: 1, enabled: true }],
      conflicts: [
        {
          id: "menuCatalog:MenuItem:PHO",
          section: "menuCatalog",
          entityType: "MenuItem",
          entityKey: "PHO",
          label: "Phở bò",
          severity: "warning",
          reason: "MenuItem with the same key already exists in target restaurant.",
          sourceLegacyId: "old-item",
          targetId: "target-item",
          defaultResolution: "keep_target",
          allowedResolutions: ["use_source", "keep_target", "merge", "rename_source", "skip"],
          warnings: [],
          fieldDiffs: [{ field: "basePrice", sourceValuePreview: "50000", targetValuePreview: "55000", severity: "warning" }],
          ...overrides.conflict,
        },
      ],
      ...overrides.preview,
    },
  },
});

const previewImportWithFile = async () => {
  const file = new File(["{}"], "backup.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText(/File sao lưu JSON/i), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(/Đã chọn/)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText("Xem trước khôi phục")).not.toBeDisabled());
  fireEvent.click(screen.getByText("Xem trước khôi phục"));
  await waitFor(() => expect(previewImport).toHaveBeenCalled());
};

describe("BackupManagement conflict resolver UI", () => {
  it("renders conflict resolver summary and field diffs after preview", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    expect(await screen.findByText("Xử lý xung đột khôi phục")).toBeInTheDocument();
    expect(screen.getByText("Tổng xung đột")).toBeInTheDocument();
    expect(screen.getByText("Cần chú ý")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Khác biệt trường"));
    expect(screen.getByText(/basePrice: file=50000/)).toBeInTheDocument();
  });

  it("changing resolution updates import payload", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý PHO"), { target: { value: "use_source" } });
    fireEvent.click(screen.getByLabelText(/Tôi hiểu thao tác khôi phục/));
    fireEvent.click(screen.getByText("Áp dụng khôi phục"));
    await waitFor(() => expect(importBackup).toHaveBeenCalled());
    expect(importBackup.mock.calls[0][0].variables.input.conflictResolutions).toEqual(expect.arrayContaining([expect.objectContaining({ conflictId: "menuCatalog:MenuItem:PHO", resolution: "use_source" })]));
  });

  it("rename_source requires rename input", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý PHO"), { target: { value: "rename_source" } });
    fireEvent.click(screen.getByLabelText(/Tôi hiểu thao tác khôi phục/));
    expect(screen.getByText("Áp dụng khôi phục")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tên mới PHO"), { target: { value: "PHO-NEW" } });
    expect(screen.getByText("Áp dụng khôi phục")).not.toBeDisabled();
  });

  it("bulk keep target updates supported conflicts", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý PHO"), { target: { value: "use_source" } });
    fireEvent.click(screen.getByText("Giữ toàn bộ hiện tại"));
    expect(screen.getByLabelText("Cách xử lý PHO")).toHaveValue("keep_target");
  });

  it("import button disabled for unresolved blocking conflict", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload({ conflict: { severity: "blocking", defaultResolution: "skip" } }));
    renderPage();
    await previewImportWithFile();
    fireEvent.click(screen.getByLabelText(/Tôi hiểu thao tác khôi phục/));
    expect(screen.getByText("Áp dụng khôi phục")).toBeDisabled();
  });
});
