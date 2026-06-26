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
  previewExport.mockResolvedValue({ data: { restaurantConfigBackupPreview: { restaurantId: "r1", fileName: "backup.json", schemaVersion: 1, createdAt: "2026-06-02T00:00:00.000Z", warnings: ["preview warning"], counts: [{ key: "systemSettings", label: "Cài đặt vận hành", count: 1, enabled: true }] } } });
  exportBackup.mockResolvedValue({ data: { exportRestaurantConfigBackup: { fileName: "backup.json", mimeType: "application/json", encoding: "base64", contentBase64: window.btoa('{"kind":"cohan.restaurant_config_snapshot"}'), checksum: "sha256:abc", sizeBytes: 42, createdAt: "2026-06-02T00:00:00.000Z" } } });
  previewImport.mockResolvedValue({ data: { previewRestaurantConfigImport: { valid: true, schemaVersion: 1, sourceRestaurantName: "Nguồn", targetRestaurantId: "r2", mode: "clone", warnings: ["preview ok"], errors: [], changes: [{ section: "systemSettings", action: "create", label: "Cài đặt vận hành", count: 1 }], conflictSummary: [], conflicts: [] } } });
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
  it("renders export/import sections and data backup warning", () => {
    renderPage();
    expect(screen.getAllByText("Tải file sao lưu").length).toBeGreaterThan(0);
    expect(screen.getByText("Khôi phục từ file")).toBeInTheDocument();
    expect(screen.getAllByText(/không thay thế/i).length).toBeGreaterThan(0);
  });

  it("creates a manual backup run from checklist workflow", async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Kiểm tra báo cáo cuối ngày"));
    fireEvent.click(screen.getByText("Tạo lần chuẩn bị"));
    await waitFor(() => expect(createBackupRun).toHaveBeenCalled());
    expect(createBackupRun.mock.calls[0][0].variables.input.checklist.reportsChecked).toBe(true);
  });

  it("select sections and click preview export", async () => {
    renderPage();
    fireEvent.click(screen.getAllByLabelText("Cài đặt vận hành")[0]);
    fireEvent.click(screen.getByText("Kiểm tra nội dung"));
    await waitFor(() => expect(previewExport).toHaveBeenCalled());
    expect(previewExport.mock.calls[0][0].variables.input.sections.systemSettings).toBe(false);
  });

  it("export button downloads file from base64", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tải file sao lưu" }));
    await waitFor(() => expect(exportBackup).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(await screen.findByText(/Mã kiểm tra: sha256:abc/)).toBeInTheDocument();
  });

  it("file input preview import calls preview mutation", async () => {
    renderPage();
    const file = new File([JSON.stringify({ kind: "cohan.restaurant_config_snapshot" })], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText(/File sao lưu/i), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Đã chọn: backup.json/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Xem trước khôi phục")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Xem trước khôi phục"));
    await waitFor(() => expect(previewImport).toHaveBeenCalled());
    expect(await screen.findByText(/Có thể khôi phục/)).toBeInTheDocument();
  });

  it("import button disabled until preview valid + confirmation", async () => {
    renderPage();
    const importButton = screen.getByText("Áp dụng khôi phục");
    expect(importButton).toBeDisabled();
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText(/File sao lưu/i), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Đã chọn/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Xem trước khôi phục")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Xem trước khôi phục"));
    await waitFor(() => expect(previewImport).toHaveBeenCalled());
    expect(importButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Tôi đã xem trước/));
    await waitFor(() => expect(importButton).not.toBeDisabled());
    fireEvent.click(importButton);
    await waitFor(() => expect(importBackup).toHaveBeenCalled());
    expect(await screen.findByText(/Một vài dòng công thức/)).toBeInTheDocument();
  });

  it("handles backend error", async () => {
    previewExport.mockRejectedValueOnce(new Error("resolver missing"));
    renderPage();
    fireEvent.click(screen.getByText("Kiểm tra nội dung"));
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
  fireEvent.change(screen.getByLabelText(/File sao lưu/i), { target: { files: [file] } });
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
    expect(await screen.findByText("Mục cần chọn cách xử lý")).toBeInTheDocument();
    expect(screen.getByText("Tổng mục")).toBeInTheDocument();
    expect(screen.getAllByText("Nên kiểm tra").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Xem khác biệt"));
    expect(screen.getByText(/Giá bán: file=50000/)).toBeInTheDocument();
  });

  it("changing resolution updates import payload", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý PHO"), { target: { value: "use_source" } });
    fireEvent.click(screen.getByLabelText(/Tôi đã xem trước/));
    fireEvent.click(screen.getByText("Áp dụng khôi phục"));
    await waitFor(() => expect(importBackup).toHaveBeenCalled());
    expect(importBackup.mock.calls[0][0].variables.input.conflictResolutions).toEqual(expect.arrayContaining([expect.objectContaining({ conflictId: "menuCatalog:MenuItem:PHO", resolution: "use_source" })]));
  });

  it("rename_source requires rename input", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý PHO"), { target: { value: "rename_source" } });
    fireEvent.click(screen.getByLabelText(/Tôi đã xem trước/));
    expect(screen.getByText("Áp dụng khôi phục")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tên mới PHO"), { target: { value: "PHO-NEW" } });
    expect(screen.getByText("Áp dụng khôi phục")).not.toBeDisabled();
  });

  it("bulk keep target updates supported conflicts", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý PHO"), { target: { value: "use_source" } });
    fireEvent.click(screen.getByText("Giữ bản hiện tại"));
    expect(screen.getByLabelText("Cách xử lý PHO")).toHaveValue("keep_target");
  });

  it("import button disabled for unresolved blocking conflict", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload({ conflict: { severity: "blocking", defaultResolution: "skip" } }));
    renderPage();
    await previewImportWithFile();
    fireEvent.click(screen.getByLabelText(/Tôi đã xem trước/));
    expect(screen.getByText("Áp dụng khôi phục")).toBeDisabled();
  });
});
