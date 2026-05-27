import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { CUSTOM_TABLE_SHAPES } from "@/config/table3dCustomModelBuilder";
import { mapTable3DTypeToArea } from "@/config/table3dCatalog";
import { getTableAreaLabel } from "@/utils/tableManagementOptions";
import {
  DEFAULT_CAMERA_PLACEMENT,
  deleteCameraPlacement,
  hasCameraPlacement,
  loadCameraPlacement,
  normalizeCameraPlacement,
  saveCameraPlacement,
} from "@/config/table3dCameraPlacementStorage";
import "./TableCameraPlacementPreviewModal.scss";

const CAMERA_ERROR_MESSAGE =
  "Vui lòng cấp quyền camera hoặc dùng HTTPS.";

const CAMERA_UNSUPPORTED_MESSAGE =
  "Thiết bị/trình duyệt của bạn chưa hỗ trợ mở camera (getUserMedia).";

const shapeLabelMap = CUSTOM_TABLE_SHAPES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const getShapeFromModel = (modelItem) => {
  if (modelItem?.customModelSpec?.shape) return modelItem.customModelSpec.shape;
  if (modelItem?.tableType?.includes("round")) return "round";
  if (modelItem?.tableType?.includes("booth")) return "booth";
  if (modelItem?.tableType?.includes("bar")) return "bar";
  return "rect";
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const buildPreviewModelItemFromVisualConfig = (visualConfig) => {
  const config = visualConfig && typeof visualConfig === "object" ? visualConfig : {};
  const modelKey = config.modelKey || "saved-model";
  const modelLabel = config.modelLabel || config.label || "Mẫu bàn đã lưu";

  return {
    key: modelKey,
    label: modelLabel,
    tableType: config.tableType || null,
    capacity: Number.isFinite(Number(config.capacity)) ? Number(config.capacity) : 4,
    customModelSpec: config.dimensions
      ? {
          name: modelLabel,
          capacity: Number.isFinite(Number(config.capacity)) ? Number(config.capacity) : 4,
          widthCm: Number(config.dimensions.widthCm) || 0,
          depthCm: Number(config.dimensions.depthCm) || 0,
          heightCm: Number(config.dimensions.heightCm) || 0,
          area: config.tableArea || mapTable3DTypeToArea(config.tableType),
          shape: config.shape || "rect",
        }
      : null,
  };
};

const TableCameraPlacementPreviewModal = ({
  open,
  onClose,
  modelItem,
  initialPlacement = null,
  overrideModelSummary = null,
  confirmLabel = "Xác nhận vị trí",
  onConfirmPlacement,
  placementScope = "default",
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [placement, setPlacement] = useState(DEFAULT_CAMERA_PLACEMENT);
  const [placementMessage, setPlacementMessage] = useState("");
  const [savedPlacement, setSavedPlacement] = useState(false);
  const modelKey = modelItem?.key || "preview";

  const modelSummary = useMemo(() => {
    if (overrideModelSummary) {
      return {
        name: overrideModelSummary.name || "Mẫu bàn",
        seats: overrideModelSummary.seats || 4,
        areaLabel: overrideModelSummary.areaLabel || getTableAreaLabel("standard"),
        shape: overrideModelSummary.shape || "rect",
        shapeLabel: overrideModelSummary.shapeLabel || "Bàn chữ nhật",
        dimensions: overrideModelSummary.dimensions || "",
      };
    }
    const shape = getShapeFromModel(modelItem);
    const area = modelItem?.customModelSpec?.area || mapTable3DTypeToArea(modelItem?.tableType);
    return {
      name: modelItem?.label || modelItem?.customModelSpec?.name || "Mẫu bàn",
      seats: modelItem?.customModelSpec?.capacity || modelItem?.capacity || 4,
      areaLabel: getTableAreaLabel(area),
      shape,
      shapeLabel: shapeLabelMap[shape] || "Bàn chữ nhật",
      dimensions: modelItem?.customModelSpec
        ? `${modelItem.customModelSpec.widthCm} x ${modelItem.customModelSpec.depthCm} x ${modelItem.customModelSpec.heightCm} cm`
        : "",
    };
  }, [modelItem, overrideModelSummary]);

  useEffect(() => {
    if (!open) return;
    setPlacement(
      initialPlacement
        ? normalizeCameraPlacement(initialPlacement)
        : loadCameraPlacement(modelKey, placementScope)
    );
    setSavedPlacement(hasCameraPlacement(modelKey, placementScope));
    setPlacementMessage("");
    setCameraError("");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(CAMERA_UNSUPPORTED_MESSAGE);
      return;
    }

    const videoNode = videoRef.current;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoNode) {
          videoNode.srcObject = stream;
        }
      })
      .catch(() => setCameraError(CAMERA_ERROR_MESSAGE));

    return () => {
      stopped = true;
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      if (videoNode) videoNode.srcObject = null;
    };
  }, [open, modelKey, placementScope, initialPlacement]);

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPlacement: placement,
      rect,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dxPercent = ((event.clientX - drag.startX) / drag.rect.width) * 100;
    const dyPercent = ((event.clientY - drag.startY) / drag.rect.height) * 100;
    setPlacement((prev) => ({
      ...prev,
      x: clamp(drag.startPlacement.x + dxPercent, 5, 95),
      y: clamp(drag.startPlacement.y + dyPercent, 5, 95),
    }));
  };

  const handlePointerUp = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="xl">
      <div className="camera-placement-modal">
        <div className="camera-placement-modal__header">
          <h3>📷 Xem thử bằng camera</h3>
          <p>
            Đây là bản xem thử overlay thủ công, chưa phải AR nhận diện mặt phẳng.
          </p>
        </div>

        <div className="camera-placement-modal__preview" ref={previewRef}>
          <video ref={videoRef} autoPlay playsInline muted className="camera-placement-modal__video" />
          <div
            className={`camera-placement-modal__overlay shape-${modelSummary.shape}`}
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              transform: `translate(-50%, -50%) scale(${placement.scale}) rotate(${placement.rotation}deg)`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Overlay mô hình bàn để ước lượng vị trí"
          >
            <strong>{modelSummary.name}</strong>
            <span>{modelSummary.seats} ghế</span>
            <span>{modelSummary.areaLabel}</span>
            <span>{modelSummary.shapeLabel}</span>
            {modelSummary.dimensions && <span>{modelSummary.dimensions}</span>}
            {modelSummary.shape === "booth" && <em className="sofa-badge">Sofa</em>}
          </div>
          {cameraError && <div className="camera-placement-modal__error">{cameraError}</div>}
          <div className="camera-placement-modal__hint">Kéo mẫu bàn để đặt vị trí. Dùng nút để xoay/phóng to.</div>
        </div>

        <div className="camera-placement-modal__controls">
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, scale: clamp(p.scale - 0.1, 0.5, 2) }))}>Thu nhỏ</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, scale: clamp(p.scale + 0.1, 0.5, 2) }))}>Phóng to</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, rotation: p.rotation - 15 }))}>Xoay -15°</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, rotation: p.rotation + 15 }))}>Xoay +15°</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, x: clamp(p.x - 2, 5, 95) }))}>←</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, x: clamp(p.x + 2, 5, 95) }))}>→</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, y: clamp(p.y - 2, 5, 95) }))}>↑</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement((p) => ({ ...p, y: clamp(p.y + 2, 5, 95) }))}>↓</Button>
          <Button size="sm" variant="secondary" onClick={() => setPlacement({ ...DEFAULT_CAMERA_PLACEMENT })}>Reset vị trí</Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              saveCameraPlacement(modelKey, placement, placementScope);
              setSavedPlacement(true);
              setPlacementMessage("Đã lưu vị trí trên trình duyệt này.");
            }}
          >
            Lưu vị trí xem thử
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!savedPlacement}
            onClick={() => {
              deleteCameraPlacement(modelKey, placementScope);
              setSavedPlacement(false);
              setPlacement(DEFAULT_CAMERA_PLACEMENT);
              setPlacementMessage("Đã xóa vị trí đã lưu trên trình duyệt này.");
            }}
          >
            Xóa vị trí đã lưu
          </Button>
        </div>

        <p className="camera-placement-modal__stats">
          x: {placement.x.toFixed(1)}% • y: {placement.y.toFixed(1)}% • scale: {placement.scale.toFixed(2)} • rotation: {placement.rotation.toFixed(0)}°
        </p>

        <p className="camera-placement-modal__note">
          Bản xem trước này chưa lưu vào sơ đồ, chỉ dùng để ước lượng vị trí thực tế.
          Vị trí lưu chỉ áp dụng trên trình duyệt hiện tại và dùng cho lần xem thử tiếp theo.
        </p>
        {placementMessage && <p className="camera-placement-modal__note">{placementMessage}</p>}

        <div className="camera-placement-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>Đóng</Button>
          <Button
            type="button"
            variant="primary"
            onClick={() =>
              onConfirmPlacement?.({
                modelKey: modelItem?.key || "preview",
                modelLabel: modelSummary.name,
                placement,
                dimensions: modelItem?.customModelSpec
                  ? {
                      widthCm: modelItem.customModelSpec.widthCm,
                      depthCm: modelItem.customModelSpec.depthCm,
                      heightCm: modelItem.customModelSpec.heightCm,
                    }
                  : null,
                tableType: modelItem?.tableType || null,
                capacity: modelSummary.seats,
              })
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TableCameraPlacementPreviewModal;
