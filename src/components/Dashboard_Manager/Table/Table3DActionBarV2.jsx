import React from "react";
import { Loader2, ScanLine } from "lucide-react";
import Button from "@/components/common/Button";

const AR_MODES = "scene-viewer webxr quick-look";

const getActiveModelViewer = () =>
  typeof document === "undefined"
    ? null
    : document.querySelector(".table-3d-modal model-viewer");

const prepareArViewer = (viewer) => {
  if (!viewer) return null;

  viewer.setAttribute("ar-modes", AR_MODES);
  viewer.setAttribute("ar-placement", "floor");
  viewer.setAttribute("ar-scale", "auto");
  return viewer;
};

export default function Table3DActionBarV2({
  canLaunchNativeAr,
  isOpeningAr,
  arUnavailableReason,
  onOpenNativeAr,
}) {
  const handleOpenNativeAr = async () => {
    prepareArViewer(getActiveModelViewer());
    await onOpenNativeAr?.();
  };

  return (
    <div className="table-3d-modal__footer table-3d-modal__footer--clear-actions">
      <Button
        type="button"
        variant="primary"
        onClick={handleOpenNativeAr}
        disabled={!canLaunchNativeAr || isOpeningAr}
        title={
          canLaunchNativeAr
            ? "Mở camera AR, quét mặt sàn rồi dùng hai ngón để chỉnh kích thước mẫu bàn"
            : arUnavailableReason
        }
      >
        {isOpeningAr ? (
          <Loader2 size={15} className="spin" aria-hidden="true" />
        ) : (
          <ScanLine size={15} aria-hidden="true" />
        )}
        {isOpeningAr ? "Đang mở camera AR…" : "Mở camera AR"}
      </Button>
    </div>
  );
}

export const __testables = {
  AR_MODES,
  getActiveModelViewer,
  prepareArViewer,
};
