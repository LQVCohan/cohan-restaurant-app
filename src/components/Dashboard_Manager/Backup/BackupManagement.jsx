import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import "./BackupManagement.scss";

const Q_BACKUP_READINESS = gql`
  query BackupReadiness($restaurantId: ID!) {
    backupReadiness(restaurantId: $restaurantId) {
      restaurantId
      ready
      risks {
        key
        label
        severity
        resolved
        description
      }
      checklist {
        reportsChecked
        transactionsReconciled
        settingsReviewed
        exportPrepared
        safeCopyStored
        operatorRecorded
      }
      scope {
        ordersAndPayments
        tablesAndFloorPlan
        menuAndPricing
        inventory
        staffAndPermissions
        schedules
        customersAndPromotions
        reportsAndReconciliation
      }
      lastRun {
        id
        status
        note
        completedAt
        createdAt
        updatedAt
      }
    }
  }
`;

const Q_BACKUP_RUNS = gql`
  query BackupRuns($restaurantId: ID!, $limit: Int!, $offset: Int!) {
    backupRuns(restaurantId: $restaurantId, limit: $limit, offset: $offset) {
      id
      restaurantId
      status
      note
      createdBy
      completedBy
      completedAt
      createdAt
      updatedAt
      checklist {
        reportsChecked
        transactionsReconciled
        settingsReviewed
        exportPrepared
        safeCopyStored
        operatorRecorded
      }
      scope {
        ordersAndPayments
        tablesAndFloorPlan
        menuAndPricing
        inventory
        staffAndPermissions
        schedules
        customersAndPromotions
        reportsAndReconciliation
      }
    }
  }
`;

const FALLBACK_CHECKLIST = {
  reportsChecked: false,
  transactionsReconciled: false,
  settingsReviewed: false,
  exportPrepared: false,
  safeCopyStored: false,
  operatorRecorded: false,
};

const FALLBACK_SCOPE = {
  ordersAndPayments: true,
  tablesAndFloorPlan: true,
  menuAndPricing: true,
  inventory: true,
  staffAndPermissions: true,
  schedules: true,
  customersAndPromotions: true,
  reportsAndReconciliation: true,
};

const FALLBACK_RISKS = [
  {
    key: "reports_not_checked",
    label: "Báo cáo cuối ngày chưa kiểm tra",
    severity: "warning",
    resolved: false,
    description: "Cần hoàn tất trước khi chốt checklist backup.",
  },
  {
    key: "transactions_not_reconciled",
    label: "Giao dịch chưa đối soát",
    severity: "warning",
    resolved: false,
    description: "Cần hoàn tất trước khi chốt checklist backup.",
  },
];

const FALLBACK_READINESS = {
  restaurantId: "",
  ready: false,
  risks: FALLBACK_RISKS,
  checklist: FALLBACK_CHECKLIST,
  scope: FALLBACK_SCOPE,
  lastRun: null,
};

const CHECKLIST_LABELS = {
  reportsChecked: "Kiểm tra báo cáo cuối ngày",
  transactionsReconciled: "Đối soát giao dịch",
  settingsReviewed: "Kiểm tra cấu hình hệ thống",
  exportPrepared: "Chuẩn bị dữ liệu export/snapshot",
  safeCopyStored: "Lưu bản sao an toàn",
  operatorRecorded: "Ghi nhận người thực hiện và thời điểm",
};

const SCOPE_LABELS = {
  ordersAndPayments: "Đơn hàng & thanh toán",
  tablesAndFloorPlan: "Bàn & sơ đồ tầng",
  menuAndPricing: "Menu & giá bán",
  inventory: "Kho & nguyên liệu",
  staffAndPermissions: "Nhân viên & phân quyền",
  schedules: "Lịch làm việc",
  customersAndPromotions: "Khách hàng & khuyến mãi",
  reportsAndReconciliation: "Báo cáo & đối soát",
};

const toChecklistItems = (checklist = FALLBACK_CHECKLIST) =>
  Object.entries(CHECKLIST_LABELS).map(([key, label]) => ({
    key,
    label,
    done: Boolean(checklist?.[key]),
  }));

const toScopeItems = (scope = FALLBACK_SCOPE) =>
  Object.entries(SCOPE_LABELS).map(([key, label]) => ({
    key,
    label,
    enabled: Boolean(scope?.[key]),
  }));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN");
};

const BackupManagement = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) {
      setRestaurantId(String(restaurants[0]?.id || restaurants[0]?.restaurantId || ""));
    }
  }, [restaurantId, restaurants]);

  const readinessQuery = useQuery(Q_BACKUP_READINESS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });
  const runsQuery = useQuery(Q_BACKUP_RUNS, {
    variables: { restaurantId, limit: 5, offset: 0 },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const readiness = readinessQuery.data?.backupReadiness || FALLBACK_READINESS;
  const runs = Array.isArray(runsQuery.data?.backupRuns) ? runsQuery.data.backupRuns : [];
  const checklistItems = useMemo(() => toChecklistItems(readiness.checklist), [readiness.checklist]);
  const scopeItems = useMemo(() => toScopeItems(readiness.scope), [readiness.scope]);
  const unresolvedRisks = useMemo(
    () => (readiness.risks || []).filter((risk) => !risk.resolved),
    [readiness.risks],
  );
  const enabledScopeCount = scopeItems.filter((item) => item.enabled).length;
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const lastRunDate =
    readiness.lastRun?.completedAt || readiness.lastRun?.updatedAt || readiness.lastRun?.createdAt;

  const warning = !restaurantId
    ? "Chưa xác định nhà hàng để đọc cấu hình"
    : readinessQuery.error || runsQuery.error
      ? "Không đọc được trạng thái backup, đang hiển thị checklist khuyến nghị."
      : "";
  const loading = readinessQuery.loading || runsQuery.loading;

  const summaryItems = [
    {
      title: "Trạng thái",
      description: readiness.ready
        ? "Đủ điều kiện theo checklist metadata hiện tại."
        : `Còn ${unresolvedRisks.length} rủi ro cần xử lý.`,
    },
    {
      title: "Phạm vi",
      description: `${enabledScopeCount}/${scopeItems.length} hạng mục đang được đưa vào phạm vi backup metadata.`,
    },
    {
      title: "Checklist",
      description: `${completedChecklistCount}/${checklistItems.length} bước đã hoàn tất.`,
    },
    {
      title: "Lần chạy gần nhất",
      description: lastRunDate ? formatDate(lastRunDate) : "Chưa có dữ liệu.",
    },
  ];

  const navigateManagerPage = (page) => {
    if (!page) return;
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: { page, source: "backup-management" },
      }),
    );
    if (window.location.hash !== `#${page}`) window.location.hash = page;
  };

  return (
    <div className="backup-management">
      <header className="backup-management__hero">
        <div>
          <h2>Sao lưu &amp; khôi phục</h2>
          <p>
            Theo dõi quy trình chuẩn bị sao lưu, đối soát dữ liệu và điều hướng tới các khu vực cần
            kiểm tra.
          </p>
        </div>
        <div className="backup-management__badges" aria-label="Trạng thái trang">
          <span>Backend metadata</span>
          <span>Checklist vận hành</span>
          <span>Không restore tự động</span>
        </div>
      </header>

      <section className="backup-management__alert" role="note">
        Trang này chưa tạo file backup, chưa download backup và chưa khôi phục dữ liệu.
      </section>
      {warning ? (
        <section className="backup-management__alert" role="note">
          {warning}
        </section>
      ) : null}

      <section className="backup-management__summary" aria-label="Tổng quan trước sao lưu">
        {loading ? <p className="backup-management__note">Đang tải trạng thái backup...</p> : null}
        {summaryItems.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
        <article>
          <h3>Điều hướng</h3>
          <p>Kiểm tra báo cáo, giao dịch và cài đặt trước khi kết thúc ngày.</p>
          <button type="button" onClick={() => navigateManagerPage("reports")}>
            Mở báo cáo
          </button>
          <button type="button" onClick={() => navigateManagerPage("transactions")}>
            Mở giao dịch
          </button>
          <button type="button" onClick={() => navigateManagerPage("settings")}>
            Mở cài đặt
          </button>
        </article>
      </section>

      <section className="backup-management__timeline" aria-label="Checklist readiness">
        <h3>Checklist readiness</h3>
        <ol>
          {checklistItems.map((item) => (
            <li key={item.key}>
              <div>
                <h4>{item.label}</h4>
                <p>{item.done ? "Hoàn tất" : "Chưa xong"}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="backup-management__data-grid" aria-label="Phạm vi backup metadata">
        <h3>Phạm vi backup metadata</h3>
        <div>
          {scopeItems.map((item) => (
            <article key={item.key}>
              <h4>{item.label}</h4>
              <p>{item.enabled ? "Có trong phạm vi" : "Không bao gồm"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="backup-management__risk-grid" aria-label="Rủi ro trước khi backup">
        <h3>Rủi ro trước khi backup</h3>
        <div>
          {(readiness.risks || []).map((risk) => (
            <article key={risk.key}>
              <h4>{risk.label}</h4>
              <p>{risk.description || "Không có mô tả."}</p>
              <p>{risk.resolved ? "Đã xử lý" : "Cần xử lý"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="backup-management__timeline" aria-label="Lịch sử backup run metadata">
        <h3>5 backup runs gần nhất (metadata)</h3>
        <ol>
          {runs.length ? (
            runs.map((run) => {
              const runChecklist = toChecklistItems(run.checklist);
              const runScope = toScopeItems(run.scope);
              const doneCount = runChecklist.filter((item) => item.done).length;
              const scopeCount = runScope.filter((item) => item.enabled).length;

              return (
                <li key={run.id}>
                  <div>
                    <h4>
                      {run.status || "unknown"} • {formatDate(run.createdAt)}
                    </h4>
                    <p>Checklist: {doneCount}/{runChecklist.length} bước hoàn tất</p>
                    <p>Phạm vi: {scopeCount}/{runScope.length} hạng mục</p>
                    {run.completedAt ? <p>Hoàn tất lúc: {formatDate(run.completedAt)}</p> : null}
                    <p>Cập nhật: {formatDate(run.updatedAt)}</p>
                    {run.note ? <p>Ghi chú: {run.note}</p> : null}
                  </div>
                </li>
              );
            })
          ) : (
            <li>
              <div>
                <p>Chưa có lịch sử backup runs.</p>
              </div>
            </li>
          )}
        </ol>
      </section>
    </div>
  );
};

export default BackupManagement;
