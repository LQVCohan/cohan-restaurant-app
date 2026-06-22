import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function Table3DReadiness({ arStatus, readinessItems }) {
  const hasLimitation = readinessItems.some((item) => !item.ready);

  return (
    <details className="table-3d-readiness" open={hasLimitation}>
      <summary className="table-3d-readiness__head">
        <div>
          <strong>Khả năng sử dụng AR</strong>
          <span>{arStatus.description}</span>
        </div>
        <span className={`table-3d-ar-status table-3d-ar-status--${arStatus.tone}`}>
          {arStatus.label}
        </span>
      </summary>
      <div className="table-3d-readiness__items">
        {readinessItems.map((item) => (
          <div
            key={item.id}
            className={`table-3d-readiness__item ${item.ready ? "is-ready" : "is-limited"}`}
          >
            {item.ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
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
