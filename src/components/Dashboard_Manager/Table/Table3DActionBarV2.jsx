import React from "react";
import {
  Camera,
  Check,
  Loader2,
  ScanLine,
  Smartphone,
} from "lucide-react";
import Button from "@/components/common/Button";

export default function Table3DActionBarV2({
  selectedModel,
  canPreviewCamera,
  onOpenCamera,
  canOpenArPlacement,
  arPlacementTitle,
  placementActionLabel,
  onOpenArPlacement,
  canLaunchNativeAr,
  isOpeningAr,
  arUnavailableReason,
  onOpenNativeAr,
  applyActionLabel,
  onApply,
}) {
  return (
    <div className="table-3d-modal__footer table-3d-modal__footer--clear-actions">
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
        <Camera size={16} /> Xem thử 2D bằng camera
      </Button>

      <Button
        type="button"
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
        {isOpeningAr ? "Đang mở AR..." : "Xem AR trên thiết bị"}
      </Button>

      <Button
        type="button"
        variant="secondary"
        onClick={onOpenArPlacement}
        disabled={!canOpenArPlacement}
        title={arPlacementTitle}
      >
        <ScanLine size={16} /> {placementActionLabel}
      </Button>

      <Button
        variant="primary"
        className="table-3d-apply-button"
        onClick={onApply}
        disabled={!selectedModel}
      >
        <Check size={16} /> {applyActionLabel}
      </Button>
    </div>
  );
}
