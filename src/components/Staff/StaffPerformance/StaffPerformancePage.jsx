import React, { useMemo, useState } from "react";
import { useStaffPerformanceView } from "@/hooks/useStaffPerformanceView";
import StaffPerformanceSummaryCards from "./StaffPerformanceSummaryCards";
import StaffPerformanceTimeline from "./StaffPerformanceTimeline";
import StaffScoreAdjustmentsTable from "./StaffScoreAdjustmentsTable";
import StaffIncidentsList from "./StaffIncidentsList";
import "./StaffPerformance.scss";
import { usePerformanceIncidentAppeals, useCreatePerformanceIncidentAppeal } from "@/hooks/usePerformanceIncidentAppeals";

const StaffPerformancePage = () => {
  const now = new Date();
  const { summary, timeline, adjustments, incidents, loading, error, missingIdentity, restaurantId } =
    useStaffPerformanceView({ month: now.getUTCMonth() + 1, year: now.getUTCFullYear() });
  const [form, setForm] = useState({ incidentId: "", reason: "", evidenceNote: "", evidenceUrls: "" });
  const [createAppeal] = useCreatePerformanceIncidentAppeal();
  const appealFilter = useMemo(() => ({ restaurantId, limit: 100, offset: 0 }), [restaurantId]);
  const { data: appealData, refetch: refetchAppeals } = usePerformanceIncidentAppeals(appealFilter, !restaurantId);
  const appeals = appealData?.performanceIncidentAppeals || [];

  if (missingIdentity) return <div className="staff-performance-page">Không xác định được hồ sơ nhân viên hoặc nhà hàng.</div>;
  if (loading) return <div className="staff-performance-page">Đang tải hiệu suất của bạn...</div>;
  if (error) return <div className="staff-performance-page">Không tải được dữ liệu hiệu suất.</div>;

  return (
    <div className="staff-performance-page">
      <h1>Hiệu suất của tôi</h1>
      <p>Kỳ hiện tại: Tháng {now.getUTCMonth() + 1}/{now.getUTCFullYear()}</p>
      <p className="staff-performance-note">Khiếu nại sẽ được hỗ trợ sau.</p>

      <StaffPerformanceSummaryCards summary={summary} />

      <section>
        <h2>Timeline điểm</h2>
        <StaffPerformanceTimeline timeline={timeline} />
      </section>

      <section>
        <h2>Lịch sử điều chỉnh điểm</h2>
        <StaffScoreAdjustmentsTable adjustments={adjustments} />
      </section>

      <section>
        <h2>Incident liên quan</h2>
        <StaffIncidentsList incidents={incidents} appeals={appeals} onAppeal={(incidentId) => setForm((v) => ({ ...v, incidentId }))} />
      <section>
        <h2>Gửi phản hồi/khiếu nại</h2>
        <textarea placeholder="Lý do (bắt buộc)" value={form.reason} onChange={(e)=>setForm({...form, reason:e.target.value})} />
        <textarea placeholder="Ghi chú bằng chứng" value={form.evidenceNote} onChange={(e)=>setForm({...form, evidenceNote:e.target.value})} />
        <textarea placeholder="Mỗi URL một dòng" value={form.evidenceUrls} onChange={(e)=>setForm({...form, evidenceUrls:e.target.value})} />
        <button type="button" disabled={!form.incidentId || !form.reason.trim()} onClick={async ()=>{await createAppeal({variables:{input:{incidentId:form.incidentId, reason:form.reason, evidenceNote:form.evidenceNote, evidenceUrls:form.evidenceUrls.split("\n").map(v=>v.trim()).filter(Boolean)}}}); setForm({ incidentId: "", reason: "", evidenceNote: "", evidenceUrls: "" }); await refetchAppeals();}}>Gửi phản hồi</button>
      </section>
      </section>
    </div>
  );
};

export default StaffPerformancePage;
