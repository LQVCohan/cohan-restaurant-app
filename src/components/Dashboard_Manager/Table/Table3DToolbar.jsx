import React from "react";
import {
  ChevronDown,
  Maximize2,
  MoveDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Button from "@/components/common/Button";

export default function Table3DToolbar({
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
        <Button size="sm" variant="secondary" onClick={() => rotateModel(-15)} title="Xoay mô hình sang trái">
          <RotateCcw size={15} /><span>Xoay trái</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => rotateModel(15)} title="Xoay mô hình sang phải">
          <RotateCw size={15} /><span>Xoay phải</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => zoomModel(-0.2)} title="Phóng to mô hình">
          <ZoomIn size={15} /><span>Phóng to</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => zoomModel(0.2)} title="Thu nhỏ mô hình">
          <ZoomOut size={15} /><span>Thu nhỏ</span>
        </Button>
        <Button size="sm" variant="secondary" onClick={fitModelToView} title="Đưa mô hình về giữa và căn vừa khung xem">
          <Maximize2 size={15} /><span>Căn vừa khung</span>
        </Button>
      </div>

      <details className="table-3d-position-controls">
        <summary>
          <SlidersHorizontal size={15} />
          Điều chỉnh mô hình
          <ChevronDown size={14} />
        </summary>
        <div className="table-3d-position-controls__panel">
          <Button size="sm" variant="secondary" onClick={() => shiftModel(-0.1, 0)}><MoveLeft size={15} /> Sang trái</Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0.1, 0)}><MoveRight size={15} /> Sang phải</Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0, -0.1)}><MoveUp size={15} /> Lên trên</Button>
          <Button size="sm" variant="secondary" onClick={() => shiftModel(0, 0.1)}><MoveDown size={15} /> Xuống dưới</Button>
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
          <Button size="sm" variant="secondary" onClick={resetView}>Khôi phục mặc định</Button>
        </div>
      </details>
    </div>
  );
}
