import React from "react";
import { Loader2, ScanLine } from "lucide-react";
import Button from "@/components/common/Button";

export default function Table3DActionBarV2({
  canLaunchNativeAr,
  isOpeningAr,
  arUnavailableReason,
  onOpenNativeAr,
}) {
  return (
    <div className="table-3d-modal__footer table-3d-modal__footer--clear-actions">
      <Button
        type="button"
        variant="primary"
        onClick={onOpenNativeAr}
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
