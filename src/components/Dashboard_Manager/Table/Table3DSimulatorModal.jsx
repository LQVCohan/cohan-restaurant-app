import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import useTable3DModels from "@/hooks/useTable3DModels";
import { TABLE_3D_TYPE_OPTIONS } from "@/config/table3dCatalog";
import "./Table3DSimulatorModal.scss";

const MODEL_VIEWER_SRC =
  "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";

const DEFAULT_ORBIT = { theta: 0, phi: 75, radius: 2.6 };

const Table3DSimulatorModal = ({
  open,
  onClose,
  onApply,
  currentFloorName,
  restaurantName,
}) => {
  const { modelsByType, loading, error, reload } = useTable3DModels();
  const [tableType, setTableType] = useState(TABLE_3D_TYPE_OPTIONS[0].value);
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, z: 0 });
  const [orbit, setOrbit] = useState(DEFAULT_ORBIT);
  const [modelError, setModelError] = useState("");
  const viewerRef = useRef(null);

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

  const selectedModel = useMemo(
    () => models.find((item) => item.key === selectedModelKey) || models[0] || null,
    [models, selectedModelKey]
  );

  useEffect(() => {
    setSelectedModelKey(models[0]?.key || "");
    setOrbit(DEFAULT_ORBIT);
    setOffset({ x: 0, z: 0 });
    setScale(models[0]?.defaultScale || 1);
  }, [tableType, models]);

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
            {models.map((model) => (
              <button
                key={model.key}
                className={`model-item ${selectedModel?.key === model.key ? "active" : ""}`}
                onClick={() => setSelectedModelKey(model.key)}
                type="button"
              >
                <img src={model.thumbnailUrl} alt={model.label} loading="lazy" />
                <div>
                  <strong>{model.label}</strong>
                  <span>{model.capacity} ghế</span>
                </div>
              </button>
            ))}
            {!models.length && <div className="model-empty">Không có mẫu phù hợp.</div>}
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
        </aside>

        <section className="table-3d-modal__viewer-wrap">
          <div className="viewer-overlay">
            <span>{selectedModel?.label || "Mẫu 3D"}</span>
            {loading && <span>Đang tải catalog...</span>}
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
              variant="primary"
              onClick={() => selectedModel && onApply(selectedModel)}
              disabled={!selectedModel}
            >
              Áp dụng vào form thêm bàn
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export default Table3DSimulatorModal;
