import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Box, Loader2 } from "lucide-react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import useTable3DModels from "@/hooks/useTable3DModels";
import {
  TABLE_3D_PLACEHOLDER_THUMB,
  canOpenModelViewerAr,
  getArUnavailableReason,
  getModelAssetSummary,
} from "@/config/table3dCatalog";
import {
  clearTable3DBuilderSessionState,
  getTable3DBuilderSessionState,
  setTable3DBuilderSessionState,
} from "@/utils/aiTableCaptureDraft";
import {
  deleteCustomTableModel,
  loadCustomTableModels,
  mergeCatalogWithCustomModels,
  upsertCustomTableModel,
  doesCustomModelMatchTableType,
  getCustomModelCatalogTableType,
} from "@/config/table3dCustomModelStorage";
import "./Table3DSimulatorModal.scss";
import CustomTableModelBuilderModal from "./CustomTableModelBuilderModal";
import Table3DCatalogPanel from "./Table3DCatalogPanel";
import {
  Table3DActionBar,
  Table3DQuickGuide,
  Table3DReadiness,
  Table3DToolbar,
} from "./Table3DExperienceControls";

const MODEL_VIEWER_SRC =
  "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
const ALL_TABLE_TYPES = "all";
const DEFAULT_ORBIT = { theta: 0, phi: 75, radius: "auto" };
const DEFAULT_OFFSET = { x: 0, z: 0, auto: true };
const AR_CAPABILITY_RETRY_MS = 120;
const AR_CAPABILITY_MAX_ATTEMPTS = 30;

const getCapabilities = () => ({
  secureContext:
    typeof window !== "undefined" ? window.isSecureContext : false,
  webxr: null,
});

export default function Table3DSimulatorModalV2({
  open,
  onClose,
  restaurantName,
  restaurantId,
}) {
  const {
    models: catalogModels,
    modelsByType,
    loading,
    error,
    reload,
  } = useTable3DModels();
  const [tableType, setTableType] = useState(ALL_TABLE_TYPES);
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState(DEFAULT_OFFSET);
  const [orbit, setOrbit] = useState(DEFAULT_ORBIT);
  const [modelError, setModelError] = useState("");
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [modelViewerCanActivateAr, setModelViewerCanActivateAr] = useState(null);
  const [showCustomBuilder, setShowCustomBuilder] = useState(
    () => getTable3DBuilderSessionState().open,
  );
  const [customModels, setCustomModels] = useState([]);
  const [isOpeningAr, setIsOpeningAr] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [pendingDeleteModelKey, setPendingDeleteModelKey] = useState("");
  const [capabilities, setCapabilities] = useState(getCapabilities);
  const viewerRef = useRef(null);
  const customModelScope = restaurantName || restaurantId || "default";

  const openCustomBuilder = () => {
    setTable3DBuilderSessionState({ open: true });
    setShowCustomBuilder(true);
  };

  const closeCustomBuilder = () => {
    clearTable3DBuilderSessionState();
    setShowCustomBuilder(false);
  };

  useEffect(() => {
    if (
      typeof customElements !== "undefined" &&
      customElements.get("model-viewer")
    ) {
      return undefined;
    }

    const existingScript = document.querySelector(
      `script[src="${MODEL_VIEWER_SRC}"]`,
    );
    if (existingScript) return undefined;

    const script = document.createElement("script");
    script.type = "module";
    script.src = MODEL_VIEWER_SRC;
    script.dataset.cohanModelViewer = "true";
    script.addEventListener("error", () => {
      setModelError(
        "Không tải được trình xem 3D. Hãy kiểm tra kết nối mạng rồi thử lại.",
      );
    });
    document.head.appendChild(script);
    return undefined;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    setCapabilities(getCapabilities());
    setCustomModels(loadCustomTableModels(customModelScope));
    setPendingDeleteModelKey("");

    const detectWebXr = async () => {
      if (!navigator?.xr?.isSessionSupported) {
        if (!cancelled) {
          setCapabilities((previous) => ({ ...previous, webxr: false }));
        }
        return;
      }

      try {
        const supported = await navigator.xr.isSessionSupported("immersive-ar");
        if (!cancelled) {
          setCapabilities((previous) => ({ ...previous, webxr: supported }));
        }
      } catch {
        if (!cancelled) {
          setCapabilities((previous) => ({ ...previous, webxr: false }));
        }
      }
    };

    detectWebXr();
    return () => {
      cancelled = true;
    };
  }, [customModelScope, open]);

  const catalogForType = useMemo(() => {
    if (tableType === ALL_TABLE_TYPES) return catalogModels || [];
    return (modelsByType[tableType] || []).filter(
      (model) => model.tableType === tableType,
    );
  }, [catalogModels, modelsByType, tableType]);

  const customForType = useMemo(() => {
    if (tableType === ALL_TABLE_TYPES) return customModels;
    return customModels.filter((model) =>
      doesCustomModelMatchTableType(model, tableType),
    );
  }, [customModels, tableType]);

  const allModels = useMemo(
    () => mergeCatalogWithCustomModels(catalogForType, customForType),
    [catalogForType, customForType],
  );

  const filteredModels = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    return allModels.filter((model) => {
      const haystack = [
        model.label,
        model.tableType,
        model.source,
        model.sourceLabel,
        model.licenseLabel,
        ...(model.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const hasModel = canOpenModelViewerAr(model);
      const matchesAsset =
        assetFilter === "all" ||
        (assetFilter === "model" && hasModel) ||
        (assetFilter === "placeholder" && !hasModel);
      return matchesSearch && matchesAsset;
    });
  }, [allModels, assetFilter, catalogSearch]);

  const selectedModel = useMemo(
    () =>
      allModels.find((item) => item.key === selectedModelKey) ||
      allModels[0] ||
      null,
    [allModels, selectedModelKey],
  );

  useEffect(() => {
    setSelectedModelKey((currentKey) =>
      allModels.some((model) => model.key === currentKey)
        ? currentKey
        : allModels[0]?.key || "",
    );
  }, [allModels]);

  useEffect(() => {
    if (!selectedModel) return;
    setScale(selectedModel.defaultScale || 1);
    setOrbit(DEFAULT_ORBIT);
    setOffset(DEFAULT_OFFSET);
    setModelError("");
    setModelLoading(Boolean(selectedModel.modelUrl));
    setModelLoadProgress(0);
    setModelViewerCanActivateAr(null);
    setPendingDeleteModelKey("");
  }, [selectedModel]);

  const cameraOrbit = `${orbit.theta}deg ${orbit.phi}deg ${
    orbit.radius === "auto" ? "auto" : `${orbit.radius}m`
  }`;
  const cameraTarget = offset.auto
    ? "auto auto auto"
    : `${offset.x}m 0m ${offset.z}m`;
  const canOpenAr = canOpenModelViewerAr(selectedModel);
  const canLaunchNativeAr = Boolean(
    canOpenAr &&
      capabilities.secureContext &&
      !modelLoading &&
      modelViewerCanActivateAr === true,
  );
  const arUnavailableReason = !canOpenAr
    ? getArUnavailableReason(selectedModel)
    : !capabilities.secureContext
      ? "AR chỉ hoạt động khi trang được mở bằng HTTPS hoặc localhost."
      : modelLoading || modelViewerCanActivateAr == null
        ? "Đang tải mô hình và kiểm tra khả năng AR của thiết bị."
        : !modelViewerCanActivateAr
          ? "Thiết bị hoặc trình duyệt chưa hỗ trợ WebXR, Scene Viewer hoặc Quick Look."
          : "";
  const selectedModelAssetSummary = getModelAssetSummary(selectedModel);
  const isSelectedModelHiddenByFilters = Boolean(
    selectedModel &&
      !filteredModels.some((model) => model.key === selectedModel.key),
  );

  const arStatus = useMemo(() => {
    if (!selectedModel) {
      return {
        tone: "neutral",
        label: "Chưa chọn mẫu",
        description: "Chọn một mẫu bàn để bắt đầu xem thử.",
      };
    }
    if (!selectedModel.modelUrl) {
      return {
        tone: "warning",
        label: "Chưa có model 3D",
        description:
          "Mẫu này chỉ có ảnh minh họa nên chưa thể mở bằng camera AR.",
      };
    }
    if (!capabilities.secureContext) {
      return {
        tone: "warning",
        label: "Cần HTTPS",
        description:
          "Hãy mở trang bằng HTTPS hoặc localhost để sử dụng camera AR.",
      };
    }
    if (modelLoading || modelViewerCanActivateAr == null) {
      return {
        tone: "neutral",
        label: "Đang kiểm tra AR",
        description: "Đang tải mô hình và kiểm tra khả năng AR của thiết bị.",
      };
    }
    if (!modelViewerCanActivateAr) {
      return {
        tone: "limited",
        label: "Thiết bị chưa hỗ trợ AR",
        description:
          "Thiết bị hoặc trình duyệt không có WebXR, Scene Viewer hay Quick Look khả dụng.",
      };
    }
    if (capabilities.webxr) {
      return {
        tone: "ready",
        label: "Sẵn sàng quét sàn",
        description:
          "WebXR sẽ nhận diện mặt phẳng sàn trước khi đặt mô hình bàn.",
      };
    }
    return {
      tone: "ready",
      label: "AR theo thiết bị",
      description:
        "Mô hình sẽ mở bằng Scene Viewer hoặc Quick Look để nhận diện mặt phẳng.",
    };
  }, [
    capabilities.secureContext,
    capabilities.webxr,
    modelLoading,
    modelViewerCanActivateAr,
    selectedModel,
  ]);

  const readinessItems = useMemo(
    () => [
      {
        id: "model",
        label: "Mô hình 3D",
        ready: Boolean(selectedModel?.modelUrl),
        detail: selectedModel?.modelUrl ? "Đã sẵn sàng" : "Chưa có dữ liệu",
      },
      {
        id: "secure",
        label: "Kết nối an toàn",
        ready: capabilities.secureContext,
        detail: capabilities.secureContext ? "Đã bảo mật" : "Cần HTTPS",
      },
      {
        id: "device-ar",
        label: "AR trên thiết bị",
        ready: modelViewerCanActivateAr === true,
        detail:
          modelLoading || modelViewerCanActivateAr == null
            ? "Đang kiểm tra"
            : modelViewerCanActivateAr
              ? "Có thể mở AR"
              : "Chưa được hỗ trợ",
      },
    ],
    [
      capabilities.secureContext,
      modelLoading,
      modelViewerCanActivateAr,
      selectedModel,
    ],
  );

  const fitModelToView = () => {
    setOrbit(DEFAULT_ORBIT);
    setOffset(DEFAULT_OFFSET);
    setScale(selectedModel?.defaultScale || 1);
    window.requestAnimationFrame(() => {
      try {
        viewerRef.current?.updateFraming?.();
        viewerRef.current?.jumpCameraToGoal?.();
      } catch {
        // Auto camera orbit remains the fallback.
      }
    });
  };

  const shiftModel = (x, z) =>
    setOffset((previous) => ({
      x: Number(((previous.auto ? 0 : previous.x) + x).toFixed(2)),
      z: Number(((previous.auto ? 0 : previous.z) + z).toFixed(2)),
      auto: false,
    }));
  const rotateModel = (delta) =>
    setOrbit((previous) => ({ ...previous, theta: previous.theta + delta }));
  const zoomModel = (delta) =>
    setOrbit((previous) => {
      const radius =
        previous.radius === "auto" ? 2.6 : Number(previous.radius || 2.6);
      return {
        ...previous,
        radius: Math.max(
          1.1,
          Math.min(5, Number((radius + delta).toFixed(2))),
        ),
      };
    });

  const handleDeleteCustomModel = (event, model) => {
    event.stopPropagation();
    if (pendingDeleteModelKey !== model.key) {
      setPendingDeleteModelKey(model.key);
      return;
    }
    const saved = deleteCustomTableModel(model.key, customModelScope);
    setCustomModels(saved);
    setPendingDeleteModelKey("");
  };

  const handleOpenNativeAr = async () => {
    const viewer = viewerRef.current;
    const viewerCanOpen = Boolean(viewer?.activateAR && viewer?.canActivateAR);
    if (!canLaunchNativeAr && !viewerCanOpen) {
      setModelError(arUnavailableReason);
      return;
    }
    if (!viewerCanOpen) {
      setModelViewerCanActivateAr(false);
      setModelError(
        "Thiết bị hoặc trình duyệt chưa thể mở AR. Hãy thử Chrome trên Android có ARCore hoặc Safari trên iPhone/iPad.",
      );
      return;
    }

    try {
      setIsOpeningAr(true);
      setModelError("");
      viewer.setAttribute("ar-scale", "auto");
      await viewer.activateAR();
    } catch {
      setModelError(
        "Không thể mở camera AR trên thiết bị này. Hãy kiểm tra quyền camera, HTTPS và hỗ trợ AR của thiết bị.",
      );
    } finally {
      setIsOpeningAr(false);
    }
  };

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !selectedModel?.modelUrl) return undefined;

    let capabilityTimer = null;
    let capabilityAttempts = 0;
    let disposed = false;

    const syncArCapability = () => {
      if (disposed) return;
      const canActivate = Boolean(viewer.canActivateAR);
      if (canActivate) {
        setModelViewerCanActivateAr(true);
        return;
      }

      capabilityAttempts += 1;
      if (viewer.loaded && capabilityAttempts < AR_CAPABILITY_MAX_ATTEMPTS) {
        capabilityTimer = window.setTimeout(
          syncArCapability,
          AR_CAPABILITY_RETRY_MS,
        );
        return;
      }

      if (viewer.loaded) setModelViewerCanActivateAr(false);
    };

    const onError = () => {
      if (disposed) return;
      setModelLoading(false);
      setModelViewerCanActivateAr(false);
      setModelError(
        "Không thể tải mô hình 3D. Hãy thử lại hoặc chọn mẫu khác.",
      );
    };
    const onLoad = () => {
      if (disposed) return;
      setModelLoading(false);
      setModelLoadProgress(1);
      capabilityAttempts = 0;
      syncArCapability();
      fitModelToView();
    };
    const onProgress = (event) =>
      setModelLoadProgress(
        Math.max(
          0,
          Math.min(1, Number(event?.detail?.totalProgress || 0)),
        ),
      );
    const onArStatus = (event) => {
      if (disposed) return;
      const status = event?.detail?.status;
      if (status === "failed") {
        setModelViewerCanActivateAr(false);
        setModelError(
          "Phiên AR không khởi động được. Hãy kiểm tra quyền camera và hỗ trợ AR của thiết bị.",
        );
        return;
      }
      syncArCapability();
    };

    viewer.addEventListener("error", onError);
    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("progress", onProgress);
    viewer.addEventListener("ar-status", onArStatus);

    if (viewer.loaded) {
      onLoad();
    } else {
      syncArCapability();
    }

    return () => {
      disposed = true;
      if (capabilityTimer) window.clearTimeout(capabilityTimer);
      viewer.removeEventListener("error", onError);
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("progress", onProgress);
      viewer.removeEventListener("ar-status", onArStatus);
    };
  }, [selectedModel?.key, selectedModel?.modelUrl]);

  const handleThumbnailError = (event) => {
    if (event.currentTarget.src !== TABLE_3D_PLACEHOLDER_THUMB) {
      event.currentTarget.src = TABLE_3D_PLACEHOLDER_THUMB;
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="full"
      className="table-3d-modal"
    >
      <div className="table-3d-modal__header">
        <div className="table-3d-modal__heading">
          <div className="table-3d-modal__title-row">
            <Box size={18} aria-hidden="true" />
            <h3>Xem thử bàn 3D trong không gian</h3>
            <span
              className={`table-3d-ar-status table-3d-ar-status--${arStatus.tone}`}
              title={arStatus.description}
            >
              Trạng thái AR: {arStatus.label}
            </span>
          </div>
          <p>
            {selectedModel?.label || "Chưa chọn mẫu"} ·{" "}
            {restaurantName || "Nhà hàng hiện tại"}
          </p>
        </div>
        <div className="table-3d-modal__header-actions">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>

      <div className="table-3d-modal__layout">
        <Table3DCatalogPanel
          tableType={tableType}
          onTableTypeChange={setTableType}
          catalogSearch={catalogSearch}
          onCatalogSearchChange={setCatalogSearch}
          assetFilter={assetFilter}
          onAssetFilterChange={setAssetFilter}
          filteredModels={filteredModels}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModelKey}
          onModelKeyDown={(event, model) => {
            if (
              event.target === event.currentTarget &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              setSelectedModelKey(model.key);
            }
          }}
          onThumbnailError={handleThumbnailError}
          loading={loading}
          error={error}
          onReload={reload}
          onCreateCustomModel={openCustomBuilder}
          pendingDeleteModelKey={pendingDeleteModelKey}
          onDeleteCustomModel={handleDeleteCustomModel}
          isSelectedModelHiddenByFilters={isSelectedModelHiddenByFilters}
          selectedModelAssetSummary={selectedModelAssetSummary}
        />

        <section className="table-3d-modal__viewer-wrap">
          <div className="viewer-overlay">
            <div>
              <span>{selectedModel?.label || "Mẫu bàn 3D"}</span>
              <small>{selectedModel?.capacity || 0} ghế</small>
            </div>
            <span>
              Chọn mẫu có sẵn, nhập URL hoặc upload .glb rồi mở camera AR để
              quét mặt sàn và kiểm tra trong không gian thật.
            </span>
          </div>

          <div className="table-3d-stage">
            {!showCustomBuilder && selectedModel?.modelUrl && !modelError ? (
              <model-viewer
                ref={viewerRef}
                src={selectedModel.modelUrl}
                camera-controls
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-placement="floor"
                ar-scale="auto"
                xr-environment
                touch-action="pan-y"
                camera-orbit={cameraOrbit}
                camera-target={cameraTarget}
                scale={`${scale} ${scale} ${scale}`}
                shadow-intensity="1"
                environment-image="neutral"
                className="table-3d-viewer"
              >
                <button
                  slot="ar-button"
                  type="button"
                  hidden
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </model-viewer>
            ) : (
              <div className="viewer-placeholder">
                <Box size={28} aria-hidden="true" />
                <strong>
                  {selectedModel
                    ? "Mẫu này chưa có mô hình 3D"
                    : "Chưa chọn mẫu bàn"}
                </strong>
                <span>
                  {selectedModel
                    ? "Chọn mẫu có nhãn 3D hoặc dùng Tạo mẫu mới để nhập URL/upload file."
                    : "Hãy chọn một mẫu trong thư viện để bắt đầu."}
                </span>
              </div>
            )}

            {!showCustomBuilder && modelLoading && selectedModel?.modelUrl && (
              <div className="table-3d-model-loading" role="status">
                <Loader2 size={24} className="spin" aria-hidden="true" />
                <strong>Đang tải mô hình 3D</strong>
                <div className="table-3d-loading-bar">
                  <span
                    style={{
                      width: `${Math.round(modelLoadProgress * 100)}%`,
                    }}
                  />
                </div>
                <small>{Math.round(modelLoadProgress * 100)}%</small>
              </div>
            )}
          </div>

          {modelError && (
            <div
              className="table-3d-modal__warning table-3d-modal__warning--viewer"
              role="alert"
            >
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{modelError}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setModelError("");
                  setModelLoading(Boolean(selectedModel?.modelUrl));
                  setModelViewerCanActivateAr(null);
                  reload();
                }}
              >
                Thử lại
              </Button>
            </div>
          )}

          <Table3DToolbar
            rotateModel={rotateModel}
            zoomModel={zoomModel}
            fitModelToView={fitModelToView}
            shiftModel={shiftModel}
            scale={scale}
            onScaleChange={setScale}
            resetView={fitModelToView}
          />
          <Table3DReadiness
            arStatus={arStatus}
            readinessItems={readinessItems}
          />
          <Table3DQuickGuide />
          <Table3DActionBar
            canLaunchNativeAr={canLaunchNativeAr}
            isOpeningAr={isOpeningAr}
            arUnavailableReason={arUnavailableReason}
            onOpenNativeAr={handleOpenNativeAr}
          />
        </section>
      </div>

      <CustomTableModelBuilderModal
        open={showCustomBuilder}
        onClose={closeCustomBuilder}
        draftScope={customModelScope}
        onApply={(customItem) => {
          const saved = upsertCustomTableModel(customItem, customModelScope);
          setCustomModels(saved);
          setTableType(getCustomModelCatalogTableType(customItem));
          setSelectedModelKey(customItem.key);
          closeCustomBuilder();
        }}
      />
    </Modal>
  );
}
