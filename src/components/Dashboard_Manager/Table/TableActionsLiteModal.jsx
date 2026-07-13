// src/components/Table/TableActionsLiteModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadTableVrImage,
  loadTableVrImageMetadata,
  removeTableVrImage,
  storeTableVrImage,
} from "@/utils/vrStorage";
import {
  MAX_TABLE_VR_SOURCE_BYTES,
  TABLE_VR_ACCEPT,
  TABLE_VR_TARGET_BYTES,
  formatTableVrBytes,
  prepareTableVrImageFile,
} from "@/utils/tableVrImageProcessing";
import { usePromotions } from "@/hooks/usePromotions";
import { getToken } from "@/lib/authStorage";
import { toApiUrl } from "@/lib/apiBaseUrl";
import useModalDraft from "@/hooks/useModalDraft";
import useModalClosePipeline from "@/hooks/useModalClosePipeline";
import { useNotification } from "@/hooks/useNotification";
import { mapTableMutationError } from "@/utils/tableMutationError";
import { getTableActionDisabledReason, getTableGuardState } from "@/utils/tableGuardState";
import {
  isPosManagedStatusTransition,
  POS_MANAGED_STATUS_TRANSITION_MESSAGE,
} from "@/utils/tableStatusTransitionGuard";
import {
  getTableDisplayCapacity,
  getTableDisplayCode,
  getTableDisplayType,
  getTableFloorId,
} from "@/utils/tableManagementDisplay";
import {
  TABLE_STATUS_OPTIONS,
  TABLE_AREA_OPTIONS,
  getTableStatusConfig,
  getTableAreaLabel,
} from "@/utils/tableManagementOptions";
import TableCameraPlacementPreviewModal from "@/components/Dashboard_Manager/Table/TableCameraPlacementPreviewModal";
import {
  buildPreviewModelItemFromVisualConfig,
  getVisualConfigSummary,
} from "@/components/Dashboard_Manager/Table/tableVisualConfigHelpers";

const resolveTableDuplicateMessage = (error, fallbackCode = "") => {
  const gqlErrors = error?.graphQLErrors || error?.networkError?.result?.errors || [];
  const duplicateErr = gqlErrors.find(
    (item) => item?.extensions?.code === "TABLE_CODE_DUPLICATE"
  );
  if (duplicateErr?.message) return duplicateErr.message;
  const message = error?.message || "";
  if (message.includes("TABLE_CODE_DUPLICATE")) {
    return `Bàn '${fallbackCode}' đã tồn tại trong tầng này. Vui lòng dùng tên khác.`;
  }
  return "";
};


const resolveTableActionError = (
  error,
  fallbackMessage = "Không thể thực hiện thao tác với bàn. Vui lòng thử lại.",
  fallbackDuplicateCode = ""
) => {
  const duplicateMessage = resolveTableDuplicateMessage(error, fallbackDuplicateCode);
  if (duplicateMessage) return duplicateMessage;
  return mapTableMutationError(error, fallbackMessage);
};

const getUniqueDisplayLabels = (values = []) => {
  const seen = new Set();

  return (Array.isArray(values) ? values : [values])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const joinUniqueLabels = (values = [], separator = " · ") =>
  getUniqueDisplayLabels(values).join(separator);

const getTableVrFileSummary = (metadata) => {
  if (!metadata) return "";
  const originalBytes = Number(metadata.originalBytes || 0);
  const processedBytes = Number(metadata.processedBytes || 0);
  const dimensions =
    metadata.width && metadata.height
      ? `${metadata.width} × ${metadata.height}`
      : "";
  const compression =
    originalBytes > processedBytes && processedBytes
      ? `${formatTableVrBytes(originalBytes)} → ${formatTableVrBytes(processedBytes)}${metadata.savingsPercent ? ` (giảm ${metadata.savingsPercent}%)` : ""}`
      : processedBytes
        ? formatTableVrBytes(processedBytes)
        : "";
  return [dimensions, compression].filter(Boolean).join(" • ");
};

const DEFAULT_TABLE_POSITION = { x: 80, y: 80 };
const TABLE_POSITION_STEP = 40;
const TABLE_POSITION_MAX_ATTEMPTS = 30;

const getTablePosition = (targetTable) =>
  targetTable?.position || {
    x: targetTable?.posX,
    y: targetTable?.posY,
  };

const isValidPosition = (position) =>
  position &&
  Number.isFinite(Number(position.x)) &&
  Number.isFinite(Number(position.y));

const buildMovedTablePosition = (targetTable, nextCoordinates) => {
  const currentPosition = getTablePosition(targetTable);
  return {
    ...(isValidPosition(currentPosition) ? currentPosition : {}),
    ...nextCoordinates,
  };
};

const getAvailablePositionForFloor = (allTables, targetFloorId) => {
  const occupiedPositions = new Set(
    (allTables || [])
      .filter((item) => String(getTableFloorId(item)) === String(targetFloorId))
      .map(getTablePosition)
      .filter(isValidPosition)
      .map((position) => `${Math.round(Number(position.x))}:${Math.round(Number(position.y))}`)
  );

  for (let index = 0; index < TABLE_POSITION_MAX_ATTEMPTS; index += 1) {
    const candidate = {
      x: DEFAULT_TABLE_POSITION.x + index * TABLE_POSITION_STEP,
      y: DEFAULT_TABLE_POSITION.y + index * TABLE_POSITION_STEP,
    };
    const key = `${Math.round(candidate.x)}:${Math.round(candidate.y)}`;
    if (!occupiedPositions.has(key)) {
      return candidate;
    }
  }

  return DEFAULT_TABLE_POSITION;
};

export default function TableActionsLiteModal({
  open,
  table,
  onClose,
  onUpdated,
  restaurantId,

  // floors: Array<{id, level, name?}>
  floors = [],
  tables = [],

  // actions from parent (TableManagement)
  actions = {
    updateTable: async () => {},
    setTableStatus: async () => {},
    moveTable: async () => {},
    swapTableCodes: async () => {},
    mergeTables: async () => {},
    splitTables: async () => {},
    deleteTable: async () => {},
    fetchTableByCode: () => null,
    getIdFromLevel: () => null,
  },

}) {
  const isOpen = !!open && !!table;
  const titleId = "talite-title";
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const guardState = useMemo(() => getTableGuardState(table), [table]);
  const deleteDisabledReason = useMemo(
    () => getTableActionDisabledReason(table, "delete"),
    [table]
  );
  // ------- local states -------
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [type, setType] = useState("standard"); // standard | vip | outdoor
  const [tags, setTags] = useState("");
  const [status, setStatusLocal] = useState("available");
  const [vrUrl, setVrUrl] = useState("");
  const [vrUploadStatus, setVrUploadStatus] = useState("");
  const [vrUploadStatusTone, setVrUploadStatusTone] = useState("info");
  const [vrUploadError, setVrUploadError] = useState("");
  const [vrFileName, setVrFileName] = useState("");
  const [vrFileSizeLabel, setVrFileSizeLabel] = useState("");
  const [vrPreviewUrl, setVrPreviewUrl] = useState("");
  const [vrUploading, setVrUploading] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedPromotions, setSelectedPromotions] = useState([]);
  const [quickPerk, setQuickPerk] = useState("");
  const [manualPerks, setManualPerks] = useState([]);
  const [zoneLabel, setZoneLabel] = useState("");
  const [holdMinutes, setHoldMinutes] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [cancelPolicy, setCancelPolicy] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState({
    merge: null,
    promo: null,
    turnover: null,
  });
  const [aiLoading, setAiLoading] = useState({
    merge: false,
    promo: false,
    turnover: false,
  });

  const [moveLevel, setMoveLevel] = useState(null);
  const [swapWithCode, setSwapWithCode] = useState("");
  const [mergeCodes, setMergeCodes] = useState("");

  const [busy, setBusy] = useState({});
  const [cameraPreviewOpen, setCameraPreviewOpen] = useState(false);
  const cameraPreviewOpenRef = useRef(false);
  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  const {
    allPromotions,
    loading: promotionsLoading,
    error: promotionsError,
  } = usePromotions({
    restaurantId,
    activeOnly: true,
    showErrorBanner: false,
  });
  const { showNotification } = useNotification();

  const initialDraft = useMemo(
    () => ({
      code: table?.code ?? table?.number ?? "",
      capacity: Number(table?.capacity ?? table?.seats ?? 0),
      type: table?.type ?? table?.area ?? "standard",
      tags: joinUniqueLabels(table?.tags || [], ", "),
      status: table?.status || "available",
      depositAmount: table?.deposit ?? "",
      selectedPromotions: Array.isArray(table?.promotionIds) ? table.promotionIds : [],
      manualPerks: Array.isArray(table?.bookingPerks) ? table.bookingPerks : [],
      zoneLabel: table?.zone || table?.areaLabel || "",
      holdMinutes: table?.reservationHoldMinutes ?? table?.holdMinutes ?? "",
      minSpend: table?.minSpend ?? table?.minOrderValue ?? "",
      cancelPolicy: table?.cancelPolicy ?? table?.bookingPolicy ?? "",
      moveLevel: table?.floorLevel ?? null,
      swapWithCode: "",
      mergeCodes: "",
    }),
    [table],
  );

  const draftForm = {
    code,
    capacity,
    type,
    tags,
    status,
    depositAmount,
    selectedPromotions,
    manualPerks,
    zoneLabel,
    holdMinutes,
    minSpend,
    cancelPolicy,
    moveLevel,
    swapWithCode,
    mergeCodes,
  };
  const isDirty = JSON.stringify(draftForm) !== JSON.stringify(initialDraft);

  const { requestCloseWithDraft, clearDraft, didRestore } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "table",
      modal: "table-actions-lite-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "edit",
      entityType: "table",
      recordId: table?.id || table?.code || null,
      context: String(restaurantId || "default"),
      schemaVersion: "2",
    },
    formValue: draftForm,
    isDirty,
    sanitize: (v) => ({
      code: v?.code || "",
      capacity: Number(v?.capacity || 0),
      type: v?.type || "standard",
      tags: v?.tags || "",
      status: v?.status || "available",
      depositAmount: v?.depositAmount ?? "",
      selectedPromotions: Array.isArray(v?.selectedPromotions) ? v.selectedPromotions : [],
      manualPerks: Array.isArray(v?.manualPerks) ? v.manualPerks : [],
      zoneLabel: v?.zoneLabel || "",
      holdMinutes: v?.holdMinutes ?? "",
      minSpend: v?.minSpend ?? "",
      cancelPolicy: v?.cancelPolicy || "",
      moveLevel: v?.moveLevel ?? null,
      swapWithCode: v?.swapWithCode || "",
      mergeCodes: v?.mergeCodes || "",
    }),
    onRestore: (draft) => {
      setCode(draft?.code || "");
      setCapacity(Number(draft?.capacity || 0));
      setType(draft?.type || "standard");
      setTags(draft?.tags || "");
      setStatusLocal(draft?.status || "available");
      setDepositAmount(draft?.depositAmount ?? "");
      setSelectedPromotions(
        Array.isArray(draft?.selectedPromotions) ? draft.selectedPromotions : [],
      );
      setManualPerks(Array.isArray(draft?.manualPerks) ? draft.manualPerks : []);
      setZoneLabel(draft?.zoneLabel || "");
      setHoldMinutes(draft?.holdMinutes ?? "");
      setMinSpend(draft?.minSpend ?? "");
      setCancelPolicy(draft?.cancelPolicy || "");
      setMoveLevel(draft?.moveLevel ?? null);
      setSwapWithCode(draft?.swapWithCode || "");
      setMergeCodes(draft?.mergeCodes || "");
      showNotification(
        "Ảnh/VR upload không thể khôi phục tự động từ bản nháp.",
        "info",
        3200,
      );
    },
    notify: showNotification,
  });

  useEffect(() => {
    if (!isOpen) return;
    if (didRestore) return;

    setCode(table?.code ?? table?.number ?? "");
    setCapacity(Number(table?.capacity ?? table?.seats ?? 0));
    setType(table?.type ?? table?.area ?? "standard");
    setTags(joinUniqueLabels(table?.tags || [], ", "));
    setStatusLocal(table?.status || "available");
    const storedImage = loadTableVrImage(table?.id);
    const storedMetadata = loadTableVrImageMetadata(table?.id);
    const fallbackVrUrl =
      !table?.vrUrl && storedImage ? `/vr/table/${table?.id}` : "";
    setVrUrl(table?.vrUrl || fallbackVrUrl);
    setVrUploadStatus("");
    setVrUploadError("");
    setVrFileName(storedMetadata?.name || "");
    setVrFileSizeLabel(getTableVrFileSummary(storedMetadata));
    setVrPreviewUrl(storedImage || "");
    setMoveLevel(table?.floorLevel ?? null);
    setSwapWithCode("");
    setMergeCodes("");
    setDepositAmount(table?.deposit ?? "");
    setSelectedPromotions(
      Array.isArray(table?.promotionIds) ? table.promotionIds : []
    );
    setManualPerks(
      Array.isArray(table?.bookingPerks) ? table.bookingPerks : []
    );
    setZoneLabel(table?.zone || table?.areaLabel || "");
    setHoldMinutes(
      table?.reservationHoldMinutes ?? table?.holdMinutes ?? ""
    );
    setMinSpend(table?.minSpend ?? table?.minOrderValue ?? "");
    setCancelPolicy(table?.cancelPolicy ?? table?.bookingPolicy ?? "");
    setAiSuggestions({ merge: null, promo: null, turnover: null });
    setQuickPerk("");
  }, [didRestore, isOpen, table]);

  useEffect(
    () => () => {
      if (vrPreviewUrl && vrPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(vrPreviewUrl);
      }
    },
    [vrPreviewUrl]
  );

  const { requestClose, onBackdropMouseDown } = useModalClosePipeline({
    isOpen,
    onClose: () => requestCloseWithDraft(() => onClose?.()),
  });

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    cameraPreviewOpenRef.current = cameraPreviewOpen;
  }, [cameraPreviewOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    const modal = modalRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(modal?.querySelectorAll(focusableSelector) || []).filter(
        (element) => element.offsetParent !== null
      );

    requestAnimationFrame(() => {
      const [firstFocusable] = getFocusable();
      (firstFocusable || modal)?.focus?.();
    });

    const handleKeyDown = (event) => {
      if (event.key !== "Tab" || cameraPreviewOpenRef.current) return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        modal?.focus?.();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    modal?.addEventListener("keydown", handleKeyDown);
    return () => {
      modal?.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  const floorsSorted = useMemo(
    () =>
      (floors || []).slice().sort((a, b) => Number(a.level) - Number(b.level)),
    [floors]
  );
  const visualModelItem = useMemo(
    () => buildPreviewModelItemFromVisualConfig(table?.visualConfig),
    [table?.visualConfig]
  );
  const visualSummary = useMemo(
    () => getVisualConfigSummary(table?.visualConfig),
    [table?.visualConfig]
  );

  if (!isOpen) return null;

  const hasStoredImage = !!loadTableVrImage(table?.id);
  const isVrSaving = !!busy.save || vrUploading;
  const hasVrConfigured = Boolean(vrUrl?.trim() || hasStoredImage);
  const hasVisualConfig = !!table?.visualConfig;
  const vrContextLabel = joinUniqueLabels(
    [
      `Bàn ${code || getTableDisplayCode(table) || "--"}`,
      zoneLabel?.trim() ? `Khu vực ${zoneLabel.trim()}` : null,
      table?.floorLevel != null ? `Tầng ${table.floorLevel}` : null,
    ],
    " • "
  );

  // ================= Actions =================
  const handleSaveBasics = async () => {
    if (!table?.id) return;
    if (vrUploading) {
      showNotification("Ảnh 360 đang xử lý. Vui lòng đợi xong rồi lưu.", "info");
      return;
    }
    setBusyKey("save", true);
    try {
      // CHÚ Ý: type chỉ cho phép: standard | vip | outdoor (không có "indoor")
      const patch = {
        id: table.id,
        code: code?.trim(),
        capacity: Number.isFinite(capacity) ? Number(capacity) : 0,
        type: (type || "standard").trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        vrUrl: vrUrl?.trim() || null,
        deposit: depositAmount === "" ? null : Number.parseInt(depositAmount, 10),
        promotionIds: selectedPromotions,
        bookingPerks: manualPerks,
        zone: zoneLabel?.trim() || null,
        reservationHoldMinutes:
          holdMinutes === "" ? null : Number.parseInt(holdMinutes, 10),
        minSpend: minSpend === "" ? null : Number.parseFloat(minSpend),
        cancelPolicy: cancelPolicy?.trim() || null,
      };
      await actions.updateTable(patch);
      clearDraft();
      try {
        await onUpdated?.();
        showNotification("Đã lưu cấu hình bàn thành công.", "success", 2200);
      } catch {
        showNotification(
          "Đã lưu thành công nhưng không thể đồng bộ danh sách ngay lúc này.",
          "warning",
          3600
        );
      }
    } catch (error) {
      showNotification(
        resolveTableActionError(error, "Cập nhật thông tin bàn thất bại.", code?.trim()),
        "error"
      );
    } finally {
      setBusyKey("save", false);
    }
  };

  const handleVrFileChange = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !table?.id) return;

    setVrUploadError("");
    setVrUploadStatus(
      `Đang kiểm tra và nén ${formatTableVrBytes(file.size)}. Vui lòng không đóng cửa sổ...`,
    );
    setVrUploadStatusTone("info");
    setVrUploading(true);

    try {
      const panorama = await prepareTableVrImageFile(file);
      const stored = storeTableVrImage(table.id, panorama.dataUrl, panorama);
      if (!stored) {
        throw new Error(
          "Local Storage của trình duyệt đã đầy. Hãy xóa ảnh 360° cũ hoặc dữ liệu trang rồi thử lại.",
        );
      }

      if (vrPreviewUrl && vrPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(vrPreviewUrl);
      }
      setVrFileName(panorama.name);
      setVrFileSizeLabel(getTableVrFileSummary(panorama));
      setVrPreviewUrl(panorama.dataUrl);
      setVrUrl(`/vr/table/${table.id}`);
      setVrUploadStatus(
        `Đã nén ảnh còn ${formatTableVrBytes(panorama.processedBytes)}${panorama.savingsPercent ? `, giảm ${panorama.savingsPercent}%` : ""}. Bấm “Lưu thay đổi” để cập nhật cấu hình bàn.`,
      );
      setVrUploadStatusTone("success");
    } catch (error) {
      setVrUploadError(error?.message || "Không thể xử lý ảnh 360°.");
      setVrUploadStatus("");
    } finally {
      setVrUploading(false);
      input.value = "";
    }
  };

  const handleRemoveVrImage = () => {
    if (!table?.id) return;
    removeTableVrImage(table.id);
    if (vrPreviewUrl && vrPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(vrPreviewUrl);
    }
    setVrPreviewUrl("");
    setVrFileName("");
    setVrFileSizeLabel("");
    setVrUploadError("");
    setVrUploadStatus("Đã xoá ảnh 360 khỏi phiên làm việc.");
    setVrUploadStatusTone("info");
  };

  const handleRequestClose = (reason) => {
    if (isVrSaving) {
      showNotification("Đang lưu/xử lý ảnh. Vui lòng đợi hoàn tất trước khi đóng.", "info");
      return;
    }
    requestClose(reason);
  };

  const handleBackdropMouseDownSafe = (event) => {
    if (isVrSaving) {
      event.preventDefault();
      showNotification("Đang lưu/xử lý ảnh. Vui lòng đợi hoàn tất trước khi đóng.", "info");
      return;
    }
    onBackdropMouseDown(event);
  };

  const handleChangeStatus = async (next) => {
    if (!table?.id || next === status || busy.status) return;
    if (isPosManagedStatusTransition(status, next)) {
      showNotification(POS_MANAGED_STATUS_TRANSITION_MESSAGE, "warning");
      return;
    }
    setBusyKey("status", true);
    try {
      await actions.setTableStatus({ id: table.id, status: next });
      setStatusLocal(next);
      await onUpdated?.();
    } catch (error) {
      showNotification(resolveTableActionError(error, "Đổi trạng thái thất bại."), "error");
    } finally {
      setBusyKey("status", false);
    }
  };

  const handleMove = async () => {
    if (!table?.id || moveLevel == null || busy.move) return;
    const floorId = actions.getIdFromLevel?.(moveLevel);
    if (!floorId) {
      showNotification("Không tìm thấy tầng đích.", "error");
      return;
    }

    const currentFloorId = getTableFloorId(table);
    const isChangingFloor = String(currentFloorId) !== String(floorId);
    if (table.joinGroupId && isChangingFloor) {
      showNotification("Vui lòng tách bàn khỏi nhóm trước khi chuyển tầng.", "error");
      return;
    }
    const payload = { id: table.id, floorId };

    if (isChangingFloor) {
      const nextCoordinates = getAvailablePositionForFloor(tables, floorId);
      payload.position = buildMovedTablePosition(table, nextCoordinates);
    }

    setBusyKey("move", true);
    try {
      await actions.moveTable(payload);
      await onUpdated?.();
    } catch (error) {
      showNotification(resolveTableActionError(error, "Chuyển bàn sang tầng khác thất bại."), "error");
    } finally {
      setBusyKey("move", false);
    }
  };

  const handleSwap = async () => {
    if (busy.swap) return;
    const codeB = (swapWithCode || "").trim();
    if (!codeB) return;
    const b = actions.fetchTableByCode?.(codeB);
    if (!b) {
      showNotification("Không tìm thấy bàn có mã: " + codeB, "error");
      return;
    }
    if (String(getTableFloorId(b)) !== String(getTableFloorId(table))) {
      showNotification("Đổi chỗ chỉ áp dụng cho 2 bàn cùng tầng.", "error");
      return;
    }
    setBusyKey("swap", true);
    try {
      await actions.swapTableCodes({
        restaurantId,
        floorId: table.floorId,
        aId: table.id,
        bId: b.id,
      });
      await onUpdated?.();
      setSwapWithCode("");
    } catch (error) {
      showNotification(resolveTableActionError(error, "Đổi chỗ (swap code) thất bại."), "error");
    } finally {
      setBusyKey("swap", false);
    }
  };

  const handleMerge = async () => {
    if (busy.merge) return;
    const raw = (mergeCodes || "").trim();
    if (!raw) return;
    const codes = raw.split(/[,\s]+/).map((c) => c.trim()).filter(Boolean);
    const missingCodes = codes.filter((c) => !actions.fetchTableByCode?.(c));
    if (missingCodes.length) {
      showNotification(`Không tìm thấy bàn: ${missingCodes.join(", ")}`, "error");
      return;
    }
    const mergeTables = codes.map((c) => actions.fetchTableByCode?.(c));
    const selfOnly =
      mergeTables.length > 0 &&
      mergeTables.every((item) => String(item.id) === String(table.id));
    if (selfOnly) {
      showNotification("Không thể gộp bàn với chính nó.", "error");
      return;
    }
    const crossFloor = mergeTables.some(
      (item) => String(getTableFloorId(item)) !== String(getTableFloorId(table))
    );
    if (crossFloor) {
      showNotification("Chỉ gộp các bàn cùng tầng.", "error");
      return;
    }
    const ids = Array.from(new Set([table.id, ...mergeTables.map((item) => item.id)]));
    if (ids.length < 2) {
      showNotification("Cần ít nhất 2 bàn để gộp.", "error");
      return;
    }
    setBusyKey("merge", true);
    try {
      await actions.mergeTables({ tableIds: ids, anchorId: table.id });
      await onUpdated?.();
      setMergeCodes("");
    } catch (error) {
      showNotification(resolveTableActionError(error, "Gộp bàn thất bại."), "error");
    } finally {
      setBusyKey("merge", false);
    }
  };

  const handleSplitOut = async () => {
    if (!table?.joinGroupId || busy.split) return;
    setBusyKey("split", true);
    try {
      await actions.splitTables({
        joinGroupId: table.joinGroupId,
        mode: "PARTIAL",
        tableIds: [table.id],
      });
      await onUpdated?.();
    } catch (error) {
      showNotification(resolveTableActionError(error, "Tách bàn thất bại."), "error");
    } finally {
      setBusyKey("split", false);
    }
  };

  const handleSplitAll = async () => {
    if (!table?.joinGroupId || busy.splitAll) return;
    setBusyKey("splitAll", true);
    try {
      await actions.splitTables({
        joinGroupId: table.joinGroupId,
        mode: "ALL",
      });
      await onUpdated?.();
    } catch (error) {
      showNotification(resolveTableActionError(error, "Tách cả nhóm thất bại."), "error");
    } finally {
      setBusyKey("splitAll", false);
    }
  };

  const handleDelete = async () => {
    if (!table?.id || busy.delete) return;
    if (!window.confirm(`Xóa bàn ${getTableDisplayCode(table) || "này"}?`)) return;
    setBusyKey("delete", true);
    try {
      await actions.deleteTable(table.id);
      await onUpdated?.();
      clearDraft();
      onClose?.();
    } catch (error) {
      showNotification(resolveTableActionError(error, "Xóa bàn thất bại."), "error");
    } finally {
      setBusyKey("delete", false);
    }
  };

  const togglePromotion = (promoId) => {
    setSelectedPromotions((prev) =>
      prev.includes(promoId)
        ? prev.filter((id) => id !== promoId)
        : [...prev, promoId]
    );
  };

  const handleAddQuickPerk = () => {
    const cleaned = quickPerk.trim();
    if (!cleaned) return;
    setManualPerks((prev) =>
      prev.includes(cleaned) ? prev : [...prev, cleaned]
    );
    setQuickPerk("");
  };

  const removePerk = (perk) => {
    setManualPerks((prev) => prev.filter((item) => item !== perk));
  };


  const assistantTitles = {
    merge: "Bàn nên ghép",
    promo: "Khuyến mãi phù hợp",
    turnover: "Thời điểm bàn có thể trống",
  };

  const buildAiPayload = () => ({
    restaurantId,
    table: {
      id: table?.id,
      code: code?.trim(),
      capacity,
      status,
      type,
      floorLevel: table?.floorLevel,
      floorId: getTableFloorId(table),
      zone: zoneLabel,
      position: table?.position,
      deposit: depositAmount === "" ? null : Number.parseFloat(depositAmount),
      holdMinutes:
        holdMinutes === "" ? null : Number.parseInt(holdMinutes, 10),
      minSpend: minSpend === "" ? null : Number.parseFloat(minSpend),
      cancelPolicy,
      usageCount: table?.usageCount,
    },
    promotions: (allPromotions || []).map((promo) => ({
      id: promo.id,
      name: promo.name,
      code: promo.code,
      level: promo.level,
      usageCount: promo.usageCount,
    })),
    history:
      table?.usageHistory || table?.history || table?.reservationHistory || [],
    tables: (tables || [])
      .filter(
        (item) =>
          String(item?.id || item?._id || "") !== String(table?.id || "") &&
          String(getTableFloorId(item) || "") === String(getTableFloorId(table) || "") &&
          String(item?.status || "").toLowerCase() === "available",
      )
      .map((item) => ({
        id: item?.id || item?._id,
        code: getTableDisplayCode(item),
        capacity: getTableDisplayCapacity(item),
        status: item?.status,
        floorId: getTableFloorId(item),
        position: item?.position,
        usageCount: item?.usageCount,
      })),
  });

  const callAiEndpoint = async (path, key) => {
    if (!restaurantId) {
      showNotification("Chưa xác định được chi nhánh của bàn.", "error");
      return;
    }

    setAiLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const token = getToken();
      const response = await fetch(toApiUrl(path), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildAiPayload()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Không thể tải gợi ý vận hành.");
      }

      const suggestion = String(data?.suggestion || "").trim();
      if (!suggestion) throw new Error("Hệ thống chưa tạo được gợi ý phù hợp.");

      setAiSuggestions((prev) => ({
        ...prev,
        [key]: { title: assistantTitles[key], detail: suggestion },
      }));
    } catch (error) {
      setAiSuggestions((prev) => ({ ...prev, [key]: null }));
      showNotification(
        error?.message || "Không thể tải gợi ý vận hành. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSuggestMergeAI = () =>
    callAiEndpoint("/ai/table/merge-suggestion", "merge");

  const handleSuggestPromoAI = () =>
    callAiEndpoint("/ai/table/promo-suggestion", "promo");

  const handlePredictTurnoverAI = () =>
    callAiEndpoint("/ai/table/turnover-prediction", "turnover");

  // ================= Render =================
  return createPortal(
    <div className="talite-backdrop" onMouseDown={handleBackdropMouseDownSafe}>
      <div
        ref={modalRef}
        className="talite-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="talite-header">
          <div>
            <h3 id={titleId} className="talite-title">
              Chi tiết bàn <b>{getTableDisplayCode(table) || "--"}</b>
            </h3>
            <p className="talite-subtitle">
              Cập nhật thông tin phục vụ, trạng thái và khuyến mãi của bàn.
            </p>
          </div>
          <button
            type="button"
            className="talite-close"
            onClick={() => handleRequestClose("x")}
            aria-label="Đóng"
            disabled={isVrSaving}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="talite-body">
          {/* Info */}
          <div className="talite-info">
            <div className="kv">
              <span className="k">Mã bàn:</span>
              <span className="v">{getTableDisplayCode(table) || "--"}</span>
            </div>
            <div className="kv">
              <span className="k">Tầng:</span>
              <span className="v">Tầng {table?.floorLevel ?? "?"}</span>
            </div>
            <div className="kv">
              <span className="k">Sức chứa:</span>
              <span className="v">{getTableDisplayCapacity(table)} chỗ</span>
            </div>
            <div className="kv">
              <span className="k">Loại:</span>
              <span className="v">{getTableAreaLabel(getTableDisplayType(table))}</span>
            </div>
            <div className="kv">
              <span className="k">Khu vực:</span>
              <span className="v">
                {zoneLabel?.trim() || table?.zone || table?.areaLabel || "Chưa rõ"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Trạng thái:</span>
              <span className="v">{getTableStatusConfig(status).text}</span>
            </div>
            {hasVisualConfig && (
              <div className="talite-visual-card">
                <div className="talite-visual-card__head">
                  <span className="talite-visual-card__icon">3D</span>
                  <div>
                    <strong>Đã có mô phỏng 3D</strong>
                    <p>{visualSummary?.label || "Bàn này đã được thiết lập mô phỏng."}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 1) Cơ bản */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">📌</span>
              <div>
                <div className="talite-label">Thông tin bàn</div>
                <div className="talite-group-sub">
                  Cập nhật mã bàn, số chỗ, loại bàn và khu vực phục vụ.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">Mã bàn</label>
                <input
                  className="talite-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="talite-label">Số chỗ</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="talite-label">Loại bàn</label>
                <select
                  className="talite-input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {TABLE_AREA_OPTIONS.map((areaOption) => (
                    <option key={areaOption.value} value={areaOption.value}>
                      {areaOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="talite-label">
                  Nhãn phân loại (cách nhau bằng dấu phẩy)
                </label>
                <input
                  className="talite-input"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="VIP, sân vườn…"
                />
              </div>
              <div>
                <label className="talite-label">Khu vực phục vụ</label>
                <input
                  className="talite-input"
                  value={zoneLabel}
                  onChange={(e) => setZoneLabel(e.target.value)}
                  placeholder="VD: Sảnh chính, Sân vườn"
                />
              </div>
              <div className="talite-vr-block">
                <div className="talite-vr-header">
                  <div>
                    <div className="talite-vr-title">Không gian 360° của bàn</div>
                    <div className="talite-vr-sub">
                      Thêm liên kết hoặc ảnh 360° để khách xem trước vị trí bàn.
                    </div>
                  </div>
                  <span className="talite-vr-badge">Ảnh 360°</span>
                </div>
                <div className="talite-vr-field">
                  <label className="talite-label">Liên kết xem 360°</label>
                  <input
                    className="talite-input"
                    value={vrUrl}
                    onChange={(e) => {
                      setVrUrl(e.target.value);
                      if (vrUploadError) setVrUploadError("");
                    }}
                    placeholder="https://... hoặc /vr/table/123"
                  />
                  <div className="hint">
                    {vrContextLabel}. Dán liên kết xem 360° bên ngoài hoặc tải
                    ảnh 360 ở bước dưới.
                  </div>
                </div>
                <div className={`talite-vr-state ${hasVrConfigured ? "ready" : "pending"}`}>
                  <strong>Tình trạng:</strong>{" "}
                  {hasVrConfigured
                    ? "Đã có nội dung xem 360°."
                    : "Chưa có nội dung xem 360°."}
                </div>
                <div className="talite-upload">
                  <div className="talite-upload-header">
                    <div>
                      <label className="talite-label">Tải ảnh 360°</label>
                      <p className="hint">
                        Chọn ảnh cầu equirectangular gần tỷ lệ 2:1, không phải
                        panorama ngang thông thường. Nhận JPG/PNG/WebP/AVIF đến {formatTableVrBytes(MAX_TABLE_VR_SOURCE_BYTES)} và tự nén xuống khoảng {formatTableVrBytes(TABLE_VR_TARGET_BYTES)}.
                      </p>
                    </div>
                    <span className="talite-step-chip">Bước 1</span>
                  </div>
                  <label className="talite-file-picker">
                    <input
                      className="talite-file-input"
                      type="file"
                      accept={TABLE_VR_ACCEPT}
                      onChange={handleVrFileChange}
                      disabled={vrUploading}
                    />
                    <span className="btn ghost">
                      {vrUploading ? "Đang nén ảnh..." : "Chọn ảnh 360"}
                    </span>
                    <span className="talite-file-name">
                      {vrFileName || "Chưa chọn tệp nào"}
                    </span>
                  </label>
                  {!!vrFileSizeLabel && (
                    <div className="hint">Thông tin ảnh: {vrFileSizeLabel}</div>
                  )}
                  {vrPreviewUrl ? (
                    <div className="talite-vr-preview-wrap">
                      <div className="talite-vr-preview-head">
                        <span className="talite-step-chip">Bước 2</span>
                        <span>Xem trước ảnh 360 sau khi nén</span>
                      </div>
                      <img
                        className="talite-vr-preview"
                        src={vrPreviewUrl}
                        alt={`Ảnh 360 xem trước cho bàn ${code || getTableDisplayCode(table) || ""}`}
                      />
                    </div>
                  ) : (
                    <div className="talite-vr-empty">
                      Chưa có ảnh xem trước. Hãy chọn ảnh để kiểm tra trước khi
                      lưu.
                    </div>
                  )}
                  {vrUploadError && (
                    <div className="talite-vr-feedback error">{vrUploadError}</div>
                  )}
                  {vrUploadStatus && (
                    <div className={`talite-vr-feedback ${vrUploadStatusTone}`}>
                      {vrUploadStatus}
                    </div>
                  )}
                  {!hasVrConfigured && !vrUploadError && (
                    <div className="talite-vr-feedback warn">
                      Bàn này chưa có liên kết hoặc ảnh 360°.
                    </div>
                  )}
                  <div className="talite-vr-inline-actions">
                    {hasStoredImage && (
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={handleRemoveVrImage}
                        disabled={vrUploading}
                      >
                        Xoá ảnh 360 đã lưu
                      </button>
                    )}
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        if (!vrUrl) {
                          setVrUploadError("Chưa có liên kết xem 360° để mở.");
                          return;
                        }
                        window.open(vrUrl, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!vrUrl || vrUploading}
                    >
                      Mở bản xem 360°
                    </button>
                  </div>
                  <div className="talite-vr-next-step">
                    <span className="talite-step-chip">Bước 3</span>
                    <span>
                      Sau khi xem trước, bấm <b>Lưu thay đổi</b> để cập
                      nhật cấu hình bàn.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2) Trạng thái */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🟢</span>
              <div>
                <div className="talite-label">Trạng thái</div>
                <div className="talite-group-sub">
                  Chọn trạng thái hiện tại để nhân viên phối hợp phục vụ.
                </div>
              </div>
            </div>
            <div className="chips">
              {TABLE_STATUS_OPTIONS.filter((item) => item.value !== "payment_pending").map(
                (statusOption) => {
                  const st = statusOption.value;
                  return (
                  <button
                    type="button"
                    key={st}
                    className={`chip ${status === st ? "active" : ""}`}
                    onClick={() => handleChangeStatus(st)}
                    disabled={busy.status}
                  >
                    {statusOption.label}
                  </button>
                  );
                }
              )}
            </div>
            {guardState.hasGuard && (
              <div className="hint" style={{ marginTop: 8 }}>
                {guardState.reason}
              </div>
            )}

            {/* Yêu cầu đặc biệt: nếu đang Reserved -> có nút Dọn dẹp; nếu Cleaning -> có nút Sẵn sàng */}
            <div className="actions-end" style={{ marginTop: 8 }}>
              {status === "reserved" && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleChangeStatus("cleaning")}
                  disabled={busy.status}
                >
                  🧹 Dọn dẹp
                </button>
              )}
              {status === "cleaning" && (
                <button
                  type="button"
                  className="btn success"
                  onClick={() => handleChangeStatus("available")}
                >
                  ✅ Sẵn sàng
                </button>
              )}
            </div>
          </div>

          {/* 3) Chuyển bàn sang tầng khác */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🏢</span>
              <div>
                <div className="talite-label">Chuyển bàn sang tầng khác</div>
                <div className="talite-group-sub">
                  Chuyển bàn sang tầng khác khi thay đổi sơ đồ phục vụ.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">Chuyển đến</label>
                <select
                  className="talite-input"
                  value={moveLevel ?? ""}
                  onChange={(e) =>
                    setMoveLevel(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  {floorsSorted.map((f) => (
                    <option key={f.id} value={f.level}>
                      Tầng {f.level}
                      {f.name ? ` — ${f.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="actions-end" style={{ alignItems: "end" }}>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy.move}
                  onClick={handleMove}
                >
                  {busy.move ? "Đang chuyển…" : "Chuyển bàn"}
                </button>
              </div>
            </div>
          </div>

          {/* 4) Đổi chỗ */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🔁</span>
              <div>
                <div className="talite-label">
                  Đổi vị trí với bàn khác
                </div>
                <div className="talite-group-sub">
                  Đổi mã hiển thị giữa hai bàn trong cùng một tầng.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">Bàn cần đổi vị trí</label>
                <input
                  className="talite-input"
                  placeholder="Ví dụ: A10"
                  value={swapWithCode}
                  onChange={(e) => setSwapWithCode(e.target.value)}
                />
                <div className="hint">Chỉ áp dụng cho hai bàn trong cùng một tầng.</div>
              </div>
              <div className="actions-end" style={{ alignItems: "end" }}>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy.swap}
                  onClick={handleSwap}
                >
                  {busy.swap ? "Đang đổi…" : "Đổi vị trí"}
                </button>
              </div>
            </div>
          </div>

          {/* 5) Ghép hoặc tách bàn */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🧩</span>
              <div>
                <div className="talite-label">Ghép hoặc tách bàn</div>
                <div className="talite-group-sub">
                  Ghép các bàn gần nhau cho nhóm đông; tách lại sau khi phục vụ xong.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">
                  Mã các bàn cần ghép
                </label>
                <input
                  className="talite-input"
                  placeholder="Ví dụ: A2, A3"
                  value={mergeCodes}
                  onChange={(e) => setMergeCodes(e.target.value)}
                />
              </div>
              <div
                className="actions-end"
                style={{ alignItems: "end", gap: ".5rem" }}
              >
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy.merge}
                  onClick={handleMerge}
                >
                  {busy.merge ? "Đang ghép…" : "Ghép bàn"}
                </button>
                <button
                  type="button"
                  className={`btn ${table?.joinGroupId ? "ghost" : "disabled"}`}
                  disabled={!table?.joinGroupId || busy.split || busy.splitAll}
                  onClick={handleSplitOut}
                >
                  {busy.split ? "Đang tách…" : "Tách bàn này"}
                </button>
                {table?.joinGroupId && (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy.split || busy.splitAll}
                    onClick={handleSplitAll}
                  >
                    {busy.splitAll ? "Đang tách nhóm…" : "Tách cả nhóm"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 6) Đặt cọc & Ưu đãi */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🎁</span>
              <div>
                <div className="talite-label">Đặt cọc và khuyến mãi</div>
                <div className="talite-group-sub">
                  Chọn mức đặt cọc và khuyến mãi áp dụng cho bàn này.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">Tiền đặt cọc (đồng)</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="VD: 200000"
                />
                <div className="hint">
                  Số tiền này sẽ hiển thị khi khách đặt bàn.
                </div>
              </div>
              <div className="talite-promo-box">
                <div className="talite-label">Khuyến mãi đang hiệu lực</div>
                {promotionsLoading ? (
                  <div className="hint">Đang tải khuyến mãi...</div>
                ) : promotionsError ? (
                  <div className="hint">Không tải được khuyến mãi của chi nhánh này.</div>
                ) : allPromotions?.length ? (
                  <div className="talite-promo-list">
                    {allPromotions.map((promo) => (
                      <label key={promo.id} className="talite-check">
                        <input
                          type="checkbox"
                          checked={selectedPromotions.includes(promo.id)}
                          onChange={() => togglePromotion(promo.id)}
                        />
                        <span>{promo.name || promo.code || "Khuyến mãi chưa đặt tên"}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="hint">Chi nhánh chưa có khuyến mãi đang hiệu lực.</div>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="talite-label">
                  Quyền lợi thêm
                </label>
                <div className="talite-quick">
                  <input
                    className="talite-input"
                    value={quickPerk}
                    onChange={(e) => setQuickPerk(e.target.value)}
                    placeholder="Ví dụ: Tặng nước, tặng món tráng miệng..."
                  />
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={handleAddQuickPerk}
                  >
                    Thêm
                  </button>
                </div>
                {manualPerks.length ? (
                  <div className="talite-perk-tags">
                    {manualPerks.map((perk) => (
                      <span key={perk} className="talite-perk">
                        {perk}
                        <button
                          type="button"
                          onClick={() => removePerk(perk)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="hint">Chưa có quyền lợi thêm.</div>
                )}
              </div>
            </div>
          </div>

          {/* 7) Chính sách đặt bàn */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">📝</span>
              <div>
                <div className="talite-label">Chính sách đặt bàn</div>
                <div className="talite-group-sub">
                  Quy định thời gian giữ bàn, mức chi và điều kiện hủy.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">Thời gian giữ bàn (phút)</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={holdMinutes}
                  onChange={(e) => setHoldMinutes(e.target.value)}
                  placeholder="VD: 15"
                />
              </div>
              <div>
                <label className="talite-label">Mức chi tối thiểu (đồng)</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={minSpend}
                  onChange={(e) => setMinSpend(e.target.value)}
                  placeholder="VD: 500000"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="talite-label">Điều kiện hủy đặt bàn</label>
                <textarea
                  className="talite-input"
                  rows={3}
                  value={cancelPolicy}
                  onChange={(e) => setCancelPolicy(e.target.value)}
                  placeholder="Ví dụ: Hủy trước 2 giờ để được hoàn cọc..."
                />
              </div>
            </div>
          </div>

          {/* 8) AI gợi ý */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🤖</span>
              <div>
                <div className="talite-label">Trợ lý vận hành bàn</div>
                <div className="talite-group-sub">
                  Dựa trên bàn trống cùng tầng, lịch sử phục vụ và khuyến mãi đang hiệu lực.
                </div>
              </div>
            </div>
            <div className="talite-ai-grid">
              <button
                type="button"
                className="btn ghost"
                onClick={handleSuggestMergeAI}
                disabled={aiLoading.merge}
              >
                {aiLoading.merge ? "Đang phân tích..." : "Gợi ý bàn nên ghép"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={handleSuggestPromoAI}
                disabled={aiLoading.promo}
              >
                {aiLoading.promo ? "Đang phân tích..." : "Gợi ý khuyến mãi phù hợp"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={handlePredictTurnoverAI}
                disabled={aiLoading.turnover}
              >
                {aiLoading.turnover
                  ? "Đang phân tích..."
                  : "Ước tính thời điểm bàn trống"}
              </button>
            </div>
            <div className="talite-ai-results">
              {aiSuggestions.merge && (
                <div className="talite-ai-card">
                  <strong>{aiSuggestions.merge.title}</strong>
                  <p>{aiSuggestions.merge.detail}</p>
                </div>
              )}
              {aiSuggestions.promo && (
                <div className="talite-ai-card">
                  <strong>{aiSuggestions.promo.title}</strong>
                  <p>{aiSuggestions.promo.detail}</p>
                </div>
              )}
              {aiSuggestions.turnover && (
                <div className="talite-ai-card">
                  <strong>{aiSuggestions.turnover.title}</strong>
                  <p>{aiSuggestions.turnover.detail}</p>
                </div>
              )}
            </div>
          </div>

          {/* Delete */}
          <div className="actions-end">
            {hasVisualConfig && (
              <div className="talite-group" style={{ width: "100%" }}>
                <div className="talite-label">Cấu hình mô phỏng</div>
                <div className="actions" style={{ justifyContent: "flex-start", gap: 8 }}>
                  <button type="button" className="btn" onClick={() => setCameraPreviewOpen(true)}>
                    Xem lại mô phỏng
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy.clearVisual}
                    onClick={async () => {
                      const confirmed = window.confirm("Bạn muốn xóa cấu hình xem thử bằng camera của bàn này?");
                      if (!confirmed) return;
                      setBusyKey("clearVisual", true);
                      try {
                        await actions.updateTable({ id: table.id, visualConfig: null });
                        await onUpdated?.();
                        showNotification("Đã xóa cấu hình xem thử bằng camera.", "success");
                      } catch (error) {
                        showNotification(
                          resolveTableActionError(error, "Không thể xóa cấu hình xem thử."),
                          "error"
                        );
                      } finally {
                        setBusyKey("clearVisual", false);
                      }
                    }}
                  >
                    {busy.clearVisual ? "Đang xóa..." : "Xóa cấu hình mô phỏng"}
                  </button>
                </div>
              </div>
            )}
            <button type="button"
              className="btn danger"
              disabled={busy.delete || !!deleteDisabledReason}
              title={deleteDisabledReason || ""}
              onClick={handleDelete}
            >
              {busy.delete ? "Đang xoá…" : "Xóa bàn"}
            </button>
            {deleteDisabledReason && <div className="hint">{deleteDisabledReason}</div>}
          </div>
        </div>

        {/* Footer */}
        <div className="talite-footer">
          <div className="actions">
            <button type="button" className="btn" onClick={() => handleRequestClose("cancel")} disabled={isVrSaving}>
              Đóng
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleSaveBasics}
              disabled={isVrSaving}
            >
              {busy.save
                ? "Đang lưu…"
                : vrUploading
                  ? "Đang xử lý ảnh…"
                  : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>

      {/* Style (không dùng jsx attr để tránh warning) */}
      <style>
        {`
        .talite-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
        .talite-modal{width:min(960px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(2,6,23,.35)}
        .talite-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e8f0}
        .talite-title{font-size:18px;font-weight:700;color:#0f172a;margin:0}
        .talite-subtitle{margin:4px 0 0;font-size:12px;color:#64748b}
        .talite-close{border:none;background:transparent;font-size:28px;line-height:1;cursor:pointer}
        .talite-body{padding:12px 16px 4px}
        .talite-footer{padding:12px 16px;border-top:1px solid #e2e8f0}
        .talite-info{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px}
        .kv{display:flex;gap:6px}
        .k{color:#64748b}
        .v{color:#0f172a;font-weight:600}
        .talite-group{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:10px 0}
        .talite-label{font-weight:600;margin-bottom:6px;color:#0f172a}
        .talite-group-header{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
        .talite-group-icon{width:28px;height:28px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;display:inline-flex;align-items:center;justify-content:center}
        .talite-group-sub{font-size:12px;color:#94a3b8}
        .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .talite-input{width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:14px;outline:none}
        .talite-input:focus{border-color:#b89365;box-shadow:0 0 0 3px rgba(184,147,101,.2)}
        .talite-vr-block{grid-column:1/-1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}
        .talite-vr-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .talite-vr-title{font-weight:700;color:#0f172a}
        .talite-vr-sub{font-size:12px;color:#64748b}
        .talite-vr-badge{background:#fff;border:1px solid #b89365;color:#b89365;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}
        .talite-vr-state{font-size:12px;border-radius:8px;padding:8px 10px;border:1px solid}
        .talite-vr-state.ready{background:#ecfdf5;border-color:#86efac;color:#166534}
        .talite-vr-state.pending{background:#fff7ed;border-color:#fdba74;color:#9a3412}
        .talite-upload{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px dashed #e2e8f0;border-radius:10px;padding:10px}
        .talite-upload-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
        .talite-step-chip{display:inline-flex;align-items:center;border-radius:999px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:2px 8px;font-size:11px;font-weight:700}
        .talite-file-picker{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#f8fafc;cursor:pointer}
        .talite-file-input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
        .talite-file-name{font-size:12px;color:#334155;font-weight:600}
        .talite-vr-preview-wrap{display:flex;flex-direction:column;gap:8px;border:1px solid #e2e8f0;border-radius:10px;padding:8px;background:#fff}
        .talite-vr-preview-head{display:flex;align-items:center;gap:8px;font-size:12px;color:#475569;font-weight:600}
        .talite-vr-preview{width:100%;height:180px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc}
        .talite-vr-empty{border:1px dashed #cbd5e1;border-radius:8px;padding:10px;font-size:12px;color:#64748b;background:#f8fafc}
        .talite-vr-feedback{font-size:12px;border-radius:8px;padding:8px 10px;border:1px solid}
        .talite-vr-feedback.success{background:#ecfdf5;border-color:#6ee7b7;color:#047857}
        .talite-vr-feedback.info{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
        .talite-vr-feedback.error{background:#fef2f2;border-color:#fecaca;color:#b91c1c}
        .talite-vr-feedback.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
        .talite-visual-card{grid-column:1/-1;border:1px solid #ddd6fe;background:#f5f3ff;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}
        .talite-visual-card__head{display:flex;gap:10px;align-items:flex-start}
        .talite-visual-card__head p{margin:2px 0 0;color:#6d28d9;font-size:12px}
        .talite-visual-card__icon{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:26px;border-radius:999px;background:#7c3aed;color:#fff;font-weight:800;font-size:12px}
        .talite-visual-card__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px}
        .talite-visual-card__thumb-row img{width:72px;height:54px;object-fit:cover;border-radius:8px;border:1px solid #ddd6fe;background:#fff}
        .talite-vr-inline-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
        .talite-vr-next-step{display:flex;align-items:center;gap:8px;font-size:12px;color:#475569;border-top:1px dashed #e2e8f0;padding-top:8px}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .talite-vr-actions{display:flex;justify-content:flex-end}
        .talite-promo-box{grid-column:1/-1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}
        .talite-promo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .talite-check{display:flex;align-items:center;gap:8px;font-size:13px;color:#0f172a}
        .talite-quick{display:flex;gap:8px;align-items:center}
        .talite-perk-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
        .talite-perk{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:12px}
        .talite-perk button{border:none;background:transparent;cursor:pointer;font-weight:700}
        .talite-ai-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
        .talite-ai-results{display:grid;gap:10px;margin-top:12px}
        .talite-ai-card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc}
        .talite-ai-card p{margin:6px 0 0;font-size:12px;color:#64748b}
        .actions-end{display:flex;justify-content:flex-end;gap:8px}
        .btn{border:1px solid #cbd5e1;background:#fff;padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer}
        .btn.primary{background:#b89365;border-color:#b89365;color:#fff}
        .btn.success{background:#10b981;border-color:#10b981;color:#fff}
        .btn.ghost{background:#fff}
        .btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}
        .btn.disabled{opacity:.5;pointer-events:none}
        .chips{display:flex;flex-wrap:wrap;gap:8px}
        .chip{border:1px solid #e2e8f0;border-radius:999px;padding:6px 10px;background:#fff;cursor:pointer}
        .chip.active{border-color:#b89365;box-shadow:0 0 0 3px rgba(184,147,101,.2)}
        .hint{font-size:12px;color:#64748b;margin-top:4px}
        @media (max-width:680px){.grid2{grid-template-columns:1fr}.talite-promo-list{grid-template-columns:1fr}.talite-quick{flex-direction:column;align-items:stretch}}
        `}
      </style>
      <TableCameraPlacementPreviewModal
        open={cameraPreviewOpen}
        onClose={() => setCameraPreviewOpen(false)}
        modelItem={visualModelItem}
        initialPlacement={table?.visualConfig?.placement}
        confirmLabel="Lưu cấu hình xem thử"
        isConfirming={!!busy.cameraUpdate}
        backendConfigNote={hasVisualConfig ? "Nút Lưu cấu hình xem thử sẽ cập nhật cấu hình của bàn này trên hệ thống." : ""}
        placementScope={`table:${table?.id || "unknown"}`}
        onConfirmPlacement={async (payload) => {
          if (busy.cameraUpdate) return;
          setBusyKey("cameraUpdate", true);
          try {
            await actions.updateTable({
              id: table.id,
              visualConfig: {
                ...(table?.visualConfig || {}),
                placement: payload.placement,
                savedAt: new Date().toISOString(),
              },
            });
            setCameraPreviewOpen(false);
            await onUpdated?.();
            showNotification("Đã cập nhật cấu hình xem thử bằng camera.", "success");
          } catch (error) {
            showNotification(
              resolveTableActionError(error, "Không thể cập nhật cấu hình xem thử."),
              "error"
            );
          } finally {
            setBusyKey("cameraUpdate", false);
          }
        }}
      />
    </div>,
    document.body
  );
}
