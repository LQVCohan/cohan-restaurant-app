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
  deleteCustomTableModel,
  loadCustomTableModels,
  mergeCatalogWithCustomModels,
  upsertCustomTableModel,
  doesCustomModelMatchTableType,
  getCustomModelCatalogTableType,
} from "@/config/table3dCustomModelStorage";
import "./Table3DSimulatorModal.scss";
import CustomTableModelBuilderModal from "./CustomTableModelBuilderModal";
import TableCameraPlacementPreviewModal from "./TableCameraPlacementPreviewModal";
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

const getCapabilities = () => ({
  secureContext:
    typeof window !== "undefined" ? window.isSecureContext : false,
  camera: Boolean(
    typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia,
  ),
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
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [cameraModel, setCameraModel] = useState(null);
  const [customModels, setCustomModels] = useState([]);
  const [isOpeningAr, setIsOpeningAr] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [pendingDeleteModelKey, setPendingDeleteModelKey] = useState("");
  const [capabilities, setCapabilities] = useState(getCapabilities);
  const viewerRef = useRef(null);
  const customModelScope = restaurantName || restaurantId || "default";

  useEffect(() => {
    if (typeof customElements !== "undefined" && customElements.get("model-viewer")) {
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
    canOpenAr && capabilities.secureContext,
  );
  const arUnavailableReason = !capabilities.secureContext
    ? "AR chỉ hoạt động khi trang được mở bằng HTTPS hoặc localhost."
    : getArUnavailableReason(selectedModel);
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
    if (capabilities.webxr) {
      return {
        tone: "ready",
        label: "Sẵn sàng AR",
        description:
          "Thiết bị hỗ trợ WebXR và có thể đặt thử bàn trong không gian thật.",
      };
    }
    return {
      tone: "limited",
      label: "AR theo thiết bị",
      description:
        "Trình duyệt sẽ thử mở Scene Viewer hoặc Quick Look của thiết bị.",
    };
  }, [capabilities.secureContext, capabilities.webxr, selectedModel]);

  const readinessItems = useMemo(
    () => [
      {
        id: "model",
        label: "Mô hình 3D",
        ready: Boolean(selectedModel?.modelUrl),
        detail: selectedModel?.modelUrl ? "Đã sẵn sàng" : "Chưa có dữ liệu",
      },
      {
        id: "camera",
        label: "Camera",
        ready: capabilities.camera,
        detail: capabilities.camera ? "Có thể sử dụng" : "Chưa khả dụng",
      },
      {
        id: "secure",
        label: "Kết nối an toàn",
        ready: capabilities.secureContext,
        detail: capabilities.secureContext ? "Đã bảo mật" : "Cần HTTPS",
      },
    ],
    [capabilities.camera, capabilities.secureContext, selectedModel],
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
    if (!canLaunchNativeAr) {
      setModelError(arUnavailableReason);
      return;
    }
    if (!viewerRef.current?.activateAR) {
      setModelError(
        "Thiết bị hoặc trình duyệt chưa thể mở camera AR. Hãy thử trên Chrome Android hoặc Safari iPhone.",
      );
      return;
    }

    try {
      setIsOpeningAr(true);
      setModelError("");
      await viewerRef.current.activateAR();
    } catch {
      setModelError(
        "Không thể mở camera AR trên thiết bị này. Bạn vẫn có thể dùng chế độ xem camera 2D.",
      );
    } finally {
      setIsOpeningAr(false);
    }
  };

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !selectedModel?.modelUrl) return undefined;

    const onError = () => {
      setModelLoading(false);
      setModelError(
        "Không thể tải mô hình 3D. Hãy thử lại hoặc chọn mẫu khác.",
      );
    };
    const onLoad = () => {
      setModelLoading(false);
      setModelLoadProgress(1);
      fitModelToView();
    };
    const onProgress = (event) =>
      setModelLoadProgress(
        Math.max(
          0,
          Math.min(1, Number(event?.detail?.totalProgress || 0)),
        ),
      );

    viewer.addEventListener("error", onError);
    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("progress", onProgress);
    return () => {
      viewer.removeEventListener("error", onError);
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("progress", onProgress);
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
          onCreateCustomModel={() => setShowCustomBuilder(true)}
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
              kiểm tra trong không gian thật.
            </span>
          </div>

          <div className="table-3d-stage">
            {selectedModel?.modelUrl && !modelError ? (
              <model-viewer
                ref={viewerRef}
                src={selectedModel.modelUrl}
                camera-controls
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-scale="fixed"
                touch-action="pan-y"
                camera-orbit={cameraOrbit}
                camera-target={cameraTarget}
                model-scale={`${scale} ${scale} ${scale}`}
                shadow-intensity="1"
                environment-image="neutral"
                className="table-3d-viewer"
              />
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

            {modelLoading && selectedModel?.modelUrl && (
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
            selectedModel={selectedModel}
            canPreviewCamera={capabilities.camera}
            onOpenCamera={() => selectedModel && setCameraModel(selectedModel)}
            canLaunchNativeAr={canLaunchNativeAr}
            isOpeningAr={isOpeningAr}
            arUnavailableReason={arUnavailableReason}
            onOpenNativeAr={handleOpenNativeAr}
          />
        </section>
      </div>

      <CustomTableModelBuilderModal
        open={showCustomBuilder}
        onClose={() => setShowCustomBuilder(false)}
        onApply={(customItem) => {
          const saved = upsertCustomTableModel(customItem, customModelScope);
          setCustomModels(saved);
          setTableType(getCustomModelCatalogTableType(customItem));
          setSelectedModelKey(customItem.key);
          setShowCustomBuilder(false);
        }}
      />
      <TableCameraPlacementPreviewModal
        open={Boolean(cameraModel)}
        modelItem={cameraModel}
        onClose={() => setCameraModel(null)}
      />
    </Modal>
  );
}
