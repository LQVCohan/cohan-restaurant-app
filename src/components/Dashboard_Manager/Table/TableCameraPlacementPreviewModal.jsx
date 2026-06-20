import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { CUSTOM_TABLE_SHAPES } from "@/config/table3dCustomModelBuilder";
import { mapTable3DTypeToArea } from "@/config/table3dCatalog";
import { getTableAreaLabel } from "@/utils/tableManagementOptions";
import {
  DEFAULT_CAMERA_PLACEMENT,
  normalizeCameraPlacement,
} from "@/config/table3dCameraPlacementStorage";
import "./TableCameraPlacementPreviewModal.scss";

const CAMERA_ERROR_MESSAGE =
  "Không thể mở camera. Hãy cấp quyền camera và kiểm tra kết nối HTTPS.";
const CAMERA_UNSUPPORTED_MESSAGE =
  "Thiết bị hoặc trình duyệt này chưa hỗ trợ xem thử bằng camera.";

const CAMERA_FALLBACK_TIPS = [
  "Thử mở trang bằng Chrome hoặc Safari trên điện thoại.",
  "Bạn vẫn có thể xem mô hình 3D trực tiếp trong cửa sổ trước.",
  "Nếu mẫu hỗ trợ, hãy thử chế độ AR trên thiết bị.",
];

const SCALE_PRESETS = [
  { label: "Nhỏ", value: 0.75 },
  { label: "Vừa", value: 1 },
  { label: "Lớn", value: 1.35 },
];

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

const formatDimensions = (dimensions) => {
  if (!dimensions || typeof dimensions !== "object") return "";
  const diameter = dimensions.diameterCm ?? dimensions.diameter;
  const height = dimensions.heightCm ?? dimensions.height;
  if (diameter) {
    return `Ø ${diameter} cm${height ? ` × cao ${height} cm` : ""}`;
  }

  const parts = [
    dimensions.widthCm ?? dimensions.width,
    dimensions.depthCm ?? dimensions.depth,
    height,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" × ")} cm` : "";
};

const TableCameraPlacementPreviewModal = ({
  open,
  onClose,
  modelItem,
  initialPlacement = null,
  overrideModelSummary = null,
  backendConfigNote = "",
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [placement, setPlacement] = useState(DEFAULT_CAMERA_PLACEMENT);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const modelSummary = useMemo(() => {
    if (overrideModelSummary) {
      return {
        name: overrideModelSummary.name || "Mẫu bàn",
        seats: overrideModelSummary.seats || 4,
        areaLabel:
          overrideModelSummary.areaLabel || getTableAreaLabel("standard"),
        shape: overrideModelSummary.shape || "rect",
        shapeLabel: overrideModelSummary.shapeLabel || "Bàn chữ nhật",
        dimensions: overrideModelSummary.dimensions || "",
        thumbnailUrl: overrideModelSummary.thumbnailUrl || "",
        hasModelUrl: Boolean(overrideModelSummary.modelUrl),
      };
    }

    const shape = getShapeFromModel(modelItem);
    const area =
      modelItem?.customModelSpec?.area ||
      mapTable3DTypeToArea(modelItem?.tableType);
    return {
      name:
        modelItem?.label || modelItem?.customModelSpec?.name || "Mẫu bàn",
      seats:
        modelItem?.customModelSpec?.capacity || modelItem?.capacity || 4,
      areaLabel: getTableAreaLabel(area),
      shape,
      shapeLabel: shapeLabelMap[shape] || "Bàn chữ nhật",
      dimensions:
        formatDimensions(modelItem?.customModelSpec) ||
        formatDimensions(modelItem?.dimensionsCm) ||
        formatDimensions(modelItem?.dimensions),
      thumbnailUrl: modelItem?.thumbnailUrl || "",
      hasModelUrl: Boolean(modelItem?.modelUrl),
    };
  }, [modelItem, overrideModelSummary]);

  useEffect(() => {
    if (!open) return undefined;
    setPlacement(
      normalizeCameraPlacement(initialPlacement || DEFAULT_CAMERA_PLACEMENT),
    );
    setCameraError("");
    setThumbnailFailed(false);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(CAMERA_UNSUPPORTED_MESSAGE);
      return undefined;
    }

    const videoNode = videoRef.current;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then((stream) => {
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const currentVideoNode = videoRef.current;
        if (currentVideoNode) {
          currentVideoNode.srcObject = stream;
        } else {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      })
      .catch(() => {
        if (!stopped) setCameraError(CAMERA_ERROR_MESSAGE);
      });

    return () => {
      stopped = true;
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const currentVideoNode = videoRef.current || videoNode;
      if (currentVideoNode) currentVideoNode.srcObject = null;
    };
  }, [open, initialPlacement]);

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
    const dxPercent =
      ((event.clientX - drag.startX) / drag.rect.width) * 100;
    const dyPercent =
      ((event.clientY - drag.startY) / drag.rect.height) * 100;
    setPlacement((prev) => ({
      ...prev,
      x: clamp(drag.startPlacement.x + dxPercent, 5, 95),
      y: clamp(drag.startPlacement.y + dyPercent, 5, 95),
    }));
  };

  const handlePointerUp = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
  };

  const updatePlacement = (updater) => {
    setPlacement((current) =>
      normalizeCameraPlacement(
        typeof updater === "function" ? updater(current) : updater,
      ),
    );
  };

  const overlayHasThumbnail = Boolean(
    modelSummary.thumbnailUrl && !thumbnailFailed,
  );

  return (
    <Modal isOpen={open} onClose={onClose} size="xl">
      <div className="camera-placement-modal">
        <div className="camera-placement-modal__header">
          <h3>Xem thử bàn bằng camera</h3>
          <p>
            Đặt hình mẫu bàn lên khung camera để ước lượng kích thước và mức độ
            phù hợp với không gian thực tế. Chế độ này không lưu vị trí vào sơ đồ
            bàn.
          </p>
          <ol className="camera-placement-modal__steps">
            <li>Hướng camera vào khu vực bạn muốn thử đặt bàn.</li>
            <li>Kéo, xoay và thay đổi kích thước mẫu bàn cho phù hợp.</li>
            <li>Đóng cửa sổ khi xem xong; vị trí thử sẽ không được lưu.</li>
          </ol>
          <div className="camera-placement-modal__warning">
            Đây là chế độ xem thử bằng hình ảnh. Hệ thống chưa nhận diện mặt phẳng
            và không tạo tọa độ không gian thực để lưu vào sơ đồ.
          </div>
        </div>

        <div className="camera-placement-modal__preview" ref={previewRef}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-placement-modal__video"
          />
          <div
            className={`camera-placement-modal__overlay shape-${modelSummary.shape}`}
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              transform: `translate(-50%, -50%) scale(${placement.scale}) rotate(${placement.rotation}deg)`,
              opacity: placement.opacity,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Mẫu bàn dùng để xem thử trong khung camera"
          >
            {overlayHasThumbnail ? (
              <img
                src={modelSummary.thumbnailUrl}
                alt={`Ảnh xem trước của ${modelSummary.name}`}
                className="camera-placement-modal__thumbnail"
                draggable="false"
                onError={() => setThumbnailFailed(true)}
              />
            ) : (
              <div
                className="camera-placement-modal__shape-preview"
                aria-hidden="true"
              />
            )}
            <div className="camera-placement-modal__overlay-info">
              <strong>{modelSummary.name}</strong>
              <span>{modelSummary.seats} ghế</span>
              <span>{modelSummary.areaLabel}</span>
              <span>{modelSummary.shapeLabel}</span>
              {modelSummary.dimensions && (
                <span>{modelSummary.dimensions}</span>
              )}
              {modelSummary.shape === "booth" && (
                <em className="sofa-badge">Ghế sofa</em>
              )}
            </div>
          </div>
          {cameraError && (
            <div className="camera-placement-modal__error">
              <strong>{cameraError}</strong>
              <ul>
                {CAMERA_FALLBACK_TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="camera-placement-modal__hint">
            Kéo mẫu bàn để đổi vị trí. Dùng các nút bên dưới để xoay, phóng to
            hoặc thu nhỏ.
          </div>
        </div>

        <div className="camera-placement-modal__controls">
          <div
            className="camera-placement-modal__control-group"
            aria-label="Chọn nhanh kích thước mẫu bàn"
          >
            <span>Kích thước nhanh:</span>
            {SCALE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  updatePlacement((current) => ({
                    ...current,
                    scale: preset.value,
                  }))
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div
            className="camera-placement-modal__control-group"
            aria-label="Điều chỉnh nhanh mẫu bàn"
          >
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  scale: current.scale - 0.1,
                }))
              }
            >
              Thu nhỏ
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  scale: current.scale + 0.1,
                }))
              }
            >
              Phóng to
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  rotation: current.rotation - 15,
                }))
              }
            >
              Xoay trái 15°
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  rotation: current.rotation + 15,
                }))
              }
            >
              Xoay phải 15°
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  rotation: current.rotation + 90,
                }))
              }
            >
              Xoay 90°
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  rotation: current.rotation + 180,
                }))
              }
            >
              Đổi hướng
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  x: 50,
                  y: 50,
                }))
              }
            >
              Căn giữa
            </Button>
          </div>
          <div
            className="camera-placement-modal__control-group"
            aria-label="Di chuyển mẫu bàn"
          >
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label="Di chuyển sang trái"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  x: current.x - 2,
                }))
              }
            >
              ←
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label="Di chuyển sang phải"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  x: current.x + 2,
                }))
              }
            >
              →
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label="Di chuyển lên trên"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  y: current.y - 2,
                }))
              }
            >
              ↑
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              aria-label="Di chuyển xuống dưới"
              onClick={() =>
                updatePlacement((current) => ({
                  ...current,
                  y: current.y + 2,
                }))
              }
            >
              ↓
            </Button>
          </div>
          <label className="camera-placement-modal__opacity-control">
            <span>Độ rõ của mẫu: {Math.round(placement.opacity * 100)}%</span>
            <input
              type="range"
              min="0.35"
              max="1"
              step="0.01"
              value={placement.opacity}
              aria-label="Điều chỉnh độ rõ của mẫu bàn"
              onChange={(event) =>
                updatePlacement((current) => ({
                  ...current,
                  opacity: Number(event.target.value),
                }))
              }
            />
          </label>
          <div
            className="camera-placement-modal__control-group"
            aria-label="Khôi phục vị trí mẫu bàn"
          >
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePlacement({ ...DEFAULT_CAMERA_PLACEMENT })
              }
            >
              Khôi phục mặc định
            </Button>
          </div>
        </div>

        <p className="camera-placement-modal__stats">
          Ngang: {placement.x.toFixed(1)}% · Dọc: {placement.y.toFixed(1)}% · Kích
          thước: {placement.scale.toFixed(2)} · Góc xoay:{" "}
          {placement.rotation.toFixed(0)}° · Độ rõ:{" "}
          {Math.round(placement.opacity * 100)}%
        </p>
        <p className="camera-placement-modal__note">
          Các thông số trên chỉ áp dụng cho hình mẫu trong khung camera hiện tại,
          không phải tọa độ thực tế và không cập nhật sơ đồ bàn.
        </p>
        {modelSummary.hasModelUrl && (
          <p className="camera-placement-modal__note">
            Mẫu này cũng có thể được mở bằng AR trên thiết bị nếu trình duyệt hỗ
            trợ.
          </p>
        )}
        {backendConfigNote && (
          <p className="camera-placement-modal__note">{backendConfigNote}</p>
        )}

        <div className="camera-placement-modal__actions">
          <Button type="button" variant="primary" onClick={onClose}>
            Đóng xem thử
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TableCameraPlacementPreviewModal;
