import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LockKeyhole,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import useStaffPerformancePolicy from "@/hooks/useStaffPerformancePolicy";
import {
  resetPerformanceLevelThresholds,
  setPerformanceLevelThresholds,
} from "@/utils/staffPerformanceGlobalFormat";
import StaffPerformancePage, {
  resolveEffectivePerformanceRestaurantId,
} from "./StaffPerformancePage";
import "./StaffPerformancePolicyPage.scss";

export const DEFAULT_POLICY_THRESHOLDS = Object.freeze({
  excellentMin: 90,
  goodMin: 80,
  averageMin: 65,
  needsAttentionMin: 50,
});

const THRESHOLD_FIELDS = [
  {
    key: "excellentMin",
    label: "Xuất sắc từ",
    help: "Điểm bằng hoặc cao hơn mốc này được xếp Xuất sắc.",
  },
  {
    key: "goodMin",
    label: "Tốt từ",
    help: "Khoảng từ mốc này đến dưới Xuất sắc.",
  },
  {
    key: "averageMin",
    label: "Trung bình từ",
    help: "Khoảng từ mốc này đến dưới Tốt.",
  },
  {
    key: "needsAttentionMin",
    label: "Cần chú ý từ",
    help: "Điểm thấp hơn mốc này được xếp Kém.",
  },
];

const FORMULA_LABELS = {
  productivity: "Năng suất",
  punctuality: "Đúng giờ",
  quality: "Chất lượng",
  managerReview: "Đánh giá quản lý",
  compliance: "Tuân thủ",
};

const DEFAULT_WEIGHTS = {
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
};

const DEFAULT_LOCKED_RULES = [
  "Trọng số 25/25/20/20/10",
  "Công thức năng suất theo thời lượng ca",
  "Mức trừ đi trễ, về sớm và vắng mặt",
  "Quy tắc Chất lượng theo từng vai trò",
  "Mức trừ yêu cầu chỉnh công",
  "Quy trình incident và hoàn điểm appeal",
];

export const validatePolicyThresholds = (values = {}) => {
  const normalized = Object.fromEntries(
    THRESHOLD_FIELDS.map(({ key }) => [key, Number(values[key])]),
  );
  const invalidField = THRESHOLD_FIELDS.find(({ key }) => {
    const value = normalized[key];
    return !Number.isInteger(value) || value < 1 || value > 100;
  });

  if (invalidField) {
    return {
      valid: false,
      message: `${invalidField.label} phải là số nguyên từ 1 đến 100.`,
      values: normalized,
    };
  }

  if (
    !(
      normalized.excellentMin > normalized.goodMin &&
      normalized.goodMin > normalized.averageMin &&
      normalized.averageMin > normalized.needsAttentionMin
    )
  ) {
    return {
      valid: false,
      message:
        "Các mốc phải giảm nghiêm ngặt: Xuất sắc > Tốt > Trung bình > Cần chú ý.",
      values: normalized,
    };
  }

  return { valid: true, message: "", values: normalized };
};

const rangePreview = (thresholds) => [
  `Xuất sắc: ${thresholds.excellentMin}–100`,
  `Tốt: ${thresholds.goodMin}–${thresholds.excellentMin - 1}`,
  `Trung bình: ${thresholds.averageMin}–${thresholds.goodMin - 1}`,
  `Cần chú ý: ${thresholds.needsAttentionMin}–${thresholds.averageMin - 1}`,
  `Kém: 0–${thresholds.needsAttentionMin - 1}`,
];

const PolicyModal = ({
  open,
  restaurantName,
  policy,
  loading,
  error,
  saving,
  onClose,
  onSave,
}) => {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [form, setForm] = useState(DEFAULT_POLICY_THRESHOLDS);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      ...DEFAULT_POLICY_THRESHOLDS,
      ...(policy?.levelThresholds || {}),
    });
    setActionError("");
  }, [open, policy?.levelThresholds]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, open]);

  const validation = useMemo(() => validatePolicyThresholds(form), [form]);
  const weights = policy?.weights || DEFAULT_WEIGHTS;
  const lockedRules = policy?.lockedFields?.length
    ? policy.lockedFields
    : DEFAULT_LOCKED_RULES;

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validation.valid) {
      setActionError(validation.message);
      return;
    }
    setActionError("");
    try {
      await onSave(validation.values);
    } catch (saveError) {
      setActionError(
        saveError?.graphQLErrors?.[0]?.message ||
          saveError?.message ||
          "Không thể lưu cấu hình đánh giá.",
      );
    }
  };

  return (
    <div
      className="performance-policy-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="performance-policy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="performance-policy-title"
        aria-describedby="performance-policy-description"
      >
        <header className="performance-policy-modal__header">
          <div>
            <span className="performance-policy-eyebrow">Quy tắc theo nhà hàng</span>
            <h2 id="performance-policy-title">Cấu hình đánh giá hiệu suất</h2>
            <p id="performance-policy-description">
              {restaurantName}. Chỉ các mốc xếp loại được phép điều chỉnh.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="performance-policy-close"
            onClick={onClose}
            aria-label="Đóng cấu hình đánh giá"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="performance-policy-status" role="status">
            Đang tải cấu hình hiện tại…
          </div>
        ) : (
          <form className="performance-policy-form" onSubmit={handleSubmit}>
            <section className="performance-policy-section">
              <div className="performance-policy-section__title">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <h3>Công thức đang áp dụng</h3>
                  <p>Tổng trọng số luôn bằng 100% và không thể sửa tại đây.</p>
                </div>
              </div>
              <div className="performance-policy-weights">
                {Object.entries(weights).map(([key, value]) => (
                  <div key={key}>
                    <span>{FORMULA_LABELS[key] || key}</span>
                    <strong>{value}%</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="performance-policy-section performance-policy-section--editable">
              <div className="performance-policy-section__title">
                <SlidersHorizontal size={18} aria-hidden="true" />
                <div>
                  <h3>Được phép điều chỉnh</h3>
                  <p>Các mốc phải là số nguyên và giảm nghiêm ngặt.</p>
                </div>
              </div>
              <div className="performance-policy-threshold-grid">
                {THRESHOLD_FIELDS.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      inputMode="numeric"
                      value={form[field.key]}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }));
                        setActionError("");
                      }}
                    />
                    <small>{field.help}</small>
                  </label>
                ))}
              </div>
              <div className="performance-policy-preview" aria-live="polite">
                <strong>Xem trước khoảng điểm</strong>
                <div>
                  {(validation.valid
                    ? rangePreview(validation.values)
                    : [validation.message]
                  ).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </section>

            <section className="performance-policy-section performance-policy-section--locked">
              <div className="performance-policy-section__title">
                <LockKeyhole size={18} aria-hidden="true" />
                <div>
                  <h3>Được bảo vệ, không thể sửa</h3>
                  <p>Các quy tắc này cần thay đổi bằng phiên bản nghiệp vụ có kiểm thử.</p>
                </div>
              </div>
              <ul>
                {lockedRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>

            <div className="performance-policy-impact-note">
              <strong>Phạm vi tác động</strong>
              <p>
                Mốc mới chỉ áp dụng khi tính lại hiệu suất. Snapshot và báo cáo lịch sử
                không bị sửa âm thầm.
              </p>
            </div>

            {error || actionError ? (
              <p className="performance-policy-error" role="alert">
                {actionError || error?.message || "Không tải được cấu hình."}
              </p>
            ) : null}

            <footer className="performance-policy-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Hủy
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !validation.valid || Boolean(error)}
              >
                {saving ? "Đang lưu…" : "Lưu mốc xếp loại"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
};

const StaffPerformancePolicyPage = (props) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [policyRenderKey, setPolicyRenderKey] = useState("default");
  const restaurantId = resolveEffectivePerformanceRestaurantId(
    props.selectedRestaurant,
  );
  const restaurantName =
    props.restaurantList?.find(
      (restaurant) => String(restaurant.id) === String(restaurantId),
    )?.name || "Nhà hàng hiện tại";
  const {
    policy,
    loading,
    error,
    updatePolicy,
    updateState,
  } = useStaffPerformancePolicy({ restaurantId });

  useEffect(() => {
    resetPerformanceLevelThresholds();
    setPolicyRenderKey(`${restaurantId || "none"}:default`);
    setStatusMessage("");
  }, [restaurantId]);

  useEffect(() => {
    if (!policy?.levelThresholds) return;
    setPerformanceLevelThresholds(policy.levelThresholds);
    setPolicyRenderKey(
      `${restaurantId}:${JSON.stringify(policy.levelThresholds)}`,
    );
  }, [policy?.levelThresholds, restaurantId]);

  const handleSave = async (thresholds) => {
    const result = await updatePolicy({
      variables: {
        input: {
          restaurantId,
          levelThresholds: thresholds,
        },
      },
    });
    const saved = result?.data?.updateStaffPerformancePolicy;
    if (!saved?.levelThresholds) {
      throw new Error("Hệ thống không trả về cấu hình đã lưu.");
    }
    setPerformanceLevelThresholds(saved.levelThresholds);
    setPolicyRenderKey(
      `${restaurantId}:${JSON.stringify(saved.levelThresholds)}`,
    );
    setStatusMessage(
      "Đã lưu mốc xếp loại. Hãy tính lại hiệu suất để áp dụng cho snapshot mới.",
    );
    setModalOpen(false);
  };

  return (
    <div className="staff-performance-policy-shell">
      <section className="performance-policy-launcher">
        <div>
          <span className="performance-policy-launcher__icon" aria-hidden="true">
            <Settings2 size={18} />
          </span>
          <div>
            <strong>Quy tắc đánh giá</strong>
            <p>
              Trọng số và công thức được khóa; quản lý chỉ điều chỉnh mốc xếp loại.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="performance-policy-open-button"
          onClick={() => setModalOpen(true)}
          disabled={!restaurantId}
          title={
            restaurantId
              ? "Mở cấu hình đánh giá hiệu suất"
              : "Chọn một nhà hàng cụ thể trước khi cấu hình"
          }
        >
          <Settings2 size={17} aria-hidden="true" />
          Cấu hình đánh giá
        </button>
      </section>

      {statusMessage ? (
        <p className="performance-policy-saved" role="status">
          {statusMessage}
        </p>
      ) : null}

      <StaffPerformancePage key={policyRenderKey} {...props} />

      <PolicyModal
        open={modalOpen}
        restaurantName={restaurantName}
        policy={policy}
        loading={loading}
        error={error || updateState.error}
        saving={updateState.loading}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};

export default StaffPerformancePolicyPage;
