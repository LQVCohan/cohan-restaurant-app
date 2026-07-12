import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Plus,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import useCashierShiftReconciliation from "@/hooks/useCashierShiftReconciliation";
import "./CashierShiftReconciliationModal.scss";

const STATUS_META = {
  OPEN: { label: "Đang mở", tone: "open" },
  SUBMITTED: { label: "Chờ duyệt", tone: "submitted" },
  APPROVED: { label: "Đã duyệt", tone: "approved" },
  WAIVED: { label: "Miễn trách nhiệm", tone: "waived" },
  REJECTED: { label: "Yêu cầu làm lại", tone: "rejected" },
};

const DECISION_LABELS = {
  APPROVE: "Duyệt kết quả",
  WAIVE: "Miễn trách nhiệm",
  REJECT: "Yêu cầu làm lại",
};

const fmtMoney = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const fmtDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("vi-VN");
};

const pad2 = (value) => String(value).padStart(2, "0");
const toLocalDateTimeInput = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const toIsoDateTime = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const getGraphqlError = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const isCashierEmployee = (employee = {}) => {
  const text = [
    employee.department,
    employee.role,
    employee.positionTitle,
    employee.roleName,
    employee.roleSlug,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
  return text.includes("cashier") || text.includes("thu ngan");
};

const Field = ({ label, hint, children }) => (
  <label className="cashier-reconciliation-field">
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

const Metric = ({ label, value, emphasis = false }) => (
  <div className={emphasis ? "cashier-metric cashier-metric--emphasis" : "cashier-metric"}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

function OpenShiftForm({ employees, restaurantId, actionLoading, onSubmit, onCancel }) {
  const cashierEmployees = useMemo(() => {
    const matching = employees.filter(isCashierEmployee);
    return matching.length ? matching : employees;
  }, [employees]);
  const [form, setForm] = useState(() => ({
    cashierId: cashierEmployees[0]?.id || "",
    registerCode: "MAIN",
    openingCash: "0",
    openedAt: toLocalDateTimeInput(),
    note: "",
  }));

  useEffect(() => {
    if (!form.cashierId && cashierEmployees[0]?.id) {
      setForm((current) => ({ ...current, cashierId: cashierEmployees[0].id }));
    }
  }, [cashierEmployees, form.cashierId]);

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const valid =
    Boolean(form.cashierId) &&
    Boolean(form.openedAt) &&
    Number(form.openingCash) >= 0;

  return (
    <form
      className="cashier-reconciliation-form-card"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
          restaurantId,
          cashierId: form.cashierId,
          registerCode: form.registerCode.trim() || "MAIN",
          openingCash: Number(form.openingCash || 0),
          openedAt: toIsoDateTime(form.openedAt),
          note: form.note.trim(),
        });
      }}
    >
      <div className="cashier-form-heading">
        <div>
          <strong>Mở ca thu ngân</strong>
          <p>Ghi nhận tiền đầu ca trước khi bắt đầu nhận thanh toán tiền mặt.</p>
        </div>
        <button type="button" className="cashier-icon-button" onClick={onCancel} aria-label="Đóng biểu mẫu mở ca">
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="cashier-reconciliation-form-grid">
        <Field label="Thu ngân">
          <select value={form.cashierId} onChange={(event) => update("cashierId", event.target.value)} required>
            <option value="">Chọn nhân viên</option>
            {cashierEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} {employee.code ? `· ${employee.code}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mã quầy/két">
          <input value={form.registerCode} onChange={(event) => update("registerCode", event.target.value)} maxLength={80} />
        </Field>
        <Field label="Tiền đầu ca">
          <input type="number" min="0" step="1000" value={form.openingCash} onChange={(event) => update("openingCash", event.target.value)} required />
        </Field>
        <Field label="Thời điểm mở">
          <input type="datetime-local" value={form.openedAt} onChange={(event) => update("openedAt", event.target.value)} required />
        </Field>
        <Field label="Ghi chú" hint="Ví dụ: nhận bàn giao từ quản lý ca trước.">
          <textarea value={form.note} onChange={(event) => update("note", event.target.value)} rows={2} />
        </Field>
      </div>
      <div className="cashier-reconciliation-form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>
        <button type="submit" className="btn-primary" disabled={!valid || actionLoading}>
          <Plus size={16} aria-hidden="true" /> {actionLoading ? "Đang mở…" : "Mở ca"}
        </button>
      </div>
    </form>
  );
}

function MovementForm({ item, actionLoading, onSubmit }) {
  const [form, setForm] = useState({
    type: "CASH_OUT",
    amount: "",
    reason: "",
    occurredAt: toLocalDateTimeInput(),
  });
  const valid = Number(form.amount) > 0 && Boolean(form.reason.trim());

  return (
    <form
      className="cashier-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
          reconciliationId: item.id,
          type: form.type,
          amount: Number(form.amount),
          reason: form.reason.trim(),
          occurredAt: toIsoDateTime(form.occurredAt),
        }).then(() =>
          setForm({
            type: "CASH_OUT",
            amount: "",
            reason: "",
            occurredAt: toLocalDateTimeInput(),
          }),
        );
      }}
    >
      <h4>Ghi nhận tiền vào/ra két</h4>
      <div className="cashier-reconciliation-form-grid cashier-reconciliation-form-grid--compact">
        <Field label="Loại biến động">
          <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
            <option value="CASH_OUT">Rút tiền khỏi két</option>
            <option value="CASH_IN">Bổ sung tiền vào két</option>
          </select>
        </Field>
        <Field label="Số tiền">
          <input type="number" min="1" step="1000" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
        </Field>
        <Field label="Thời điểm">
          <input type="datetime-local" value={form.occurredAt} onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))} />
        </Field>
        <Field label="Lý do bắt buộc">
          <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Nộp bớt tiền, bổ sung tiền lẻ…" />
        </Field>
      </div>
      <button type="submit" className="btn-secondary" disabled={!valid || actionLoading}>
        {form.type === "CASH_OUT" ? <ArrowUpFromLine size={16} aria-hidden="true" /> : <ArrowDownToLine size={16} aria-hidden="true" />}
        Lưu biến động
      </button>
    </form>
  );
}

function SubmitForm({ item, actionLoading, onSubmit }) {
  const [form, setForm] = useState({
    actualCash: "",
    closedAt: toLocalDateTimeInput(),
    note: "",
    evidenceAttachments: "",
  });
  const valid = Number(form.actualCash) >= 0 && Boolean(form.closedAt);

  return (
    <form
      className="cashier-inline-form cashier-inline-form--submit"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
          reconciliationId: item.id,
          actualCash: Number(form.actualCash || 0),
          closedAt: toIsoDateTime(form.closedAt),
          note: form.note.trim(),
          evidenceAttachments: form.evidenceAttachments
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter(Boolean),
        });
      }}
    >
      <h4>Nộp chốt quỹ cuối ca</h4>
      <p>Hệ thống sẽ khóa số tiền thực đếm và chuyển sang quản lý duyệt.</p>
      <div className="cashier-reconciliation-form-grid cashier-reconciliation-form-grid--compact">
        <Field label="Tiền thực đếm">
          <input type="number" min="0" step="1000" value={form.actualCash} onChange={(event) => setForm((current) => ({ ...current, actualCash: event.target.value }))} required />
        </Field>
        <Field label="Thời điểm đóng ca">
          <input type="datetime-local" value={form.closedAt} onChange={(event) => setForm((current) => ({ ...current, closedAt: event.target.value }))} required />
        </Field>
        <Field label="Ghi chú thu ngân">
          <textarea rows={2} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
        </Field>
        <Field label="Link chứng từ" hint="Mỗi link một dòng.">
          <textarea rows={2} value={form.evidenceAttachments} onChange={(event) => setForm((current) => ({ ...current, evidenceAttachments: event.target.value }))} />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={!valid || actionLoading}>
        <ClipboardCheck size={16} aria-hidden="true" /> {actionLoading ? "Đang nộp…" : "Nộp chốt quỹ"}
      </button>
    </form>
  );
}

function ReviewForm({ item, actionLoading, onSubmit }) {
  const [form, setForm] = useState({
    decision: "APPROVE",
    attributableToCashier: false,
    managerAdjustmentAmount: "0",
    note: "",
  });
  const valid = Boolean(form.note.trim());

  return (
    <form
      className="cashier-inline-form cashier-inline-form--review"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
          reconciliationId: item.id,
          decision: form.decision,
          attributableToCashier:
            form.decision === "APPROVE" && form.attributableToCashier,
          managerAdjustmentAmount:
            form.decision === "APPROVE"
              ? Number(form.managerAdjustmentAmount || 0)
              : 0,
          note: form.note.trim(),
        });
      }}
    >
      <div className="cashier-review-heading">
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <h4>Quản lý xác nhận trách nhiệm</h4>
          <p>Chỉ kết quả được duyệt và đánh dấu thuộc trách nhiệm thu ngân mới ảnh hưởng điểm hiệu suất.</p>
        </div>
      </div>
      <div className="cashier-reconciliation-form-grid cashier-reconciliation-form-grid--compact">
        <Field label="Quyết định">
          <select value={form.decision} onChange={(event) => setForm((current) => ({ ...current, decision: event.target.value }))}>
            {Object.entries(DECISION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Điều chỉnh số dự kiến" hint="Dùng số âm/dương khi có chứng từ lấy hoặc bổ sung tiền chưa ghi nhận.">
          <input
            type="number"
            step="1000"
            disabled={form.decision !== "APPROVE"}
            value={form.managerAdjustmentAmount}
            onChange={(event) => setForm((current) => ({ ...current, managerAdjustmentAmount: event.target.value }))}
          />
        </Field>
        <Field label="Lý do quyết định">
          <textarea rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} required />
        </Field>
      </div>
      {form.decision === "APPROVE" ? (
        <label className="cashier-attribution-check">
          <input
            type="checkbox"
            checked={form.attributableToCashier}
            onChange={(event) => setForm((current) => ({ ...current, attributableToCashier: event.target.checked }))}
          />
          <span>
            <strong>Xác nhận chênh lệch thuộc trách nhiệm thu ngân</strong>
            <small>Bỏ chọn khi chênh lệch do hệ thống, bàn giao, quản lý lấy tiền hoặc nguyên nhân khác.</small>
          </span>
        </label>
      ) : null}
      <button type="submit" className="btn-primary" disabled={!valid || actionLoading}>
        <CheckCircle2 size={16} aria-hidden="true" />
        {actionLoading ? "Đang lưu…" : DECISION_LABELS[form.decision]}
      </button>
    </form>
  );
}

function ReconciliationDetail({ item, actionLoading, onRefresh, onMovement, onSubmit, onReview }) {
  if (!item) {
    return (
      <div className="cashier-reconciliation-empty cashier-reconciliation-empty--detail">
        Chọn một ca để xem số liệu và xử lý.
      </div>
    );
  }
  const status = STATUS_META[item.status] || { label: item.status, tone: "default" };

  return (
    <article className="cashier-reconciliation-detail">
      <header>
        <div>
          <div className="cashier-detail-title-line">
            <h3>{item.cashierName || "Thu ngân"}</h3>
            <span className={`cashier-status cashier-status--${status.tone}`}>{status.label}</span>
          </div>
          <p>{item.cashierCode || "Chưa có mã"} · Két {item.registerCode} · mở {fmtDateTime(item.openedAt)}</p>
        </div>
        {item.status === "OPEN" || item.status === "SUBMITTED" ? (
          <button type="button" className="btn-secondary" disabled={actionLoading} onClick={() => onRefresh(item.id)}>
            <RefreshCw size={16} aria-hidden="true" /> Làm mới số dự kiến
          </button>
        ) : null}
      </header>

      <section className="cashier-metric-grid" aria-label="Tổng hợp chốt quỹ">
        <Metric label="Tiền đầu ca" value={fmtMoney(item.openingCash)} />
        <Metric label="Thu tiền mặt" value={fmtMoney(item.cashSalesAmount)} />
        <Metric label="Hoàn tiền mặt" value={`-${fmtMoney(item.cashRefundAmount)}`} />
        <Metric label="Biến động két" value={fmtMoney(item.movementNetAmount)} />
        <Metric label="Điều chỉnh quản lý" value={fmtMoney(item.managerAdjustmentAmount)} />
        <Metric label="Tiền dự kiến" value={fmtMoney(item.expectedCash)} emphasis />
        <Metric label="Tiền thực đếm" value={item.actualCash == null ? "Chưa nộp" : fmtMoney(item.actualCash)} emphasis />
        <Metric label="Chênh lệch" value={fmtMoney(item.varianceAmount)} emphasis />
      </section>

      <div className="cashier-detail-context">
        <span>{item.transactionIds?.length || 0} giao dịch tiền mặt</span>
        <span>{item.refundIds?.length || 0} hoàn tiền mặt</span>
        <span>{item.movements?.length || 0} biến động két</span>
        <span>
          Tỷ lệ lệch: {item.expectedCash > 0 ? `${(Number(item.varianceRate || 0) * 100).toFixed(2)}%` : "0%"}
        </span>
      </div>

      {item.movements?.length ? (
        <section className="cashier-movement-history">
          <h4>Lịch sử tiền vào/ra</h4>
          <div>
            {item.movements.map((movement) => (
              <p key={movement.id}>
                <span>{movement.type === "CASH_OUT" ? "Rút khỏi két" : "Bổ sung vào két"}</span>
                <strong>{movement.type === "CASH_OUT" ? "-" : "+"}{fmtMoney(movement.amount)}</strong>
                <small>{movement.reason} · {fmtDateTime(movement.occurredAt)}</small>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {item.cashierNote ? <p className="cashier-note"><strong>Ghi chú thu ngân:</strong> {item.cashierNote}</p> : null}
      {item.reviewNote ? <p className="cashier-note"><strong>Quyết định quản lý:</strong> {item.reviewNote}</p> : null}
      {item.status === "APPROVED" ? (
        <p className={item.attributableToCashier ? "cashier-impact-note cashier-impact-note--warning" : "cashier-impact-note"}>
          {item.attributableToCashier
            ? "Chênh lệch này đã được xác nhận thuộc trách nhiệm thu ngân và sẽ được dùng làm bằng chứng khi tính lại hiệu suất."
            : "Đối soát đã duyệt nhưng chênh lệch không được quy trách nhiệm cho thu ngân."}
        </p>
      ) : null}
      {item.status === "WAIVED" ? <p className="cashier-impact-note">Ca này được miễn trách nhiệm và không ảnh hưởng điểm hiệu suất.</p> : null}
      {item.status === "REJECTED" ? <p className="cashier-impact-note cashier-impact-note--warning">Kết quả bị từ chối. Mở ca đối soát mới sau khi đã kiểm tra lại.</p> : null}

      {item.status === "OPEN" ? (
        <>
          <MovementForm item={item} actionLoading={actionLoading} onSubmit={onMovement} />
          <SubmitForm item={item} actionLoading={actionLoading} onSubmit={onSubmit} />
        </>
      ) : null}
      {item.status === "SUBMITTED" ? (
        <ReviewForm item={item} actionLoading={actionLoading} onSubmit={onReview} />
      ) : null}
    </article>
  );
}

export default function CashierShiftReconciliationModal({
  restaurantId,
  restaurantName,
  employees = [],
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [status, setStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [localError, setLocalError] = useState("");
  const {
    items,
    loading,
    error,
    actionLoading,
    actionError,
    openReconciliation,
    addMovement,
    refreshReconciliation,
    submitReconciliation,
    reviewReconciliation,
  } = useCashierShiftReconciliation({ restaurantId, status });

  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id || "");
    }
  }, [items, selectedId]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const selected = items.find((item) => item.id === selectedId) || null;

  const runAction = async (operation, resultField) => {
    setLocalError("");
    try {
      const result = await operation();
      const nextItem = result?.data?.[resultField];
      if (nextItem?.id) setSelectedId(nextItem.id);
      return nextItem;
    } catch (operationError) {
      setLocalError(getGraphqlError(operationError, "Không thể thực hiện thao tác đối soát."));
      throw operationError;
    }
  };

  return (
    <div
      className="cashier-reconciliation-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="cashier-reconciliation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-reconciliation-title"
        aria-describedby="cashier-reconciliation-description"
      >
        <header className="cashier-reconciliation-modal__header">
          <div className="cashier-reconciliation-heading-icon" aria-hidden="true">
            <CircleDollarSign size={22} />
          </div>
          <div>
            <span>Kiểm soát tiền mặt theo ca</span>
            <h2 id="cashier-reconciliation-title">Đối soát ca thu ngân</h2>
            <p id="cashier-reconciliation-description">
              {restaurantName}. Chênh lệch chỉ ảnh hưởng hiệu suất sau khi quản lý xác minh trách nhiệm.
            </p>
          </div>
          <button ref={closeButtonRef} type="button" className="cashier-icon-button" onClick={onClose} aria-label="Đóng đối soát ca thu ngân">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="cashier-reconciliation-toolbar">
          <div className="cashier-status-filter" aria-label="Lọc trạng thái đối soát">
            {["ALL", "OPEN", "SUBMITTED", "APPROVED", "WAIVED", "REJECTED"].map((value) => (
              <button key={value} type="button" className={status === value ? "active" : ""} onClick={() => setStatus(value)}>
                {value === "ALL" ? "Tất cả" : STATUS_META[value]?.label || value}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary" disabled={!restaurantId || actionLoading} onClick={() => setShowOpenForm((current) => !current)}>
            <Plus size={16} aria-hidden="true" /> Mở ca mới
          </button>
        </div>

        {showOpenForm ? (
          <OpenShiftForm
            employees={employees}
            restaurantId={restaurantId}
            actionLoading={actionLoading}
            onCancel={() => setShowOpenForm(false)}
            onSubmit={async (input) => {
              await runAction(
                () => openReconciliation(input),
                "openCashierShiftReconciliation",
              );
              setShowOpenForm(false);
            }}
          />
        ) : null}

        {error || actionError || localError ? (
          <p className="cashier-reconciliation-error" role="alert">
            {localError || getGraphqlError(actionError || error, "Không tải được dữ liệu đối soát.")}
          </p>
        ) : null}

        <div className="cashier-reconciliation-content">
          <aside className="cashier-reconciliation-list" aria-label="Danh sách ca đối soát">
            {loading && !items.length ? (
              <div className="cashier-reconciliation-empty" role="status">Đang tải các ca đối soát…</div>
            ) : items.length === 0 ? (
              <div className="cashier-reconciliation-empty">
                Chưa có ca đối soát trong bộ lọc này. Mở ca mới để bắt đầu ghi nhận tiền đầu ca.
              </div>
            ) : (
              items.map((item) => {
                const meta = STATUS_META[item.status] || { label: item.status, tone: "default" };
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={selectedId === item.id ? "cashier-reconciliation-row active" : "cashier-reconciliation-row"}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="cashier-row-main">
                      <strong>{item.cashierName || "Thu ngân"}</strong>
                      <small>{item.cashierCode || "Chưa có mã"} · Két {item.registerCode}</small>
                    </span>
                    <span className={`cashier-status cashier-status--${meta.tone}`}>{meta.label}</span>
                    <span className="cashier-row-values">
                      <small>{fmtDateTime(item.openedAt)}</small>
                      <strong>{fmtMoney(item.varianceAmount)}</strong>
                    </span>
                  </button>
                );
              })
            )}
          </aside>

          <ReconciliationDetail
            item={selected}
            actionLoading={actionLoading}
            onRefresh={(id) => runAction(
              () => refreshReconciliation(id),
              "refreshCashierShiftReconciliation",
            )}
            onMovement={(input) => runAction(
              () => addMovement(input),
              "addCashierShiftCashMovement",
            )}
            onSubmit={(input) => runAction(
              () => submitReconciliation(input),
              "submitCashierShiftReconciliation",
            )}
            onReview={(input) => runAction(
              () => reviewReconciliation(input),
              "reviewCashierShiftReconciliation",
            )}
          />
        </div>
      </section>
    </div>
  );
}
