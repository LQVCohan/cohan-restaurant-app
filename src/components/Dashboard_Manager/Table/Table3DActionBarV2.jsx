import React from "react";
import { Camera, Loader2, ScanLine } from "lucide-react";
import Button from "@/components/common/Button";

export default function Table3DActionBarV2({
  selectedModel,
  canPreviewCamera,
  onOpenCamera,
  canLaunchNativeAr,
  isOpeningAr,
  arUnavailableReason,
  onOpenNativeAr,
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
              : "Mở camera để ước lượng nhanh vị trí và kích thước hiển thị"
        }
      >
        <Camera size={16} aria-hidden="true" /> Xem camera 2D
      </Button>

      <Button
        type="button"
        variant="primary"
        onClick={onOpenNativeAr}
        disabled={!canLaunchNativeAr || isOpeningAr}
        title={
          canLaunchNativeAr
            ? "Mở camera AR của thiết bị để đặt thử mẫu bàn trong không gian thật"
            : arUnavailableReason
        }
      >
        {isOpeningAr ? (
          <Loader2 size={15} className="spin" aria-hidden="true" />
        ) : (
          <ScanLine size={15} aria-hidden="true" />
        )}
        {isOpeningAr ? "Đang mở camera AR..." : "Mở camera AR"}
      </Button>
    </div>
  );
}
