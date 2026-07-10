import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const scopeState = vi.hoisted(() => ({ current: null }));
const permissionState = vi.hoisted(() => ({
  allowed: new Set(["backup.read", "backup.write", "backup.export", "backup.import"]),
}));
const queryState = {
  readinessRestaurantId: "",
  runRestaurantId: "",
  readinessError: null,
  runsError: null,
  runs: [],
};

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
  useLazyQuery: (...args) => useLazyQueryMock(...args),
}));
vi.mock("../../../hooks/useManagerRestaurantSelection", () => ({ default: () => scopeState.current }));
vi.mock("../../../utils/frontendPermissionAccess", () => ({
  hasPermission: (_user, code) => permissionState.allowed.has(code),
}));
vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ title, subtitle, customControls, stats = [] }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {stats.map((item) => <span key={item.label}>{item.label}: {item.value}</span>)}
      {customControls}
    </header>
  ),
}));

const restaurants = [
  { id: "r1", name: "Nhà hàng 1" },
  { id: "r2", name: "Nhà hàng 2" },
];
const makeScope = (restaurantId = "r2") => ({
  restaurantOptions: restaurants,
  selectedRestaurantId: restaurantId,
  selectedRestaurant: restaurants.find((restaurant) => restaurant.id === restaurantId),
  restaurantsLoading: false,
});
const checklist = {
  reportsChecked: false,
  transactionsReconciled: false,
  settingsReviewed: false,
  exportPrepared: false,
  safeCopyStored: false,
  operatorRecorded: false,
};
const backupScope = {
  ordersAndPayments: false,
  tablesAndFloorPlan: true,
  menuAndPricing: true,
  inventory: true,
  staffAndPermissions: false,
  schedules: true,
  customersAndPromotions: true,
  reportsAndReconciliation: false,
};
const readinessFor = (restaurantId) => ({
  restaurantId,
  ready: false,
  risks: [{
    key: "reportsChecked",
    label: "Báo cáo cuối ngày chưa kiểm tra",
    severity: "warning",
    resolved: false,
    description: "Cần hoàn tất",
  }],
  checklist,
  scope: backupScope,
  lastRun: null,
});
const runFor = (restaurantId = "r2", overrides = {}) => ({
  id: "run-1",
  restaurantId,
  status: "planned",
  note: "",
  createdAt: "2026-07-10T10:00:00.000Z",
  updatedAt: "2026-07-10T10:00:00.000Z",
  completedAt: null,
  checklist,
  scope: backupScope,
  ...overrides,
});
const renderPage = () => render(
  <AuthContext.Provider value={{ user: { id: "manager-1", roleName: "manager" }, restaurants }}>
    <BackupManagement />
  </AuthContext.Provider>,
);
const getBackupFileInput = () => screen.getByLabelText(/File sao lưu/, { selector: 'input[type="file"]' });
const latestQueryOptions = (operationName) => [...useQueryMock.mock.calls]
  .reverse()
  .find(([query]) => String(query).includes(`query ${operationName}`))?.[1];
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
      conflicts: [{
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
      }],
      ...overrides.preview,
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  scopeState.current = makeScope("r2");
  permissionState.allowed = new Set(["backup.read", "backup.write", "backup.export", "backup.import"]);
  Object.assign(queryState, {
    readinessRestaurantId: "",
    runRestaurantId: "",
    readinessError: null,
    runsError: null,
    runs: [],
  });
  useQueryMock.mockImplementation((query, options = {}) => {
    const text = String(query);
    const requestedRestaurantId = options.variables?.restaurantId || "";
    if (text.includes("query BackupRuns")) {
      return {
        data: { backupRuns: queryState.runs },
        loading: false,
        error: queryState.runsError,
        refetch: vi.fn(),
        variables: { restaurantId: queryState.runRestaurantId || requestedRestaurantId },
      };
    }
    const restaurantId = queryState.readinessRestaurantId || requestedRestaurantId;
    return {
      data: { backupReadiness: readinessFor(restaurantId) },
      loading: false,
      error: queryState.readinessError,
      refetch: vi.fn(),
    };
  });
  previewExport.mockResolvedValue({
    data: {
      restaurantConfigBackupPreview: {
        restaurantId: "r2",
        fileName: "backup.json",
        schemaVersion: 1,
        createdAt: "2026-06-02T00:00:00.000Z",
        warnings: ["preview warning"],
        counts: [{ key: "systemSettings", label: "System settings", count: 1, enabled: true }],
      },
    },
  });
  exportBackup.mockResolvedValue({
    data: {
      exportRestaurantConfigBackup: {
        fileName: "backup.json",
        mimeType: "application/json",
        encoding: "base64",
        contentBase64: window.btoa('{"kind":"cohan.restaurant_config_snapshot"}'),
        checksum: "sha256:abc",
        sizeBytes: 42,
        createdAt: "2026-06-02T00:00:00.000Z",
      },
    },
  });
  previewImport.mockResolvedValue({
    data: {
      previewRestaurantConfigImport: {
        valid: true,
        schemaVersion: 1,
        sourceRestaurantName: "Nguồn",
        targetRestaurantId: "r2",
        mode: "clone",
        warnings: ["preview ok"],
        errors: [],
        changes: [{ section: "systemSettings", action: "create", label: "System settings", count: 1 }],
        conflictSummary: [],
        conflicts: [],
      },
    },
  });
  importBackup.mockResolvedValue({
    data: {
      importRestaurantConfigBackup: {
        success: true,
        dryRun: false,
        targetRestaurantId: "r2",
        mode: "clone",
        warnings: ["Skipped recipe ingredient line because ingredient was not imported or could not be remapped."],
        errors: [],
        changes: [],
        conflicts: [],
        appliedResolutions: [],
        backupRun: {
          id: "br1",
          status: "checklist_completed",
          note: "Imported",
          createdAt: "2026-06-02T00:00:00.000Z",
          completedAt: "2026-06-02T00:00:00.000Z",
        },
      },
    },
  });
  createBackupRun.mockResolvedValue({ data: { createBackupRun: runFor("r2", { id: "br-new" }) } });
  updateBackupRun.mockResolvedValue({ data: { updateBackupRun: runFor("r2", { id: "br1" }) } });
  useLazyQueryMock.mockImplementation(() => [previewExport, { loading: false }]);
  useMutationMock.mockImplementation((mutation, options = {}) => {
    const text = String(mutation);
    if (text.includes("createBackupRun")) {
      return [async (payload) => {
        try {
          const result = await createBackupRun(payload);
          options.onCompleted?.(result.data);
          return result;
        } catch (error) {
          options.onError?.(error);
          throw error;
        }
      }, { loading: false }];
    }
    if (text.includes("updateBackupRun")) {
      return [async (payload) => {
        try {
          const result = await updateBackupRun(payload);
          options.onCompleted?.(result.data);
          return result;
        } catch (error) {
          options.onError?.(error);
          throw error;
        }
      }, { loading: false }];
    }
    if (text.includes("exportRestaurantConfigBackup")) return [exportBackup, { loading: false }];
    if (text.includes("previewRestaurantConfigImport")) return [previewImport, { loading: false }];
    if (text.includes("importRestaurantConfigBackup")) return [importBackup, { loading: false }];
    return [vi.fn(), { loading: false }];
  });
  global.URL.createObjectURL = vi.fn(() => "blob:backup");
  global.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

const previewImportWithFile = async () => {
  fireEvent.change(getBackupFileInput(), {
    target: { files: [new File(["{}"], "backup.json", { type: "application/json" })] },
  });
  const previewButton = screen.getByRole("button", { name: "Kiểm tra trước khi khôi phục" });
  await waitFor(() => expect(previewButton).not.toBeDisabled());
  fireEvent.click(previewButton);
  await waitFor(() => expect(previewImport).toHaveBeenCalled());
};

describe("BackupManagement scope and user-facing wording", () => {
  it("queries the canonical manager restaurant instead of the first auth restaurant", async () => {
    renderPage();
    await waitFor(() => expect(latestQueryOptions("BackupReadiness")?.variables).toEqual({ restaurantId: "r2" }));
    expect(latestQueryOptions("BackupRuns")?.variables).toEqual({ restaurantId: "r2", limit: 5, offset: 0 });
    expect(screen.getAllByText("Nhà hàng 2").length).toBeGreaterThan(0);
  });

  it("switches queries and restore target when the manager scope changes", async () => {
    const view = renderPage();
    await waitFor(() => expect(latestQueryOptions("BackupReadiness")?.variables.restaurantId).toBe("r2"));
    scopeState.current = makeScope("r1");
    view.rerender(
      <AuthContext.Provider value={{ user: { id: "manager-1", roleName: "manager" }, restaurants }}>
        <BackupManagement />
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(latestQueryOptions("BackupReadiness")?.variables.restaurantId).toBe("r1"));
    await waitFor(() => expect(screen.getByLabelText("Nhà hàng nhận dữ liệu")).toHaveValue("r1"));
  });

  it("ignores readiness returned for another restaurant", () => {
    queryState.readinessRestaurantId = "r1";
    renderPage();
    expect(screen.getByText(/Thông tin nhận được không thuộc chi nhánh/)).toBeInTheDocument();
    expect(screen.getByText("Mức sẵn sàng: Cần xem lại")).toBeInTheDocument();
  });

  it("uses plain Vietnamese for the main workflow without exposing internal terms", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Tạo file sao lưu" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Khôi phục cài đặt" })).toBeInTheDocument();
    expect(screen.getAllByText(/Đơn hàng, thanh toán và dữ liệu đang vận hành không được lưu/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/backup\.(read|write|export|import)|audit log|snapshot|JSON/i)).not.toBeInTheDocument();
  });

  it("creates a manual backup run with the backend-supported scope", async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Kiểm tra báo cáo cuối ngày"));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu lần kiểm tra mới" }));
    await waitFor(() => expect(createBackupRun).toHaveBeenCalled());
    const input = createBackupRun.mock.calls[0][0].variables.input;
    expect(input.restaurantId).toBe("r2");
    expect(input.checklist.reportsChecked).toBe(true);
    expect(input.scope.ordersAndPayments).toBe(false);
    expect(input.scope.staffAndPermissions).toBe(false);
    expect(input.scope.reportsAndReconciliation).toBe(false);
  });

  it("explains the three preparation actions and reports creation locally", async () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Bắt đầu lần kiểm tra mới" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu lần đang kiểm tra" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy lần kiểm tra" })).toBeDisabled();
    expect(screen.getByText(/Hủy chỉ đóng lần kiểm tra, không xóa cài đặt hoặc file sao lưu/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu lần kiểm tra mới" }));
    expect(await screen.findByText(/Đã bắt đầu lần kiểm tra mới/i)).toBeInTheDocument();
  });

  it("requires at least one export section", () => {
    renderPage();
    const exportPanel = screen.getByRole("region", { name: "Tạo file sao lưu" });
    fireEvent.click(within(exportPanel).getByRole("button", { name: "Bỏ chọn tất cả" }));
    expect(within(exportPanel).getByText("Chọn ít nhất một nội dung để tạo file.")).toBeInTheDocument();
    expect(within(exportPanel).getByRole("button", { name: "Kiểm tra nội dung file" })).toBeDisabled();
    expect(within(exportPanel).getByRole("button", { name: "Tải file sao lưu" })).toBeDisabled();
  });

  it("selects sections and previews the real export payload", async () => {
    renderPage();
    fireEvent.click(screen.getAllByLabelText("Cài đặt vận hành")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra nội dung file" }));
    await waitFor(() => expect(previewExport).toHaveBeenCalled());
    expect(previewExport.mock.calls[0][0].variables.input).toMatchObject({
      restaurantId: "r2",
      sections: { systemSettings: false },
    });
  });

  it("uses the local Vietnamese section name in the export preview", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra nội dung file" }));
    await waitFor(() => expect(previewExport).toHaveBeenCalled());
    expect((await screen.findAllByText("Cài đặt vận hành")).length).toBeGreaterThan(2);
    expect(screen.queryByText("System settings")).not.toBeInTheDocument();
  });

  it("downloads the exported base64 file without exposing a checksum", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tải file sao lưu" }));
    await waitFor(() => expect(exportBackup).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(await screen.findByText("Đã tải file backup.json.")).toBeInTheDocument();
    expect(screen.queryByText(/sha256|Mã kiểm tra/i)).not.toBeInTheDocument();
  });

  it("rejects an unsupported file before calling the backend", async () => {
    renderPage();
    fireEvent.change(getBackupFileInput(), {
      target: { files: [new File(["x"], "backup.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByText(/File không đúng định dạng sao lưu/)).toBeInTheDocument();
    expect(previewImport).not.toHaveBeenCalled();
  });

  it("previews import and enables restore only after explicit confirmation", async () => {
    renderPage();
    await previewImportWithFile();
    const importButton = screen.getByRole("button", { name: "Khôi phục cài đặt" });
    expect(importButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Tôi đã kiểm tra đúng nhà hàng/));
    expect(importButton).not.toBeDisabled();
    fireEvent.click(importButton);
    await waitFor(() => expect(importBackup).toHaveBeenCalled());
    expect(await screen.findByText(/Một vài dòng công thức/)).toBeInTheDocument();
  });

  it("invalidates preview and confirmation when restore inputs change", async () => {
    renderPage();
    await previewImportWithFile();
    fireEvent.click(screen.getByLabelText(/Tôi đã kiểm tra đúng nhà hàng/));
    expect(screen.getByRole("button", { name: "Khôi phục cài đặt" })).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nhà hàng nhận dữ liệu"), { target: { value: "r1" } });
    expect(screen.queryByLabelText(/Tôi đã kiểm tra đúng nhà hàng/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Khôi phục cài đặt" })).toBeDisabled();
  });

  it("replaces an unknown English backend error with a useful Vietnamese message", async () => {
    previewExport.mockRejectedValueOnce(new Error("resolver missing"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra nội dung file" }));
    expect(await screen.findByText("Không thể kiểm tra nội dung file sao lưu. Hãy thử lại.")).toBeInTheDocument();
    expect(screen.queryByText(/resolver missing/i)).not.toBeInTheDocument();
  });
});

describe("BackupManagement preparation feedback", () => {
  beforeEach(() => { queryState.runs = [runFor()]; });

  it("reports save separately from cancellation", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lưu lần đang kiểm tra" }));
    await waitFor(() => expect(updateBackupRun).toHaveBeenCalled());
    expect(updateBackupRun.mock.calls[0][0].variables.input.status).toBeUndefined();
    expect(await screen.findByText(/Đã lưu các việc đã kiểm tra, nội dung được chọn và ghi chú/i)).toBeInTheDocument();
  });

  it("does not cancel until the user confirms", () => {
    window.confirm.mockReturnValueOnce(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Hủy lần kiểm tra" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("không xóa cài đặt nhà hàng"));
    expect(updateBackupRun).not.toHaveBeenCalled();
  });

  it("sends cancelled status and explains that settings are preserved", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Hủy lần kiểm tra" }));
    await waitFor(() => expect(updateBackupRun).toHaveBeenCalled());
    expect(updateBackupRun.mock.calls[0][0].variables.input.status).toBe("cancelled");
    expect(await screen.findByText(/Cài đặt nhà hàng và các file đã tải không bị xóa/i)).toBeInTheDocument();
  });
});

describe("BackupManagement duplicate-data choices", () => {
  it("renders the summary and field differences in plain Vietnamese", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    expect(await screen.findByRole("heading", { name: "Chọn nội dung muốn giữ" })).toBeInTheDocument();
    expect(screen.getByText("Tổng mục")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Xem điểm khác nhau"));
    expect(screen.getByText(/Giá bán: trong file 50000 · hiện có 55000/)).toBeInTheDocument();
  });

  it("sends changed choices in the restore payload", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý cho Phở bò"), { target: { value: "use_source" } });
    fireEvent.click(screen.getByLabelText(/Tôi đã kiểm tra đúng nhà hàng/));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục cài đặt" }));
    await waitFor(() => expect(importBackup).toHaveBeenCalled());
    expect(importBackup.mock.calls[0][0].variables.input.conflictResolutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conflictId: "menuCatalog:MenuItem:PHO", resolution: "use_source" }),
      ]),
    );
  });

  it("requires a name when rename_source is selected", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý cho Phở bò"), { target: { value: "rename_source" } });
    expect(screen.queryByLabelText(/Tôi đã kiểm tra đúng nhà hàng/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tên mới cho Phở bò"), { target: { value: "PHO-NEW" } });
    expect(screen.getByLabelText(/Tôi đã kiểm tra đúng nhà hàng/)).toBeInTheDocument();
  });

  it("bulk keep-current updates supported conflicts", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload());
    renderPage();
    await previewImportWithFile();
    fireEvent.change(screen.getByLabelText("Cách xử lý cho Phở bò"), { target: { value: "use_source" } });
    fireEvent.click(screen.getByRole("button", { name: "Giữ dữ liệu hiện có" }));
    expect(screen.getByLabelText("Cách xử lý cho Phở bò")).toHaveValue("keep_target");
  });

  it("allows a required conflict only after a non-skip choice is selected", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload({
      conflict: { severity: "blocking", defaultResolution: "skip" },
      preview: { valid: false },
    }));
    renderPage();
    await previewImportWithFile();
    expect(screen.queryByLabelText(/Tôi đã kiểm tra đúng nhà hàng/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cách xử lý cho Phở bò"), { target: { value: "use_source" } });
    expect(screen.getByLabelText(/Tôi đã kiểm tra đúng nhà hàng/)).toBeInTheDocument();
  });

  it("hides internal keys and translates an unlabeled singleton conflict", async () => {
    previewImport.mockResolvedValueOnce(conflictPreviewPayload({
      conflict: {
        id: "restaurantProfile:singleton:restaurantProfile",
        section: "restaurantProfile",
        entityType: "Singleton",
        entityKey: "restaurantProfile",
        label: null,
        reason: "Singleton configuration differs from target.",
      },
    }));
    renderPage();
    await previewImportWithFile();
    expect(screen.getAllByText(/Thông tin nhà hàng/).length).toBeGreaterThan(0);
    expect(screen.getByText("Cài đặt trong file khác với cài đặt hiện có.")).toBeInTheDocument();
    expect(screen.queryByText(/restaurantProfile|Singleton configuration differs from target/i)).not.toBeInTheDocument();
  });
});
