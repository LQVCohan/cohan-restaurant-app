import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  ChevronDown,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanLine,
  SwitchCamera,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
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
  "Không thể mở camera. Hãy kiểm tra quyền camera rồi thử lại.";
const CAMERA_UNSUPPORTED_MESSAGE =
  "Thiết bị hoặc trình duyệt này chưa hỗ trợ xem thử bằng camera.";

const CAMERA_FALLBACK_TIPS = [
  "Mở trang bằng HTTPS hoặc localhost.",
  "Cho phép trình duyệt sử dụng camera.",
  "Thử Chrome hoặc Safari phiên bản mới nhất.",
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
  const contentRef = useRef(null);
  const dragRef = useRef(null);
  const cameraTimeoutRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraStatus, setCameraStatus] = useState("idle");
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
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

  const stopCamera = () => {
    if (cameraTimeoutRef.current) {
      window.clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!open) return;
    setPlacement(
      normalizeCameraPlacement(initialPlacement || DEFAULT_CAMERA_PLACEMENT),
    );
    setThumbnailFailed(false);
    setCameraFacing("environment");
    setCameraSessionKey(0);

    window.requestAnimationFrame(() => {
      const scrollContainer = contentRef.current?.closest(".modal-body");
      if (typeof scrollContainer?.scrollTo === "function") {
      scrollContainer.scrollTo({ top: 0, behavior: "auto" });
    }
    });
  }, [open, initialPlacement]);

  useEffect(() => {
    if (!open) return undefined;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraStatus("unsupported");
      setCameraError(CAMERA_UNSUPPORTED_MESSAGE);
      return undefined;
    }

    let cancelled = false;
    setCameraStatus("requesting");
    setCameraError("");
    stopCamera();

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const videoNode = videoRef.current;
        if (!videoNode) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }

        videoNode.srcObject = stream;
        try {
          await videoNode.play();
        } catch {
          // The playing event remains the source of truth for readiness.
        }

        cameraTimeoutRef.current = window.setTimeout(() => {
          setCameraStatus((current) => {
            if (current === "ready") return current;
            setCameraError(
              "Camera phản hồi chậm. Hãy thử lại hoặc đổi camera.",
            );
            return "error";
          });
        }, 8000);
      })
      .catch((error) => {
        if (cancelled) return;
        const permissionDenied =
          error?.name === "NotAllowedError" ||
          error?.name === "PermissionDeniedError";
        const noDevice =
          error?.name === "NotFoundError" ||
          error?.name === "DevicesNotFoundError";

        setCameraStatus("error");
        setCameraError(
          permissionDenied
            ? "Trình duyệt đang chặn quyền camera. Hãy cấp quyền rồi thử lại."
            : noDevice
              ? "Không tìm thấy camera trên thiết bị này."
              : CAMERA_ERROR_MESSAGE,
        );
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, cameraFacing, cameraSessionKey]);

  const markCameraReady = () => {
    if (cameraTimeoutRef.current) {
      window.clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }
    setCameraError("");
    setCameraStatus("ready");
  };

  const retryCamera = () => {
    setCameraError("");
    setCameraStatus("requesting");
    setCameraSessionKey((value) => value + 1);
  };

  const switchCamera = () => {
    setCameraError("");
    setCameraStatus("requesting");
    setCameraFacing((current) =>
      current === "environment" ? "user" : "environment",
    );
  };

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
    setPlacement((previous) => ({
      ...previous,
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
  const statusLabel = {
    idle: "Chưa mở camera",
    requesting: "Đang mở camera",
    ready: "Camera đang hoạt động",
    error: "Camera chưa hoạt động",
    unsupported: "Camera không được hỗ trợ",
  }[cameraStatus];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xl"
      autoWrapBody={false}
      className="camera-placement-shell"
      zIndex={1120}
    >
      <Modal.Header
        className="camera-placement-modal__modal-header"
        onClose={onClose}
      >
        <div className="camera-placement-modal__title-block">
          <div className="camera-placement-modal__title-row">
            <Camera size={18} aria-hidden="true" />
            <h2>Xem thử bàn bằng camera</h2>
            <span
              className={`camera-placement-modal__status camera-placement-modal__status--${cameraStatus}`}
            >
              {cameraStatus === "ready" && <ScanLine size={13} />}
              {cameraStatus === "requesting" && (
                <Loader2 size={13} className="spin" />
              )}
              {(cameraStatus === "error" || cameraStatus === "unsupported") && (
                <CameraOff size={13} />
              )}
              {statusLabel}
            </span>
          </div>
          <p>
            Ước lượng nhanh vị trí và kích thước hiển thị. Chế độ này không đo
            kích thước thực tế và không lưu vị trí vào sơ đồ.
          </p>
        </div>
      </Modal.Header>

      <Modal.Body className="camera-placement-modal__body">
        <div className="camera-placement-modal" ref={contentRef}>
          <div className="camera-placement-modal__workflow">
            <div><span>1</span><strong>Hướng camera vào khu vực</strong></div>
            <div><span>2</span><strong>Điều chỉnh mẫu bàn</strong></div>
            <div><span>3</span><strong>Đánh giá mức độ phù hợp</strong></div>
          </div>

          <div className="camera-placement-modal__model-summary">
            <div>
              <strong>{modelSummary.name}</strong>
              <span>
                {modelSummary.seats} ghế · {modelSummary.areaLabel} ·{" "}
                {modelSummary.shapeLabel}
                {modelSummary.dimensions
                  ? ` · ${modelSummary.dimensions}`
                  : ""}
              </span>
            </div>
            <span className="camera-placement-modal__estimate-badge">
              Ước lượng 2D
            </span>
          </div>

          <div className="camera-placement-modal__preview" ref={previewRef}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-placement-modal__video"
              onPlaying={markCameraReady}
              onCanPlay={markCameraReady}
            />

            {cameraStatus === "requesting" && (
              <div className="camera-placement-modal__camera-state" role="status">
                <Loader2 size={28} className="spin" />
                <strong>Đang mở camera</strong>
                <span>Hãy cho phép trình duyệt sử dụng camera khi được hỏi.</span>
              </div>
            )}

            {(cameraStatus === "error" || cameraStatus === "unsupported") && (
              <div className="camera-placement-modal__camera-state camera-placement-modal__camera-state--error">
                <CameraOff size={30} />
                <strong>{cameraError || CAMERA_ERROR_MESSAGE}</strong>
                <ul>
                  {CAMERA_FALLBACK_TIPS.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
                {cameraStatus !== "unsupported" && (
                  <Button variant="primary" size="sm" onClick={retryCamera}>
                    <RefreshCw size={15} /> Thử lại
                  </Button>
                )}
              </div>
            )}

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
              aria-label="Mẫu bàn dùng để ước lượng trong khung camera"
            >
              {overlayHasThumbnail ? (
                <img
                  src={modelSummary.thumbnailUrl}
                  alt={`Mẫu ${modelSummary.name}`}
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
              <span className="camera-placement-modal__overlay-label">
                {modelSummary.name}
              </span>
            </div>

            {cameraStatus === "ready" && (
              <div className="camera-placement-modal__hint">
                Kéo mẫu để đổi vị trí. Dùng thanh điều khiển để xoay hoặc thay đổi
                kích thước.
              </div>
            )}
          </div>

          <div className="camera-placement-modal__primary-controls">
            <div className="camera-placement-modal__quick-size">
              <span>Kích thước nhanh</span>
              {SCALE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant={
                    Math.abs(placement.scale - preset.value) < 0.01
                      ? "primary"
                      : "secondary"
                  }
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

            <div className="camera-placement-modal__quick-actions">
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
                <ZoomOut size={15} /> Thu nhỏ
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
                <ZoomIn size={15} /> Phóng to
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
                <RotateCcw size={15} /> Xoay trái
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
                <RotateCw size={15} /> Xoay phải
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
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={switchCamera}
                disabled={cameraStatus === "unsupported"}
              >
                <SwitchCamera size={15} /> Đổi camera
              </Button>
            </div>
          </div>

          <details className="camera-placement-modal__advanced-controls">
            <summary>
              Điều chỉnh chi tiết
              <ChevronDown size={15} />
            </summary>
            <div className="camera-placement-modal__advanced-panel">
              <div className="camera-placement-modal__move-controls">
                <span>Di chuyển chính xác</span>
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
                  ← Trái
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
                  Phải →
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
                  ↑ Lên
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
                  ↓ Xuống
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

              <p className="camera-placement-modal__stats">
                Ngang {placement.x.toFixed(1)}% · Dọc {placement.y.toFixed(1)}% ·
                Kích thước {placement.scale.toFixed(2)} · Góc xoay{" "}
                {placement.rotation.toFixed(0)}°
              </p>

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
          </details>

          <div className="camera-placement-modal__notice">
            <AlertTriangle size={16} />
            <p>
              Đây là lớp hình ảnh 2D để ước lượng nhanh. Hệ thống chưa nhận diện
              mặt sàn, chưa đo khoảng cách và không lưu tọa độ thực tế.
              {modelSummary.hasModelUrl
                ? " Mẫu này có thể mở bằng AR trên thiết bị nếu được hỗ trợ."
                : ""}
            </p>
          </div>

          {backendConfigNote && (
            <p className="camera-placement-modal__note">{backendConfigNote}</p>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer className="camera-placement-modal__footer">
        <span>
          {cameraStatus === "ready"
            ? "Camera đang hoạt động. Thay đổi trong cửa sổ này không được lưu."
            : "Bạn có thể đóng cửa sổ và tiếp tục chọn mẫu bàn khác."}
        </span>
        <Button type="button" variant="primary" onClick={onClose}>
          Đóng xem thử
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TableCameraPlacementPreviewModal;
