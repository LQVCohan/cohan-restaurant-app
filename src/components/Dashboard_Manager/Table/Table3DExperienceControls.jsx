import React from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Info,
  Loader2,
  Maximize2,
  MoreHorizontal,
  MoveDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  RotateCcw,
  RotateCw,
  ScanLine,
  Smartphone,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Button from "@/components/common/Button";

export function Table3DToolbar({
  rotateModel,
  zoomModel,
  fitModelToView,
  shiftModel,
  scale,
  onScaleChange,
  resetView,
}) {
  return (
    <div className="table-3d-toolbar" aria-label="Điều khiển mô hình 3D">
      <div className="table-3d-toolbar__group">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => rotateModel(-15)}
          title="Xoay mô hình sang trái"
        >
          <RotateCcw size={15} />
          <span>Xoay trái</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => rotateModel(15)}
          title="Xoay mô hình sang phải"
        >
          <RotateCw size={15} />
          <span>Xoay phải</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => zoomModel(-0.2)}
          title="Phóng to mô hình"
        >
          <ZoomIn size={15} />
          <span>Phóng to</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => zoomModel(0.2)}
          title="Thu nhỏ mô hình"
        >
          <ZoomOut size={15} />
          <span>Thu nhỏ</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={fitModelToView}
          title="Đưa mô hình về giữa và căn vừa khung xem"
        >
          <Maximize2 size={15} />
          <span>Căn vừa khung</span>
        </Button>
      </div>

      <details className="table-3d-position-controls">
        <summary>
          <Crosshair size={15} />
          Điều chỉnh mô hình
          <ChevronDown size={14} />
        </summary>
        <div className="table-3d-position-controls__panel">
          <Button size="sm" variant="secondary" onClick={() => shiftModel(-0.1, 0)}>
            <MoveLeft size={15} /> Sang trái
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0.1, 0)}>
            <MoveRight size={15} /> Sang phải
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0, -0.1)}>
            <MoveUp size={15} /> Lên trên
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0, 0.1)}>
            <MoveDown size={15} /> Xuống dưới
          </Button>
          <label className="scale-range">
            <span>Kích thước: {scale.toFixed(2)}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={scale}
              onChange={(event) => onScaleChange(Number(event.target.value))}
              aria-label="Điều chỉnh kích thước mô hình"
            />
          </label>
          <Button size="sm" variant="secondary" onClick={resetView}>
            Khôi phục mặc định
          </Button>
        </div>
      </details>
    </div>
  );
}

export function Table3DReadiness({ arStatus, readinessItems }) {
  return (
    <div className="table-3d-readiness" aria-label="Khả năng sử dụng AR">
      <div className="table-3d-readiness__head">
        <div>
          <strong>Khả năng sử dụng AR</strong>
          <span>{arStatus.description}</span>
        </div>
        <span className={`table-3d-ar-status table-3d-ar-status--${arStatus.tone}`}>
          {arStatus.label}
        </span>
      </div>
      <div className="table-3d-readiness__items">
        {readinessItems.map((item) => (
          <div
            key={item.id}
            className={`table-3d-readiness__item ${
              item.ready ? "is-ready" : "is-limited"
            }`}
          >
            {item.ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Table3DQuickGuide() {
  return (
    <div className="table-3d-quick-guide">
      <div>
        <span>1</span>
        <strong>Chọn mẫu bàn</strong>
      </div>
      <div>
        <span>2</span>
        <strong>Xem thử bằng camera</strong>
      </div>
      <div>
        <span>3</span>
        <strong>Đặt bàn vào sơ đồ</strong>
      </div>
      <details>
        <summary>
          <Info size={14} />
          AR hoạt động thế nào?
        </summary>
        <p>
          Chế độ xem AR chỉ giúp bạn quan sát mẫu bàn trong không gian thực. Muốn lưu
          vị trí vào sơ đồ tầng, hãy dùng chức năng Đặt bàn bằng AR hoặc nhập tọa độ
          thủ công khi thiết bị chưa hỗ trợ.
        </p>
      </details>
    </div>
  );
}

export function Table3DActionBar({
  selectedModel,
  canPreviewCamera,
  onOpenCamera,
  canOpenArPlacement,
  arPlacementTitle,
  onOpenArPlacement,
  showArOptions,
  onToggleArOptions,
  canLaunchNativeAr,
  isOpeningAr,
  arUnavailableReason,
  onOpenNativeAr,
  onApply,
}) {
  return (
    <div className="table-3d-modal__footer">
      <Button
        variant="secondary"
        onClick={onOpenCamera}
        disabled={!selectedModel || !canPreviewCamera}
        title={
          !selectedModel
            ? "Hãy chọn một mẫu bàn trước"
            : !canPreviewCamera
              ? "Thiết bị hoặc trình duyệt chưa cho phép sử dụng camera"
              : "Xem thử mẫu bàn bằng camera, không lưu vị trí"
        }
      >
        <Camera size={16} /> Xem bằng camera
      </Button>

      <Button
        type="button"
        variant="primary"
        onClick={onOpenArPlacement}
        disabled={!canOpenArPlacement}
        title={arPlacementTitle}
      >
        <ScanLine size={16} /> Đặt bàn bằng AR
      </Button>

      <div className="table-3d-more-actions">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onToggleArOptions}
          aria-expanded={showArOptions}
          title="Mở thêm tùy chọn xem AR"
        >
          <MoreHorizontal size={16} /> Thêm tùy chọn
        </Button>
        {showArOptions ? (
          <div className="table-3d-more-actions__menu">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onOpenNativeAr}
              disabled={!canLaunchNativeAr || isOpeningAr}
              title={
                canLaunchNativeAr
                  ? "Mở mẫu bàn bằng trình xem AR của thiết bị"
                  : arUnavailableReason
              }
            >
              {isOpeningAr ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <Smartphone size={15} />
              )}
              {isOpeningAr ? "Đang mở AR..." : "Xem bằng AR trên thiết bị"}
            </Button>
            <p>Chức năng này chỉ dùng để xem mẫu bàn và không lưu vị trí vào sơ đồ.</p>
          </div>
        ) : null}
      </div>

      <Button
        variant="secondary"
        className="table-3d-apply-button"
        onClick={onApply}
        disabled={!selectedModel}
      >
        <Check size={16} /> Chọn mẫu này
      </Button>
    </div>
  );
}
