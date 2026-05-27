import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import useTable3DModels from "@/hooks/useTable3DModels";
import { TABLE_3D_TYPE_OPTIONS } from "@/config/table3dCatalog";
import {
  deleteCustomTableModel,
  isCustomTableModel,
  loadCustomTableModels,
  mergeCatalogWithCustomModels,
  upsertCustomTableModel,
  doesCustomModelMatchTableType,
  getCustomModelCatalogTableType,
} from "@/config/table3dCustomModelStorage";
import "./Table3DSimulatorModal.scss";
import CustomTableModelBuilderModal from "./CustomTableModelBuilderModal";
import TableCameraPlacementPreviewModal from "./TableCameraPlacementPreviewModal";

const MODEL_VIEWER_SRC =
  "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";

const DEFAULT_ORBIT = { theta: 0, phi: 75, radius: 2.6 };

const Table3DSimulatorModal = ({
  open,
  onClose,
  onApply,
  currentFloorName,
  restaurantName,
  restaurantId,
}) => {
  const { modelsByType, loading, error, reload } = useTable3DModels();
  const [tableType, setTableType] = useState(TABLE_3D_TYPE_OPTIONS[0].value);
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, z: 0 });
  const [orbit, setOrbit] = useState(DEFAULT_ORBIT);
  const [modelError, setModelError] = useState("");
  const viewerRef = useRef(null);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [cameraModel, setCameraModel] = useState(null);
  const [customModels, setCustomModels] = useState([]);
  const [confirmedCameraPlacement, setConfirmedCameraPlacement] = useState(null);
  const customModelScope = restaurantName || restaurantId || "default";

  useEffect(() => {
    if (customElements.get("model-viewer")) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = MODEL_VIEWER_SRC;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const models = useMemo(
    () => (modelsByType[tableType] || []).filter((model) => model.tableType === tableType),
    [modelsByType, tableType]
  );

  const typedCustomModels = useMemo(
    () => customModels.filter((model) => doesCustomModelMatchTableType(model, tableType)),
    [customModels, tableType]
  );

  const allModels = useMemo(
    () => mergeCatalogWithCustomModels(models, typedCustomModels),
    [models, typedCustomModels]
  );

  const selectedModel = useMemo(
    () => allModels.find((item) => item.key === selectedModelKey) || allModels[0] || null,
    [allModels, selectedModelKey]
  );

  useEffect(() => {
    if (!open) return;
    setCustomModels(loadCustomTableModels(customModelScope));
  }, [open, customModelScope]);

  useEffect(() => {
    setSelectedModelKey(allModels[0]?.key || "");
    setOrbit(DEFAULT_ORBIT);
    setOffset({ x: 0, z: 0 });
    setScale(allModels[0]?.defaultScale || 1);
  }, [tableType, allModels]);

  useEffect(() => {
    if (!selectedModel) return;
    setScale(selectedModel.defaultScale || 1);
    setModelError("");
  }, [selectedModel]);

  const modelScale = `${scale} ${scale} ${scale}`;
  const cameraOrbit = `${orbit.theta}deg ${orbit.phi}deg ${orbit.radius}m`;
  const cameraTarget = `${offset.x}m 0m ${offset.z}m`;

  const shiftModel = (x, z) => {
    setOffset((prev) => ({ x: Number((prev.x + x).toFixed(2)), z: Number((prev.z + z).toFixed(2)) }));
  };

  const rotateModel = (delta) => {
    setOrbit((prev) => ({ ...prev, theta: prev.theta + delta }));
  };

  const zoomModel = (delta) => {
    setOrbit((prev) => ({ ...prev, radius: Math.max(1.2, Math.min(5, Number((prev.radius + delta).toFixed(2)))) }));
  };

  const resetView = () => {
    setOrbit(DEFAULT_ORBIT);
    setOffset({ x: 0, z: 0 });
    if (selectedModel?.defaultScale) setScale(selectedModel.defaultScale);
  };

  const handleModelItemKeyDown = (event, model) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelectedModelKey(model.key);
  };

  const handleDeleteCustomModel = (event, model) => {
    event.stopPropagation();
    if (!window.confirm(`Xóa mẫu "${model.label}" khỏi thư viện tùy chỉnh?`)) return;

    const saved = deleteCustomTableModel(model.key, customModelScope);
    setCustomModels(saved);
    if (selectedModel?.key === model.key) {
      const nextVisible = mergeCatalogWithCustomModels(
        models,
        saved.filter((item) => doesCustomModelMatchTableType(item, tableType))
      );
      setSelectedModelKey(nextVisible[0]?.key || "");
    }
  };

  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !selectedModel?.modelUrl) return undefined;
    const handleError = () => setModelError("Không tải được model, hãy đổi mẫu khác.");
    node.addEventListener("error", handleError);
    return () => node.removeEventListener("error", handleError);
  }, [selectedModel?.key, selectedModel?.modelUrl]);

  return (
    <Modal isOpen={open} onClose={onClose} size="full" className="table-3d-modal">
      <div className="table-3d-modal__header">
        <div>
          <h3>🪑 Mô phỏng 3D đặt thử bàn</h3>
          <p>
            {restaurantName || "Nhà hàng hiện tại"}
            {currentFloorName ? ` • Đang mô phỏng cho ${currentFloorName}` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Đóng
        </Button>
      </div>

      <div className="table-3d-modal__layout">
        <aside className="table-3d-modal__sidebar">
          <label>Loại bàn</label>
          <select value={tableType} onChange={(e) => setTableType(e.target.value)}>
            {TABLE_3D_TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="table-3d-modal__models">
            {allModels.map((model) => (
              <div
                key={model.key}
                className={`model-item ${selectedModel?.key === model.key ? "active" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={selectedModel?.key === model.key}
                onClick={() => setSelectedModelKey(model.key)}
                onKeyDown={(event) => handleModelItemKeyDown(event, model)}
              >
                <img src={model.thumbnailUrl} alt={model.label} loading="lazy" />
                <div>
                  <strong>{model.label}</strong>
                  <span>{model.capacity} ghế</span>
                  {isCustomTableModel(model) && <span>Tùy chỉnh</span>}
                  {model?.customModelSpec && (
                    <span>
                      {model.customModelSpec.widthCm} x {model.customModelSpec.depthCm} x {model.customModelSpec.heightCm} cm
                    </span>
                  )}
                </div>
                {isCustomTableModel(model) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={(event) => handleDeleteCustomModel(event, model)}
                    aria-label={`Xóa mẫu tùy chỉnh ${model.label}`}
                    title={`Xóa mẫu tùy chỉnh ${model.label}`}
                  >
                    Xóa
                  </Button>
                )}
              </div>
            ))}
            {!allModels.length && (
              <div className="model-empty">
                Không có mẫu phù hợp cho loại bàn này. Hãy thử tab khác hoặc tạo mẫu tùy chỉnh mới.
              </div>
            )}
          </div>

          <div className="table-3d-modal__meta">
            <p>
              <b>Nguồn:</b> {selectedModel?.source || "-"}
            </p>
            <p>
              <b>Ghế gợi ý:</b> {selectedModel?.capacity || "-"}
            </p>
            <p>
              <b>Model key:</b> {selectedModel?.key || "-"}
            </p>
          </div>
          {error && <div className="table-3d-modal__warning">{error}</div>}
          <Button variant="secondary" size="sm" onClick={reload}>
            Tải lại catalog online
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCustomBuilder(true)}>
            ✨ Tạo mẫu bàn tùy chỉnh
          </Button>
        </aside>

        <section className="table-3d-modal__viewer-wrap">
          <div className="viewer-overlay">
            <span>{selectedModel?.label || "Mẫu 3D"}</span>
            {loading && <span>Đang tải catalog...</span>}
            {confirmedCameraPlacement && (
              <span>Đã xác nhận vị trí xem thử cho mẫu này</span>
            )}
            {confirmedCameraPlacement &&
              selectedModel &&
              confirmedCameraPlacement.modelKey !== selectedModel.key && (
                <span>
                  Vị trí xem thử đã xác nhận thuộc mẫu khác. Hãy xem thử bằng camera lại nếu
                  muốn lưu cho mẫu này.
                </span>
              )}
          </div>

          {selectedModel?.modelUrl && !modelError ? (
            <model-viewer
              ref={viewerRef}
              src={selectedModel.modelUrl}
              camera-controls
              touch-action="pan-y"
              camera-orbit={cameraOrbit}
              camera-target={cameraTarget}
              model-scale={modelScale}
              shadow-intensity="1"
              environment-image="neutral"
              ar-status="not-presenting"
              className="table-3d-viewer"
            />
          ) : (
            <div className="viewer-placeholder">
              {selectedModel
                ? "Đang dùng placeholder bàn (không có model 3D công khai khả dụng)."
                : "Chọn mẫu để bắt đầu mô phỏng."}
            </div>
          )}

          {modelError && <div className="table-3d-modal__warning">{modelError}</div>}

          <div className="table-3d-modal__controls">
            <Button size="sm" variant="secondary" onClick={() => rotateModel(-15)}>
              ↺ Rotate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => rotateModel(15)}>
              ↻ Rotate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => zoomModel(-0.2)}>
              ＋ Zoom
            </Button>
            <Button size="sm" variant="secondary" onClick={() => zoomModel(0.2)}>
              － Zoom
            </Button>
            <Button size="sm" variant="secondary" onClick={resetView}>
              Reset
            </Button>
          </div>

          <div className="table-3d-modal__controls">
            <Button size="sm" variant="secondary" onClick={() => shiftModel(-0.1, 0)}>
              ← Di chuyển
            </Button>
            <Button size="sm" variant="secondary" onClick={() => shiftModel(0.1, 0)}>
              → Di chuyển
            </Button>
            <Button size="sm" variant="secondary" onClick={() => shiftModel(0, -0.1)}>
              ↑ Di chuyển
            </Button>
            <Button size="sm" variant="secondary" onClick={() => shiftModel(0, 0.1)}>
              ↓ Di chuyển
            </Button>
            <label className="scale-range">
              Scale {scale.toFixed(2)}
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="table-3d-modal__footer">
            <Button
              variant="secondary"
              onClick={() => selectedModel && setCameraModel(selectedModel)}
              disabled={!selectedModel}
              title={selectedModel ? "" : "Vui lòng chọn mẫu bàn trước"}
            >
              📷 Xem thử bằng camera
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                selectedModel &&
                onApply(selectedModel, {
                  visualConfig:
                    confirmedCameraPlacement &&
                    confirmedCameraPlacement.modelKey === selectedModel.key
                      ? confirmedCameraPlacement
                      : null,
                })
              }
              disabled={!selectedModel}
            >
              Áp dụng vào form thêm bàn
            </Button>
          </div>
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
        open={!!cameraModel}
        modelItem={cameraModel}
        onClose={() => setCameraModel(null)}
        onConfirmPlacement={(payload) => {
          setConfirmedCameraPlacement(payload);
          setCameraModel(null);
        }}
        placementScope={customModelScope}
      />
    </Modal>
  );
};

export default Table3DSimulatorModal;
