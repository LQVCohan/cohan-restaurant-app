import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import "./BackupManagement.scss";

const Q_BACKUP_READINESS = gql`
  query BackupReadiness($restaurantId: ID!) {
    backupReadiness(restaurantId: $restaurantId) {
      ready
      risks
      checklist
      scope
      lastRun
    }
  }
`;

const Q_BACKUP_RUNS = gql`
  query BackupRuns($restaurantId: ID!, $limit: Int!, $offset: Int!) {
    backupRuns(restaurantId: $restaurantId, limit: $limit, offset: $offset) {
      id
      status
      startedAt
      finishedAt
      createdAt
      updatedAt
      metadata
      checklist
      scope
      risks
    }
  }
`;

const FALLBACK_READINESS = { ready: false, risks: ["Chưa đối soát giao dịch", "Báo cáo cuối ngày chưa kiểm tra"], checklist: ["Kiểm tra báo cáo", "Kiểm tra giao dịch", "Kiểm tra cấu hình"], scope: ["Đơn hàng & thanh toán", "Menu & giá bán", "Nhân viên & phân quyền"], lastRun: null };

const BackupManagement = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) setRestaurantId(String(restaurants[0]?.id || restaurants[0]?.restaurantId || ""));
  }, [restaurantId, restaurants]);

  const readinessQuery = useQuery(Q_BACKUP_READINESS, { variables: { restaurantId }, skip: !restaurantId, fetchPolicy: "network-only" });
  const runsQuery = useQuery(Q_BACKUP_RUNS, { variables: { restaurantId, limit: 5, offset: 0 }, skip: !restaurantId, fetchPolicy: "network-only" });

  const readiness = readinessQuery.data?.backupReadiness || FALLBACK_READINESS;
  const runs = Array.isArray(runsQuery.data?.backupRuns) ? runsQuery.data.backupRuns : [];
  const warning = !restaurantId ? "Chưa xác định nhà hàng để đọc cấu hình" : (readinessQuery.error || runsQuery.error) ? "Không đọc được trạng thái backup, đang hiển thị checklist khuyến nghị." : "";
  const loading = readinessQuery.loading || runsQuery.loading;

  const summaryItems = useMemo(() => ([
    { title: "Trạng thái", description: readiness.ready ? "Đủ điều kiện backup theo metadata hiện tại." : "Chưa đủ điều kiện backup, cần hoàn tất checklist." },
    { title: "Phạm vi", description: `${(readiness.scope || []).length} hạng mục trong phạm vi backup.` },
    { title: "Rủi ro", description: `${(readiness.risks || []).length} rủi ro cần xử lý trước backup.` },
    { title: "Lần chạy gần nhất", description: readiness.lastRun ? new Date(readiness.lastRun).toLocaleString("vi-VN") : "Chưa có dữ liệu." },
  ]), [readiness]);

  const navigateManagerPage = (page) => { if (!page) return; window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page, source: "backup-management" } })); if (window.location.hash !== `#${page}`) window.location.hash = page; };

  return (
    <div className="backup-management">
      <header className="backup-management__hero"><div><h2>Sao lưu &amp; khôi phục</h2><p>Theo dõi quy trình chuẩn bị sao lưu, đối soát dữ liệu và điều hướng tới các khu vực cần kiểm tra.</p></div><div className="backup-management__badges" aria-label="Trạng thái trang"><span>Backend metadata</span><span>Checklist vận hành</span><span>Không restore tự động</span></div></header>
      <section className="backup-management__alert" role="note">Trang này chưa tạo file backup, chưa download backup và chưa khôi phục dữ liệu.</section>
      {warning ? <section className="backup-management__alert" role="note">{warning}</section> : null}
      <section className="backup-management__summary" aria-label="Tổng quan trước sao lưu">{loading ? <p className="backup-management__note">Đang tải trạng thái backup...</p> : null}{summaryItems.map((item) => (<article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>))}<article><h3>Điều hướng</h3><p>Kiểm tra báo cáo, giao dịch và cài đặt trước khi kết thúc ngày.</p><button type="button" onClick={() => navigateManagerPage("reports")}>Mở báo cáo</button><button type="button" onClick={() => navigateManagerPage("transactions")}>Mở giao dịch</button><button type="button" onClick={() => navigateManagerPage("settings")}>Mở cài đặt</button></article></section>
      <section className="backup-management__timeline" aria-label="Checklist readiness"><h3>Checklist readiness</h3><ol>{(readiness.checklist || []).map((step) => (<li key={step}><div><h4>{step}</h4></div></li>))}</ol></section>
      <section className="backup-management__data-grid" aria-label="Phạm vi backup metadata"><h3>Phạm vi backup metadata</h3><div>{(readiness.scope || []).map((scopeItem) => (<article key={scopeItem}><h4>{scopeItem}</h4></article>))}</div></section>
      <section className="backup-management__risk-grid" aria-label="Rủi ro trước khi backup"><h3>Rủi ro trước khi backup</h3><div>{(readiness.risks || []).map((risk) => (<article key={risk}><h4>{risk}</h4></article>))}</div></section>
      <section className="backup-management__timeline" aria-label="Lịch sử backup run metadata"><h3>5 backup runs gần nhất (metadata)</h3><ol>{runs.length ? runs.map((run) => (<li key={run.id}><div><h4>{run.status || "unknown"} • {run.createdAt ? new Date(run.createdAt).toLocaleString("vi-VN") : "-"}</h4><p>startedAt: {run.startedAt || "-"} • finishedAt: {run.finishedAt || "-"}</p><p>risks: {Array.isArray(run.risks) ? run.risks.join(", ") : "-"}</p><p>scope: {Array.isArray(run.scope) ? run.scope.join(", ") : "-"}</p></div></li>)) : <li><div><p>Chưa có lịch sử backup runs.</p></div></li>}</ol></section>
    </div>
  );
};

export default BackupManagement;
