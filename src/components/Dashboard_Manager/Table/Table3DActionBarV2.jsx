import React from "react";
import { Loader2, ScanLine } from "lucide-react";
import Button from "@/components/common/Button";

const getActiveModelViewer = () =>
  typeof document === "undefined"
    ? null
    : document.querySelector(".table-3d-modal model-viewer");

const prepareStableArViewer = async (viewer) => {
  if (!viewer) return null;

  let supportsWebXr = false;
  try {
    supportsWebXr = Boolean(
      typeof navigator !== "undefined" &&
        (await navigator.xr?.isSessionSupported?.("immersive-ar")),
    );
  } catch {
    supportsWebXr = false;
  }

  viewer.setAttribute(
    "ar-modes",
    supportsWebXr ? "webxr" : "scene-viewer quick-look",
  );
  viewer.setAttribute("ar-scale", "fixed");
  return viewer;
};

export default function Table3DActionBarV2({
  canLaunchNativeAr,
  isOpeningAr,
  arUnavailableReason,
  onOpenNativeAr,
}) {
  const handleOpenNativeAr = async () => {
    const viewer = await prepareStableArViewer(getActiveModelViewer());
    if (!viewer) {
      await onOpenNativeAr?.();
      return;
    }

    const originalSetAttribute = viewer.setAttribute;
    viewer.setAttribute = function setStableArAttribute(name, value) {
      return originalSetAttribute.call(
        this,
        name,
        name === "ar-scale" && value === "auto" ? "fixed" : value,
      );
    };

    try {
      await onOpenNativeAr?.();
    } finally {
      viewer.setAttribute = originalSetAttribute;
      viewer.setAttribute("ar-scale", "fixed");
    }
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
            ? "Mở camera AR, quét mặt sàn và đặt thử mẫu bàn trong không gian thật"
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
  getActiveModelViewer,
  prepareStableArViewer,
};
