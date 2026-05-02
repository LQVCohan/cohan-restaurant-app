import React, { useMemo, useState } from "react";

const RESPONSIBILITY_OPTIONS = ["pending_review", "no_fault", "staff_responsible", "manager_responsible", "system_responsible", "shared"];
const ELIGIBLE_RESPONSIBILITY = ["staff_responsible", "manager_responsible", "shared"];
const SCORE_STATUS_OPTIONS = ["not_applicable", "pending", "eligible", "waived"];

const IncidentActionModal = ({ mode, incident, onClose, onSubmit, loading }) => {
  const [form, setForm] = useState({
    responsibilityStatus: incident?.responsibilityStatus || "pending_review",
    scoreImpactStatus: incident?.scoreImpactStatus || "pending",
    proposedScoreDelta: incident?.proposedScoreDelta ?? 0,
    reviewNote: "",
    responsibilityNote: "",
    reason: "",
    note: "",
    confirmApply: false,
  });
  const [error, setError] = useState("");
  const proposedDelta = Number(incident?.proposedScoreDelta || 0);

  const title = useMemo(() => ({ review: "Review incident", waive: "Waive incident", eligible: "Mark eligible", apply: "Apply score" }[mode] || "Incident action"), [mode]);

  const validate = () => {
    if (["review", "eligible"].includes(mode) && Number(form.proposedScoreDelta) > 0) return "proposedScoreDelta không được > 0.";
    if (mode === "review" && form.scoreImpactStatus === "eligible" && !ELIGIBLE_RESPONSIBILITY.includes(form.responsibilityStatus)) return "Trạng thái trách nhiệm không hợp lệ cho eligible.";
    if (mode === "review" && Number(form.proposedScoreDelta) === 0 && form.scoreImpactStatus === "eligible" && !form.reviewNote?.trim()) return "Yêu cầu review note khi delta = 0.";
    if (mode === "waive" && !form.reason?.trim()) return "Lý do miễn trừ là bắt buộc.";
    if (mode === "eligible" && Number(form.proposedScoreDelta) === 0 && !form.note?.trim()) return "Yêu cầu note khi delta = 0.";
    if (mode === "apply" && !form.confirmApply) return "Vui lòng xác nhận trước khi áp điểm.";
    return "";
  };

  const submit = async () => {
    const msg = validate();
    if (msg) return setError(msg);
    setError("");
    await onSubmit(form);
  };

  return <div className="incident-modal-overlay"><div className="incident-modal"><h4>{title}</h4>
    {mode === "review" && <>
      <select value={form.responsibilityStatus} onChange={(e) => setForm({ ...form, responsibilityStatus: e.target.value })}>{RESPONSIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</select>
      <select value={form.scoreImpactStatus} onChange={(e) => setForm({ ...form, scoreImpactStatus: e.target.value })}>{SCORE_STATUS_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</select>
      <input type="number" value={form.proposedScoreDelta} onChange={(e) => setForm({ ...form, proposedScoreDelta: e.target.value })} />
      <textarea placeholder="Review note" value={form.reviewNote} onChange={(e) => setForm({ ...form, reviewNote: e.target.value })} />
      <textarea placeholder="Responsibility note" value={form.responsibilityNote} onChange={(e) => setForm({ ...form, responsibilityNote: e.target.value })} />
    </>}
    {mode === "waive" && <><p>Miễn trừ incident này. Incident sẽ không bị áp điểm.</p><textarea placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></>}
    {mode === "eligible" && <><select value={form.responsibilityStatus} onChange={(e) => setForm({ ...form, responsibilityStatus: e.target.value })}>{ELIGIBLE_RESPONSIBILITY.map((v) => <option key={v} value={v}>{v}</option>)}</select><input type="number" value={form.proposedScoreDelta} onChange={(e) => setForm({ ...form, proposedScoreDelta: e.target.value })} /><textarea placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></>}
    {mode === "apply" && <><p>Hành động này sẽ áp điểm vào StaffPerformance.</p><p>Sau khi apply, incident không được apply lần hai.</p><p>Không ảnh hưởng payroll/lương.</p><p>proposedScoreDelta: {proposedDelta}</p><textarea placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /><label><input type="checkbox" checked={form.confirmApply} onChange={(e) => setForm({ ...form, confirmApply: e.target.checked })} />Tôi xác nhận áp điểm cho incident này</label></>}
    {error ? <div className="performance-error">{error}</div> : null}
    <div className="incident-modal-actions"><button onClick={onClose}>Hủy</button><button disabled={loading || (mode === 'apply' && !form.confirmApply)} onClick={submit}>Xác nhận</button></div>
  </div></div>;
};

export default IncidentActionModal;
