import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function Table3DReadiness({ arStatus, readinessItems }) {
  const placementItem = readinessItems.find((item) => item.id === "placement");
  const hasTechnicalLimitation = readinessItems.some(
    (item) => item.id !== "placement" && !item.ready,
  );
  const displayStatus = placementItem && !placementItem.ready
    ? {
        tone: "limited",
        label: "Chưa chọn bàn",
        description: "Chọn một bàn để thiết lập và lưu vị trí vào sơ đồ.",
      }
    : arStatus;

  return (
    <details
      className="table-3d-readiness"
      defaultOpen={hasTechnicalLimitation}
    >
      <summary className="table-3d-readiness__head">
        <div>
          <strong>Khả năng sử dụng AR</strong>
          <span>{displayStatus.description}</span>
        </div>
        <span
          className={`table-3d-ar-status table-3d-ar-status--${displayStatus.tone}`}
        >
          {displayStatus.label}
        </span>
      </summary>
      <div className="table-3d-readiness__items">
        {readinessItems.map((item) => (
          <div
            key={item.id}
            className={`table-3d-readiness__item ${
              item.ready ? "is-ready" : "is-limited"
            }`}
          >
            {item.ready ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}
            <div>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
