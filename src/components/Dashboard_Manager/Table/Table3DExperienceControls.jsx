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
    <div className="table-3d-toolbar" aria-label="Điều khiển mẫu 3D">
      <div className="table-3d-toolbar__group">
        <Button size="sm" variant="secondary" onClick={() => rotateModel(-15)} title="Xoay mẫu sang trái">
          <RotateCcw size={15} /><span>Xoay trái</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => rotateModel(15)} title="Xoay mẫu sang phải">
          <RotateCw size={15} /><span>Xoay phải</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => zoomModel(-0.2)} title="Phóng to mẫu">
          <ZoomIn size={15} /><span>Phóng to</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => zoomModel(0.2)} title="Thu nhỏ mẫu">
          <ZoomOut size={15} /><span>Thu nhỏ</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={fitModelToView} title="Đưa mẫu về giữa và vừa khung hình">
          <Maximize2 size={15} /><span>Vừa khung</span>
        </Button>
      </div>

      <details className="table-3d-position-controls">
        <summary>
          <Crosshair size={15} />
          Hiệu chỉnh vị trí
          <ChevronDown size={14} />
        </summary>
        <div className="table-3d-position-controls__panel">
          <Button size="sm" variant="secondary" onClick={() => shiftModel(-0.1, 0)}>
            <MoveLeft size={15} /> Trái
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0.1, 0)}>
            <MoveRight size={15} /> Phải
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0, -0.1)}>
            <MoveUp size={15} /> Lên
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0, 0.1)}>
            <MoveDown size={15} /> Xuống
          </Button>
          <label className="scale-range">
            <span>Tỷ lệ {scale.toFixed(2)}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={scale}
              onChange={(event) => onScaleChange(Number(event.target.value))}
            />
          </label>
          <Button size="sm" variant="secondary" onClick={resetView}>Đặt lại</Button>
        </div>
      </details>
    </div>
  );
}

export function Table3DReadiness({ arStatus, readinessItems }) {
  return (
    <div className="table-3d-readiness" aria-label="Kiểm tra khả năng AR">
      <div className="table-3d-readiness__head">
        <div>
          <strong>Kiểm tra trước khi dùng AR</strong>
          <span>{arStatus.description}</span>
        </div>
        <span className={`table-3d-ar-status table-3d-ar-status--${arStatus.tone}`}>
          {arStatus.label}
        </span>
      </div>
      <div className="table-3d-readiness__items">
        {readinessItems.map((item) => (
          <div key={item.id} className={`table-3d-readiness__item ${item.ready ? "is-ready" : "is-limited"}`}>
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
      <div><span>1</span><strong>Chọn mẫu</strong></div>
      <div><span>2</span><strong>Xem trong không gian</strong></div>
      <div><span>3</span><strong>Đặt và xác nhận vị trí</strong></div>
      <details>
        <summary><Info size={14} />Chi tiết kỹ thuật</summary>
        <p>
          AR của thiết bị chỉ dùng để xem mẫu. Chế độ đặt bàn bằng AR dùng WebXR hit-test khi được hỗ trợ và vẫn cho phép nhập vị trí thủ công.
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
        title={!selectedModel ? "Chọn mẫu bàn trước" : !canPreviewCamera ? "Thiết bị không cung cấp camera cho trình duyệt" : "Xem mẫu bằng camera, không lưu vị trí"}
      >
        <Camera size={16} /> Xem trong không gian
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
          title="Mở thêm tùy chọn AR"
        >
          <MoreHorizontal size={16} /> Tùy chọn
        </Button>
        {showArOptions ? (
          <div className="table-3d-more-actions__menu">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onOpenNativeAr}
              disabled={!canLaunchNativeAr || isOpeningAr}
              title={canLaunchNativeAr ? "Mở mẫu bằng trình xem AR của thiết bị" : arUnavailableReason}
            >
              {isOpeningAr ? <Loader2 size={15} className="spin" /> : <Smartphone size={15} />}
              {isOpeningAr ? "Đang mở AR..." : "Mở AR của thiết bị"}
            </Button>
            <p>Chế độ này chỉ xem mẫu, không lưu vị trí bàn vào sơ đồ.</p>
          </div>
        ) : null}
      </div>

      <Button
        variant="secondary"
        className="table-3d-apply-button"
        onClick={onApply}
        disabled={!selectedModel}
      >
        <Check size={16} /> Dùng mẫu bàn này
      </Button>
    </div>
  );
}
