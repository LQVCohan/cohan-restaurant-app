import React, { useContext, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useManagerIncidentReviewQueue from "@/hooks/useManagerIncidentReviewQueue";
import usePerformanceIncidentActions from "@/hooks/usePerformanceIncidentActions";
import IncidentActionButtons from "./IncidentActionButtons";
import IncidentActionModal from "./IncidentActionModal";

const STATUS_FILTERS = [
  ["all", "Tất cả cần xử lý"], ["pending", "Chờ review"], ["overdue", "Quá hạn"], ["eligible", "Eligible"], ["applied", "Đã apply"], ["waived", "Đã waive"],
];

const IncidentReviewQueue = ({ restaurantId, onMutationSuccess }) => {
  const { user } = useContext(AuthContext) || {};
  const isAccountant = String(user?.roleName || user?.role?.slug || "").toLowerCase() === "accountant";
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("");
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState("");

  const filters = useMemo(() => ({ status: status === "all" ? undefined : status, severity: severity || undefined }), [severity, status]);
  const { items, summary, loading, error, refetch } = useManagerIncidentReviewQueue({ restaurantId, filters, limit: 20, offset: 0, enabled: true });
  const { reviewIncident, waiveIncident, markEligible, applyScore, actionLoading } = usePerformanceIncidentActions();

  const handleSubmit = async (form) => {
    try {
      if (modal.mode === "review") await reviewIncident({ incidentId: modal.item.incident.id, responsibilityStatus: form.responsibilityStatus, scoreImpactStatus: form.scoreImpactStatus, proposedScoreDelta: Number(form.proposedScoreDelta), reviewNote: form.reviewNote, responsibilityNote: form.responsibilityNote });
      if (modal.mode === "waive") await waiveIncident({ incidentId: modal.item.incident.id, reason: form.reason });
      if (modal.mode === "eligible") await markEligible({ incidentId: modal.item.incident.id, responsibilityStatus: form.responsibilityStatus, proposedScoreDelta: Number(form.proposedScoreDelta), note: form.note });
      if (modal.mode === "apply") await applyScore({ incidentId: modal.item.incident.id, note: form.note });
      await refetch();
      await onMutationSuccess?.();
      setMessage(modal.mode === "review" ? "Đã cập nhật review." : modal.mode === "waive" ? "Đã miễn trừ incident." : modal.mode === "eligible" ? "Đã đánh dấu eligible." : "Đã áp điểm.");
      setModal(null);
    } catch (e) {
      setMessage(e?.message || "Thao tác thất bại.");
    }
  };

  if (loading) return <div className="performance-loading">Đang tải hàng đợi incident...</div>;
  if (error) return <div className="performance-error">Không tải được hàng đợi incident.</div>;
  return <div className="incident-queue"><div className="performance-panel__header"><h3>Hàng đợi xử lý incident</h3><span>Tổng mở: {summary.totalOpen || 0}</span></div>
    <div className="incident-filters">{STATUS_FILTERS.map(([k, label]) => <button key={k} className={status === k ? "active" : ""} onClick={() => setStatus(k)}>{label}</button>)}
      <select value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="">Mọi severity</option><option value="critical">Nghiêm trọng</option><option value="violation">Vi phạm</option><option value="warning">Cảnh báo</option><option value="info">Thông tin</option></select></div>
    {message ? <div className="performance-empty">{message}</div> : null}
    {!items.length ? <div className="performance-empty">Không có incident cần xử lý.</div> : <div className="simple-table"><div className="simple-table__head incident-grid"><span>Loại</span><span>SLA</span><span>Nhân viên</span><span>Trách nhiệm</span><span>Score</span><span>Đề xuất</span><span>Hành động</span></div>
      {items.map((item) => <div key={item.incident?.id || item.employeeId + item.createdAt} className="simple-table__row incident-grid"><span>{item.eventType} • {item.severity}</span><span>{item.priority} / {item.slaStatus}</span><span>{String(item.employeeId || "").slice(0, 8)}</span><span>{item.responsibilityStatus}</span><span>{item.scoreImpactStatus} ({item.proposedScoreDelta ?? 0})</span><span>{item.recommendedAction === "already_in_punctuality" ? "Đã tính trong Đúng giờ" : item.recommendedAction || "-"}</span><IncidentActionButtons item={item} isAccountant={isAccountant} onAction={(mode, row) => setModal({ mode, item: row })} /></div>)}
    </div>}
    {modal ? <IncidentActionModal mode={modal.mode} incident={modal.item.incident} loading={actionLoading} onClose={() => setModal(null)} onSubmit={handleSubmit} /> : null}
  </div>;
};

export default IncidentReviewQueue;
