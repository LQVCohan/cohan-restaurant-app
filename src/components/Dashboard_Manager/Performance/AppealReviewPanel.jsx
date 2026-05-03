import React from "react";
import { usePerformanceIncidentAppeals, useReviewPerformanceIncidentAppeal } from "@/hooks/usePerformanceIncidentAppeals";

const AppealReviewPanel = ({ restaurantId, canReview = true }) => {
  const { data, refetch } = usePerformanceIncidentAppeals({ restaurantId, limit: 100, offset: 0 }, !restaurantId);
  const [review] = useReviewPerformanceIncidentAppeal();
  const appeals = data?.performanceIncidentAppeals || [];
  return <section><h2>Phản hồi từ nhân viên</h2>{appeals.map((a)=><article key={a.id}><p>{a.employeeId} - {a.incidentId}</p><p>{a.reason}</p><p>{a.status}</p>{canReview ? <div>{["under_review","needs_more_info","accepted","rejected"].map((s)=><button key={s} type="button" onClick={async()=>{const decisionReason = ["accepted","rejected"].includes(s)? window.prompt("Lý do quyết định") || "": ""; await review({variables:{input:{appealId:a.id,status:s,decisionReason}}}); await refetch();}}>{s}</button>)}</div> : null}</article>)}</section>;
};

export default AppealReviewPanel;
