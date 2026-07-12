import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  WalletCards,
  X,
} from "lucide-react";
import useCashierShiftReconciliation from "@/hooks/useCashierShiftReconciliation";
import "./CashierShiftReconciliationModal.scss";

const FILTER_STATUSES = [
  "ALL",
  "OPEN",
  "SUBMITTED",
  "APPROVED",
  "WAIVED",
  "REJECTED",
];

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

const MONEY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 2,
});

const fmtMoney = (value) => MONEY_FORMATTER.format(Number(value || 0));

const fmtDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--"
    : DATE_TIME_FORMATTER.format(date);
};

const fmtPercent = (value) =>
  PERCENT_FORMATTER.format(Number(value || 0));

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
    .replace(/Đ/g, "D")
    .toLowerCase();

  return text.includes("cashier") || text.includes("thu ngan");
};

const actionButtonClass = (tone = "secondary") =>
  `cashier-action-button cashier-action-button--${tone}`;

const Field = ({ label, hint, children }) => (
  <label className="cashier-reconciliation-field">
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, tone: "default" };
  return (
    <span className={`cashier-status cashier-status--${meta.tone}`}>
      {meta.label}
    </span>
  );
};

const MoneyFlowRow = ({ label, operator, value, tone = "default" }) => (
  <div className={`cashier-money-flow-row cashier-money-flow-row--${tone}`}>
    <span className="cashier-money-flow-row__operator" aria-hidden="true">
      {operator}
    </span>
    <span className="cashier-money-flow-row__label">{label}</span>
    <strong>{fmtMoney(value)}</strong>
  </div>
);

function BalanceOverview({ item }) {
  const hasActualCash =
    item.actualCash !== null && item.actualCash !== undefined;
  const variance = Number(item.varianceAmount || 0);
  const varianceState = !hasActualCash
    ? "pending"
    : variance === 0
      ? "balanced"
      : "variance";

  return (
    <section
      className={`cashier-balance-overview cashier-balance-overview--${varianceState}`}
      aria-label="So sánh tiền dự kiến, tiền thực đếm và chênh lệch"
    >
      <div className="cashier-balance-overview__item">
        <span>Tiền dự kiến</span>
        <strong>{fmtMoney(item.expectedCash)}</strong>
        <small>Từ giao dịch và biến động két</small>
      </div>
      <div className="cashier-balance-overview__symbol" aria-hidden="true">
        →
      </div>
      <div className="cashier-balance-overview__item">
        <span>Tiền thực đếm</span>
        <strong>{hasActualCash ? fmtMoney(item.actualCash) : "Chưa nộp"}</strong>
        <small>
          {hasActualCash ? "Số thu ngân xác nhận cuối ca" : "Chờ chốt quỹ"}
        </small>
      </div>
      <div className="cashier-balance-overview__symbol" aria-hidden="true">
        =
      </div>
      <div className="cashier-balance-overview__item cashier-balance-overview__item--variance">
        <span>Chênh lệch</span>
        <strong>{hasActualCash ? fmtMoney(variance) : "--"}</strong>
        <small>
          {!hasActualCash
            ? "Chưa có dữ liệu"
            : variance === 0
              ? "Két đã cân bằng"
              : `Lệch ${fmtPercent(item.varianceRate)}`}
        </small>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div
      className="cashier-reconciliation-loading"
      role="status"
      aria-live="polite"
    >
      <span className="cashier-skeleton cashier-skeleton--row" />
      <span className="cashier-skeleton cashier-skeleton--row" />
      <span className="cashier-skeleton cashier-skeleton--row" />
      <div className="cashier-reconciliation-loading__detail">
        <span className="cashier-skeleton cashier-skeleton--title" />
        <span className="cashier-skeleton cashier-skeleton--summary" />
        <span>Đang tải các ca đối soát…</span>
      </div>
    </div>
  );
}

function EmptyState({ canOpenShift }) {
  return (
    <div className="cashier-reconciliation-empty">
      <span className="cashier-reconciliation-empty__icon" aria-hidden="true">
        <ReceiptText size={22} />
      </span>
      <strong>Chưa có ca trong bộ lọc này</strong>
      <p>
        {canOpenShift
          ? "Mở ca mới để ghi nhận tiền đầu ca và bắt đầu theo dõi két."
          : "Nhà hàng chưa có nhân viên được gán vai trò thu ngân."}
      </p>
    </div>
  );
}

function OpenShiftForm({
  employees,
  restaurantId,
  actionLoading,
  onSubmit,
  onCancel,
}) {
  const cashierEmployees = useMemo(
    () => employees.filter(isCashierEmployee),
    [employees],
  );
  const [form, setForm] = useState(() => ({
    cashierId: cashierEmployees[0]?.id || "",
    registerCode: "MAIN",
    openingCash: "0",
    openedAt: toLocalDateTimeInput(),
    note: "",
  }));

  useEffect(() => {
    if (!form.cashierId && cashierEmployees[0]?.id) {
      setForm((current) => ({
        ...current,
        cashierId: cashierEmployees[0].id,
      }));
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
          <span className="cashier-form-heading__icon" aria-hidden="true">
            <WalletCards size={18} />
          </span>
          <div>
            <strong>Mở ca thu ngân</strong>
            <p>Ghi nhận tiền đầu ca trước khi nhận thanh toán tiền mặt.</p>
          </div>
        </div>
        <button
          type="button"
          className="cashier-icon-button"
          onClick={onCancel}
          aria-label="Đóng biểu mẫu mở ca"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="cashier-reconciliation-form-grid">
        <Field label="Thu ngân">
          <select
            name="cashierId"
            value={form.cashierId}
            onChange={(event) => update("cashierId", event.target.value)}
            autoComplete="off"
            required
          >
            <option value="">Chọn nhân viên</option>
            {cashierEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} {employee.code ? `· ${employee.code}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mã quầy/két">
          <input
            name="registerCode"
            value={form.registerCode}
            onChange={(event) => update("registerCode", event.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
          />
        </Field>

        <Field label="Tiền đầu ca">
          <input
            name="openingCash"
            type="number"
            inputMode="numeric"
            min="0"
            step="1000"
            value={form.openingCash}
            onChange={(event) => update("openingCash", event.target.value)}
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Thời điểm mở">
          <input
            name="openedAt"
            type="datetime-local"
            value={form.openedAt}
            onChange={(event) => update("openedAt", event.target.value)}
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Ghi chú" hint="Ví dụ: nhận bàn giao từ quản lý ca trước.">
          <textarea
            name="openingNote"
            value={form.note}
            onChange={(event) => update("note", event.target.value)}
            autoComplete="off"
            rows={2}
          />
        </Field>
      </div>

      <div className="cashier-reconciliation-form-actions">
        <button
          type="button"
          className={actionButtonClass()}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          type="submit"
          className={actionButtonClass("primary")}
          disabled={!valid || actionLoading}
        >
          <Plus size={16} aria-hidden="true" />
          {actionLoading ? "Đang mở…" : "Mở ca"}
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    try {
      await onSubmit({
        reconciliationId: item.id,
        type: form.type,
        amount: Number(form.amount),
        reason: form.reason.trim(),
        occurredAt: toIsoDateTime(form.occurredAt),
      });
      setForm({
        type: "CASH_OUT",
        amount: "",
        reason: "",
        occurredAt: toLocalDateTimeInput(),
      });
    } catch {
      // Error is rendered by the parent live region.
    }
  };

  return (
    <form className="cashier-inline-form" onSubmit={handleSubmit}>
      <div className="cashier-inline-form__heading">
        <span aria-hidden="true">
          {form.type === "CASH_OUT" ? (
            <ArrowUpFromLine size={18} />
          ) : (
            <ArrowDownToLine size={18} />
          )}
        </span>
        <div>
          <h4>Tiền vào/ra két</h4>
          <p>Ghi từng biến động để số dự kiến luôn có thể kiểm tra lại.</p>
        </div>
      </div>

      <div className="cashier-reconciliation-form-grid cashier-reconciliation-form-grid--compact">
        <Field label="Loại biến động">
          <select
            name="movementType"
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value,
              }))
            }
            autoComplete="off"
          >
            <option value="CASH_OUT">Rút tiền khỏi két</option>
            <option value="CASH_IN">Bổ sung tiền vào két</option>
          </select>
        </Field>

        <Field label="Số tiền">
          <input
            name="movementAmount"
            type="number"
            inputMode="numeric"
            min="1"
            step="1000"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
            autoComplete="off"
          />
        </Field>

        <Field label="Thời điểm">
          <input
            name="movementOccurredAt"
            type="datetime-local"
            value={form.occurredAt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                occurredAt: event.target.value,
              }))
            }
            autoComplete="off"
          />
        </Field>

        <Field label="Lý do bắt buộc">
          <input
            name="movementReason"
            value={form.reason}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                reason: event.target.value,
              }))
            }
            autoComplete="off"
            placeholder="Nộp bớt tiền, bổ sung tiền lẻ…"
          />
        </Field>
      </div>

      <button
        type="submit"
        className={actionButtonClass()}
        disabled={!valid || actionLoading}
      >
        {form.type === "CASH_OUT" ? (
          <ArrowUpFromLine size={16} aria-hidden="true" />
        ) : (
          <ArrowDownToLine size={16} aria-hidden="true" />
        )}
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
      <div className="cashier-inline-form__heading">
        <span aria-hidden="true">
          <ClipboardCheck size={18} />
        </span>
        <div>
          <h4>Nộp chốt quỹ cuối ca</h4>
          <p>Khóa số tiền thực đếm và chuyển kết quả sang quản lý duyệt.</p>
        </div>
      </div>

      <div className="cashier-reconciliation-form-grid cashier-reconciliation-form-grid--compact">
        <Field label="Tiền thực đếm">
          <input
            name="actualCash"
            type="number"
            inputMode="numeric"
            min="0"
            step="1000"
            value={form.actualCash}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                actualCash: event.target.value,
              }))
            }
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Thời điểm đóng ca">
          <input
            name="closedAt"
            type="datetime-local"
            value={form.closedAt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                closedAt: event.target.value,
              }))
            }
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Ghi chú thu ngân">
          <textarea
            name="cashierNote"
            rows={2}
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
            autoComplete="off"
          />
        </Field>

        <Field label="Link chứng từ" hint="Mỗi link một dòng.">
          <textarea
            name="evidenceAttachments"
            rows={2}
            value={form.evidenceAttachments}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                evidenceAttachments: event.target.value,
              }))
            }
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </div>

      <button
        type="submit"
        className={actionButtonClass("primary")}
        disabled={!valid || actionLoading}
      >
        <ClipboardCheck size={16} aria-hidden="true" />
        {actionLoading ? "Đang nộp…" : "Nộp chốt quỹ"}
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
  const buttonTone =
    form.decision === "REJECT"
      ? "danger"
      : form.decision === "WAIVE"
        ? "secondary"
        : "primary";

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
        <span aria-hidden="true">
          <ShieldAlert size={19} />
        </span>
        <div>
          <h4>Quản lý xác nhận trách nhiệm</h4>
          <p>
            Chỉ kết quả được duyệt và xác nhận thuộc trách nhiệm thu ngân mới
            ảnh hưởng hiệu suất.
          </p>
        </div>
      </div>

      <div className="cashier-reconciliation-form-grid cashier-reconciliation-form-grid--compact">
        <Field label="Quyết định">
          <select
            name="reviewDecision"
            value={form.decision}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                decision: event.target.value,
                attributableToCashier:
                  event.target.value === "APPROVE"
                    ? current.attributableToCashier
                    : false,
              }))
            }
            autoComplete="off"
          >
            {Object.entries(DECISION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Điều chỉnh số dự kiến"
          hint="Dùng số âm/dương khi có chứng từ lấy hoặc bổ sung tiền chưa ghi nhận."
        >
          <input
            name="managerAdjustmentAmount"
            type="number"
            inputMode="numeric"
            step="1000"
            disabled={form.decision !== "APPROVE"}
            value={form.managerAdjustmentAmount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                managerAdjustmentAmount: event.target.value,
              }))
            }
            autoComplete="off"
          />
        </Field>

        <Field label="Lý do quyết định">
          <textarea
            name="reviewNote"
            rows={3}
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
            autoComplete="off"
            required
          />
        </Field>
      </div>

      {form.decision === "APPROVE" ? (
        <label className="cashier-attribution-check">
          <input
            name="attributableToCashier"
            type="checkbox"
            checked={form.attributableToCashier}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                attributableToCashier: event.target.checked,
              }))
            }
          />
          <span>
            <strong>Xác nhận chênh lệch thuộc trách nhiệm thu ngân</strong>
            <small>
              Bỏ chọn khi nguyên nhân đến từ hệ thống, bàn giao, quản lý lấy
              tiền hoặc yếu tố khác.
            </small>
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        className={actionButtonClass(buttonTone)}
        disabled={!valid || actionLoading}
      >
        <CheckCircle2 size={16} aria-hidden="true" />
        {actionLoading ? "Đang lưu…" : DECISION_LABELS[form.decision]}
      </button>
    </form>
  );
}

function ReconciliationDetail({
  item,
  actionLoading,
  onRefresh,
  onMovement,
  onSubmit,
  onReview,
}) {
  if (!item) {
    return (
      <div className="cashier-reconciliation-empty cashier-reconciliation-empty--detail">
        <span className="cashier-reconciliation-empty__icon" aria-hidden="true">
          <Banknote size={22} />
        </span>
        <strong>Chọn một ca để xử lý</strong>
        <p>Số tiền, lịch sử két và hành động phù hợp sẽ hiển thị tại đây.</p>
      </div>
    );
  }

  const adjustment = Number(item.managerAdjustmentAmount || 0);
  const movement = Number(item.movementNetAmount || 0);

  return (
    <article className="cashier-reconciliation-detail">
      <header className="cashier-reconciliation-detail__header">
        <div>
          <div className="cashier-detail-title-line">
            <h3>{item.cashierName || "Thu ngân"}</h3>
            <StatusBadge status={item.status} />
          </div>
          <p>
            {item.cashierCode || "Chưa có mã"} · Két {item.registerCode} · mở{" "}
            {fmtDateTime(item.openedAt)}
          </p>
        </div>

        {item.status === "OPEN" || item.status === "SUBMITTED" ? (
          <button
            type="button"
            className={actionButtonClass()}
            disabled={actionLoading}
            onClick={() => onRefresh(item.id)}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Làm mới số dự kiến
          </button>
        ) : null}
      </header>

      <BalanceOverview item={item} />

      <section
        className="cashier-money-flow"
        aria-label="Nguồn hình thành tiền dự kiến"
      >
        <header>
          <div>
            <h4>Nguồn hình thành tiền dự kiến</h4>
            <p>Mọi khoản đều có thể đối chiếu từ giao dịch hoặc lịch sử két.</p>
          </div>
          <span>{item.transactionIds?.length || 0} giao dịch</span>
        </header>

        <div className="cashier-money-flow__rows">
          <MoneyFlowRow label="Tiền đầu ca" operator="" value={item.openingCash} />
          <MoneyFlowRow
            label="Thu tiền mặt"
            operator="+"
            value={item.cashSalesAmount}
            tone="positive"
          />
          <MoneyFlowRow
            label="Hoàn tiền mặt"
            operator="−"
            value={item.cashRefundAmount}
            tone="negative"
          />
          <MoneyFlowRow
            label="Biến động két"
            operator={movement < 0 ? "−" : "+"}
            value={Math.abs(movement)}
            tone={movement < 0 ? "negative" : "positive"}
          />
          <MoneyFlowRow
            label="Điều chỉnh quản lý"
            operator={adjustment < 0 ? "−" : "+"}
            value={Math.abs(adjustment)}
            tone={adjustment < 0 ? "negative" : "positive"}
          />
        </div>

        <footer>
          <span>Tiền dự kiến cuối ca</span>
          <strong>{fmtMoney(item.expectedCash)}</strong>
        </footer>
      </section>

      <div className="cashier-detail-context" aria-label="Dữ liệu đối chiếu">
        <span>{item.transactionIds?.length || 0} giao dịch tiền mặt</span>
        <span>{item.refundIds?.length || 0} hoàn tiền mặt</span>
        <span>{item.movements?.length || 0} biến động két</span>
        <span>Tỷ lệ lệch {fmtPercent(item.varianceRate)}</span>
      </div>

      {item.movements?.length ? (
        <section className="cashier-movement-history">
          <h4>Lịch sử tiền vào/ra</h4>
          <ul>
            {item.movements.map((movementItem) => (
              <li key={movementItem.id}>
                <span>
                  {movementItem.type === "CASH_OUT"
                    ? "Rút khỏi két"
                    : "Bổ sung vào két"}
                </span>
                <strong>
                  {movementItem.type === "CASH_OUT" ? "−" : "+"}
                  {fmtMoney(movementItem.amount)}
                </strong>
                <small>
                  {movementItem.reason} · {fmtDateTime(movementItem.occurredAt)}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.cashierNote ? (
        <p className="cashier-note">
          <strong>Ghi chú thu ngân:</strong> {item.cashierNote}
        </p>
      ) : null}

      {item.reviewNote ? (
        <p className="cashier-note">
          <strong>Quyết định quản lý:</strong> {item.reviewNote}
        </p>
      ) : null}

      {item.status === "APPROVED" ? (
        <p
          className={
            item.attributableToCashier
              ? "cashier-impact-note cashier-impact-note--warning"
              : "cashier-impact-note"
          }
        >
          {item.attributableToCashier
            ? "Chênh lệch đã được xác nhận thuộc trách nhiệm thu ngân và được dùng làm bằng chứng khi tính lại hiệu suất."
            : "Đối soát đã duyệt nhưng chênh lệch không được quy trách nhiệm cho thu ngân."}
        </p>
      ) : null}

      {item.status === "WAIVED" ? (
        <p className="cashier-impact-note">
          Ca này được miễn trách nhiệm và không ảnh hưởng điểm hiệu suất.
        </p>
      ) : null}

      {item.status === "REJECTED" ? (
        <p className="cashier-impact-note cashier-impact-note--warning">
          Kết quả bị từ chối. Mở ca đối soát mới sau khi đã kiểm tra lại.
        </p>
      ) : null}

      {item.status === "OPEN" ? (
        <>
          <MovementForm
            item={item}
            actionLoading={actionLoading}
            onSubmit={onMovement}
          />
          <SubmitForm
            item={item}
            actionLoading={actionLoading}
            onSubmit={onSubmit}
          />
        </>
      ) : null}

      {item.status === "SUBMITTED" ? (
        <ReviewForm
          item={item}
          actionLoading={actionLoading}
          onSubmit={onReview}
        />
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
  const [localStatus, setLocalStatus] = useState("");
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
  } = useCashierShiftReconciliation({ restaurantId });

  const cashierEmployees = useMemo(
    () => employees.filter(isCashierEmployee),
    [employees],
  );

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      FILTER_STATUSES.map((value) => [value, 0]),
    );
    counts.ALL = items.length;
    items.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
        counts[item.status] += 1;
      }
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(
    () =>
      status === "ALL"
        ? items
        : items.filter((item) => item.status === status),
    [items, status],
  );

  useEffect(() => {
    if (!selectedId && filteredItems[0]?.id) {
      setSelectedId(filteredItems[0].id);
      return;
    }
    if (
      selectedId &&
      !filteredItems.some((item) => item.id === selectedId)
    ) {
      setSelectedId(filteredItems[0]?.id || "");
    }
  }, [filteredItems, selectedId]);

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

  const selected =
    filteredItems.find((item) => item.id === selectedId) || null;

  const runAction = async (operation, resultField, successMessage) => {
    setLocalError("");
    setLocalStatus("");
    try {
      const result = await operation();
      const nextItem = result?.data?.[resultField];
      if (nextItem?.id) setSelectedId(nextItem.id);
      setLocalStatus(successMessage);
      return nextItem;
    } catch (operationError) {
      setLocalError(
        getGraphqlError(
          operationError,
          "Không thể thực hiện thao tác đối soát.",
        ),
      );
      throw operationError;
    }
  };

  const hasCashiers = cashierEmployees.length > 0;

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
        aria-busy={loading || actionLoading}
      >
        <header className="cashier-reconciliation-modal__header">
          <div className="cashier-reconciliation-heading-icon" aria-hidden="true">
            <CircleDollarSign size={22} />
          </div>
          <div>
            <span>Kiểm soát tiền mặt theo ca</span>
            <h2 id="cashier-reconciliation-title">Đối soát ca thu ngân</h2>
            <p id="cashier-reconciliation-description">
              {restaurantName}. Chênh lệch chỉ ảnh hưởng hiệu suất sau khi quản
              lý xác minh trách nhiệm.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="cashier-icon-button"
            onClick={onClose}
            aria-label="Đóng đối soát ca thu ngân"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="cashier-reconciliation-toolbar">
          <div
            className="cashier-status-filter"
            role="group"
            aria-label="Lọc trạng thái đối soát"
          >
            {FILTER_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                className={status === value ? "active" : ""}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                <span>
                  {value === "ALL"
                    ? "Tất cả"
                    : STATUS_META[value]?.label || value}
                </span>
                <strong>{statusCounts[value]}</strong>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={actionButtonClass("primary")}
            disabled={!restaurantId || !hasCashiers || actionLoading}
            onClick={() => setShowOpenForm((current) => !current)}
            aria-expanded={showOpenForm}
            title={
              hasCashiers
                ? "Mở biểu mẫu tạo ca thu ngân"
                : "Chưa có nhân viên được gán vai trò thu ngân"
            }
          >
            <Plus size={16} aria-hidden="true" />
            Mở ca mới
          </button>
        </div>

        {showOpenForm ? (
          <OpenShiftForm
            employees={cashierEmployees}
            restaurantId={restaurantId}
            actionLoading={actionLoading}
            onCancel={() => setShowOpenForm(false)}
            onSubmit={async (input) => {
              await runAction(
                () => openReconciliation(input),
                "openCashierShiftReconciliation",
                "Đã mở ca thu ngân.",
              );
              setShowOpenForm(false);
            }}
          />
        ) : null}

        {error || actionError || localError ? (
          <p className="cashier-reconciliation-error" role="alert">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>
              {localError ||
                getGraphqlError(
                  actionError || error,
                  "Không tải được dữ liệu đối soát.",
                )}
            </span>
          </p>
        ) : null}

        {localStatus || actionLoading ? (
          <p
            className="cashier-reconciliation-status-message"
            role="status"
            aria-live="polite"
          >
            {actionLoading ? "Đang cập nhật dữ liệu…" : localStatus}
          </p>
        ) : null}

        {loading && !items.length ? (
          <LoadingState />
        ) : (
          <div className="cashier-reconciliation-content">
            <aside
              className="cashier-reconciliation-list"
              aria-label="Danh sách ca đối soát"
              aria-live="polite"
            >
              {filteredItems.length === 0 ? (
                <EmptyState canOpenShift={hasCashiers} />
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      selectedId === item.id
                        ? "cashier-reconciliation-row active"
                        : "cashier-reconciliation-row"
                    }
                    aria-pressed={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="cashier-row-main">
                      <strong>{item.cashierName || "Thu ngân"}</strong>
                      <small>
                        {item.cashierCode || "Chưa có mã"} · Két{" "}
                        {item.registerCode}
                      </small>
                    </span>
                    <StatusBadge status={item.status} />
                    <span className="cashier-row-values">
                      <small>{fmtDateTime(item.openedAt)}</small>
                      <strong>
                        {item.actualCash == null
                          ? "Chưa chốt"
                          : fmtMoney(item.varianceAmount)}
                      </strong>
                    </span>
                  </button>
                ))
              )}
            </aside>

            <ReconciliationDetail
              item={selected}
              actionLoading={actionLoading}
              onRefresh={(id) =>
                runAction(
                  () => refreshReconciliation(id),
                  "refreshCashierShiftReconciliation",
                  "Đã làm mới số tiền dự kiến.",
                )
              }
              onMovement={(input) =>
                runAction(
                  () => addMovement(input),
                  "addCashierShiftCashMovement",
                  "Đã lưu biến động két.",
                )
              }
              onSubmit={(input) =>
                runAction(
                  () => submitReconciliation(input),
                  "submitCashierShiftReconciliation",
                  "Đã nộp chốt quỹ để quản lý duyệt.",
                )
              }
              onReview={(input) =>
                runAction(
                  () => reviewReconciliation(input),
                  "reviewCashierShiftReconciliation",
                  "Đã lưu quyết định đối soát.",
                )
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
