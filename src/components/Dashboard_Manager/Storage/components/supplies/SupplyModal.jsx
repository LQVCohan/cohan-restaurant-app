import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLazyQuery } from "@apollo/client";
import Modal from "../../../../common/Modal";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";
import { getSupplyActionErrorMessage } from "@/utils/inventorySupplySupplierPrintErrorMessages";
import { Q_SUGGEST_SUPPLY_CATEGORY } from "../../graphql/supply.gql";
import "./SupplyModal.scss";

const UNITS = [
  { value: "unit", label: "Đơn vị (unit)" },
  { value: "piece", label: "Cái (piece)" },
  { value: "bottle", label: "Chai (bottle)" },
  { value: "can", label: "Lon (can)" },
  { value: "pack", label: "Gói (pack)" },
  { value: "g", label: "Gram (g)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "l", label: "Lít" },
  { value: "tbsp", label: "Muỗng canh (tbsp)" },
  { value: "tsp", label: "Muỗng cà phê (tsp)" },
];

const defaultForm = {
  name: "",
  sku: "",
  category: "Other",
  unit: "unit",
  costPerUnit: "",
  pricePerUnit: "",
  minStock: "",
  isActive: true,
  notes: "",
};

const normalizeCategoryName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const toFriendlySupplyError = (error) => {
  const graphQLErrors = error?.graphQLErrors || error?.networkError?.result?.errors || [];
  const first = graphQLErrors[0];
  const code = first?.extensions?.code;
  const message = first?.message || error?.message || "";

  if (code === "DUPLICATE_SUPPLY_CODE" || /Mã vật tư đã tồn tại/i.test(message)) {
    return {
      message: "Mã vật tư đã tồn tại. Vui lòng dùng mã khác.",
      fieldErrors: { sku: "Mã vật tư đã tồn tại." },
    };
  }

  if (code === "DUPLICATE_SUPPLY_NAME" || /đã tồn tại trong danh mục/i.test(message)) {
    return {
      message,
      fieldErrors: { name: "Tên vật tư đã tồn tại trong danh mục này." },
    };
  }

  return {
    message: message.replace(/^GraphQL error:\s*/i, "").trim() || "Không thể lưu vật tư. Vui lòng thử lại.",
    fieldErrors: {},
  };
};

const SupplyModal = ({
  isOpen,
  onClose,
  initial = null,
  restaurantId,
  categoryOptions = [],
  onSubmit,
  onOpenInbound,
  onOpenOutbound,
}) => {
  const isEditing = !!initial;
  const { showNotification } = useNotification();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiState, setAiState] = useState("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestIdRef = useRef(0);

  const [loadSuggestion] = useLazyQuery(Q_SUGGEST_SUPPLY_CATEGORY, {
    fetchPolicy: "no-cache",
  });

  const subtitle = useMemo(
    () =>
      isEditing
        ? "Điều chỉnh thông tin vật phẩm, giá vốn và trạng thái hoạt động."
        : "Thiết lập vật phẩm mới vào hệ thống quản lý kho.",
    [isEditing],
  );

  const dynamicCategoryOptions = useMemo(() => {
    const base = Array.isArray(categoryOptions) ? categoryOptions : [];
    const mapped = base
      .map((item) => ({ value: normalizeCategoryName(item?.name), label: normalizeCategoryName(item?.name) }))
      .filter((item) => item.value);

    const legacy = ["Beverage", "Tissue & Paper", "Cleaning", "Condiments & Packaging", "Disposable", "Other"]
      .map((name) => ({ value: name, label: name }));

    const suggested = aiSuggestion?.categoryName
      ? [{ value: aiSuggestion.categoryName, label: aiSuggestion.categoryName }]
      : [];

    return [...new Map([...mapped, ...legacy, ...suggested].map((item) => [item.value.toLowerCase(), item])).values()];
  }, [categoryOptions, aiSuggestion?.categoryName]);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        sku: initial.sku ?? initial.code ?? initial.itemCode ?? initial.item_code ?? "",
        category: normalizeCategoryName(initial.category) || "Other",
        unit: initial.unit ?? "unit",
        costPerUnit: typeof initial.costPerUnit === "number" ? String(initial.costPerUnit) : "",
        pricePerUnit: typeof initial.pricePerUnit === "number" ? String(initial.pricePerUnit) : "",
        minStock: typeof initial.minStock === "number" ? String(initial.minStock) : "",
        isActive: initial.isActive ?? true,
        notes: initial.notes ?? "",
      });
    } else {
      setForm(defaultForm);
    }
    setErrors({});
    setCategoryTouched(false);
    setAiSuggestion(null);
    setAiState("idle");
  }, [initial, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const name = String(form.name || "").trim();
    if (!restaurantId || name.length < 2) {
      setAiSuggestion(null);
      setAiState("idle");
      return;
    }

    const id = ++requestIdRef.current;
    setAiState("loading");
    const timer = setTimeout(async () => {
      try {
        const { data } = await loadSuggestion({
          variables: {
            restaurantId,
            name,
            category: isEditing ? initial?.category || "" : "",
          },
        });
        if (id !== requestIdRef.current) return;
        const next = data?.suggestSupplyCategory || null;
        setAiSuggestion(next);
        setAiState(next ? "ready" : "idle");

        const canAutoSelect = !categoryTouched && (!isEditing || !String(initial?.category || "").trim());
        if (next?.autoSelected && canAutoSelect) {
          setForm((prev) => ({ ...prev, category: next.categoryName || prev.category }));
        }
      } catch {
        if (id === requestIdRef.current) {
          setAiState("error");
          setAiSuggestion(null);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.name, restaurantId, loadSuggestion, categoryTouched, isEditing, initial?.category, isOpen]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const isDirty = useMemo(() => {
    const base = initial
      ? {
          name: initial.name ?? "",
          sku: initial.sku ?? initial.code ?? initial.itemCode ?? initial.item_code ?? "",
          category: normalizeCategoryName(initial.category) || "Other",
          unit: initial.unit ?? "unit",
          costPerUnit: typeof initial.costPerUnit === "number" ? String(initial.costPerUnit) : "",
          pricePerUnit: typeof initial.pricePerUnit === "number" ? String(initial.pricePerUnit) : "",
          minStock: typeof initial.minStock === "number" ? String(initial.minStock) : "",
          isActive: initial.isActive ?? true,
          notes: initial.notes ?? "",
        }
      : defaultForm;
    return JSON.stringify(form) !== JSON.stringify(base);
  }, [form, initial]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "storage",
      modal: "supply-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: isEditing ? "edit" : "create",
      entityType: "supply",
      recordId: initial?.id || null,
      context: "supply-list",
      schemaVersion: "2",
    },
    formValue: form,
    isDirty,
    sanitize: (v) => ({
      name: v?.name || "",
      sku: v?.sku || "",
      category: normalizeCategoryName(v?.category) || "Other",
      unit: v?.unit || "unit",
      costPerUnit: v?.costPerUnit ?? "",
      pricePerUnit: v?.pricePerUnit ?? "",
      minStock: v?.minStock ?? "",
      isActive: !!v?.isActive,
      notes: v?.notes || "",
    }),
    onRestore: (draft) => setForm((prev) => ({ ...prev, ...draft })),
    notify: showNotification,
  });

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập tên vật phẩm";
    if (!form.unit) e.unit = "Chọn đơn vị";
    if (form.costPerUnit === "" || Number(form.costPerUnit) < 0) e.costPerUnit = "Giá trị không hợp lệ";
    if (form.pricePerUnit === "" || Number(form.pricePerUnit) < 0) e.pricePerUnit = "Giá trị không hợp lệ";
    if (form.minStock === "" || Number(form.minStock) < 0) e.minStock = "≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      sku: String(form.sku || "").trim(),
      category: normalizeCategoryName(form.category) || "Other",
      unit: form.unit || "unit",
      costPerUnit: Number(form.costPerUnit) || 0,
      pricePerUnit: Number(form.pricePerUnit) || 0,
      minStock: Number(form.minStock) || 0,
      isActive: !!form.isActive,
      notes: form.notes?.trim() || "",
    };
    try {
      setIsSubmitting(true);
      await onSubmit?.(payload);
      clearDraft();
      showNotification("Đã xóa dữ liệu nháp sau khi hoàn tất lưu.", "success", 2200);
    } catch (error) {
      const friendly = toFriendlySupplyError(error);
      setErrors((prev) => ({ ...prev, ...friendly.fieldErrors }));
      showNotification(
        getSupplyActionErrorMessage(error, friendly.message),
        "error",
      );
      // giữ draft khi submit lỗi
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => requestCloseWithDraft(onClose)}
      title={isEditing ? "Chỉnh sửa vật phẩm" : "Thêm vật phẩm mới"}
      size="lg"
      className="supply-modal-shell"
    >
      <Modal.Body className="supply-modal-body">
        <div className="sm-container">
          <section className="sm-hero" aria-label="Tóm tắt vật phẩm">
            <div className="sm-hero__icon" aria-hidden="true">▣</div>
            <div className="sm-hero__copy">
              <span className="sm-eyebrow">Vật tư & hàng hóa</span>
              <h3>{isEditing ? "Cập nhật hồ sơ vật phẩm" : "Tạo vật phẩm mới"}</h3>
              <p>{subtitle}</p>
            </div>
            <span className={`sm-hero__status ${form.isActive ? "is-active" : "is-inactive"}`}>
              {form.isActive ? "Đang hoạt động" : "Ngưng sử dụng"}
            </span>
          </section>

          <section className="sm-section">
            <div className="sm-section__header">
              <div>
                <span className="sm-section__kicker">01</span>
                <h4>Thông tin định danh</h4>
              </div>
              <p>Tên, mã vật tư và nhóm danh mục trong kho.</p>
            </div>

            <div className="sm-grid-2">
              <label className="sm-field">
                <span className="sm-label">Tên vật phẩm <b className="req">*</b></span>
                <input
                  className={`sm-input ${errors.name ? "error" : ""}`}
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="VD: Coca-Cola 330ml"
                />
                {errors.name && <small className="sm-msg">{errors.name}</small>}
              </label>

              <label className="sm-field">
                <span className="sm-label">Mã vật tư <em>Tùy chọn</em></span>
                <input
                  className={`sm-input ${errors.sku ? "error" : ""}`}
                  value={form.sku}
                  onChange={(e) => set({ sku: e.target.value })}
                  placeholder="VD: SUP-COCA-330"
                />
                {errors.sku && <small className="sm-msg">{errors.sku}</small>}
              </label>

              <label className="sm-field sm-field--wide">
                <span className="sm-label">Danh mục</span>
                <select
                  className="sm-input"
                  value={form.category}
                  onChange={(e) => {
                    setCategoryTouched(true);
                    set({ category: e.target.value });
                  }}
                >
                  {dynamicCategoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {aiState === "loading" && <small className="sm-help">AI đang gợi ý danh mục...</small>}
                {aiState === "ready" && aiSuggestion && (
                  <small className="sm-help">
                    Gợi ý AI: <b>{aiSuggestion.categoryName}</b>
                    {aiSuggestion.autoSelected && !categoryTouched ? " • Đã tự chọn từ AI" : " • Bạn có thể đổi tay"}
                    {!aiSuggestion.existing ? " • Danh mục mới sẽ được tạo khi lưu" : ""}
                  </small>
                )}
              </label>
            </div>
          </section>

          <section className="sm-section">
            <div className="sm-section__header">
              <div>
                <span className="sm-section__kicker">02</span>
                <h4>Đơn vị, giá và tồn tối thiểu</h4>
              </div>
              <p>Giữ dữ liệu giá vốn rõ ràng để báo cáo kho chính xác.</p>
            </div>

            <div className="sm-grid-4">
              <label className="sm-field">
                <span className="sm-label">Đơn vị <b className="req">*</b></span>
                <select className={`sm-input ${errors.unit ? "error" : ""}`} value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                {errors.unit && <small className="sm-msg">{errors.unit}</small>}
              </label>

              <label className="sm-field">
                <span className="sm-label">Giá nhập <b className="req">*</b></span>
                <input className={`sm-input ${errors.costPerUnit ? "error" : ""}`} type="number" min="0" value={form.costPerUnit} onChange={(e) => set({ costPerUnit: e.target.value })} placeholder="0" />
                {errors.costPerUnit && <small className="sm-msg">{errors.costPerUnit}</small>}
              </label>

              <label className="sm-field">
                <span className="sm-label">Giá bán <b className="req">*</b></span>
                <input className={`sm-input ${errors.pricePerUnit ? "error" : ""}`} type="number" min="0" value={form.pricePerUnit} onChange={(e) => set({ pricePerUnit: e.target.value })} placeholder="0" />
                {errors.pricePerUnit && <small className="sm-msg">{errors.pricePerUnit}</small>}
              </label>

              <label className="sm-field">
                <span className="sm-label">Tồn tối thiểu <b className="req">*</b></span>
                <input className={`sm-input ${errors.minStock ? "error" : ""}`} type="number" min="0" step="0.01" value={form.minStock} onChange={(e) => set({ minStock: e.target.value })} placeholder="0" />
                {errors.minStock && <small className="sm-msg">{errors.minStock}</small>}
              </label>
            </div>
          </section>

          <section className="sm-section sm-section--soft">
            <div className="sm-grid-2 sm-grid-2--compact">
              <div className="sm-field">
                <span className="sm-label">Trạng thái</span>
                <button
                  type="button"
                  className={`sm-status-toggle ${form.isActive ? "is-active" : "is-inactive"}`}
                  aria-pressed={form.isActive}
                  onClick={() => set({ isActive: !form.isActive })}
                >
                  <span className="status-main">
                    <span className="status-dot" aria-hidden="true" />
                    <span>{form.isActive ? "Đang hoạt động" : "Ngưng sử dụng"}</span>
                  </span>
                  <span className="status-hint">
                    {form.isActive ? "Bấm để tạm ngưng" : "Bấm để kích hoạt lại"}
                  </span>
                </button>
              </div>

              <label className="sm-field">
                <span className="sm-label">Ghi chú</span>
                <textarea className="sm-input sm-textarea" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ghi chú nội bộ, quy cách lưu kho hoặc nhà cung cấp..." />
              </label>
            </div>
          </section>

          {isEditing && (onOpenInbound || onOpenOutbound) && (
            <section className="sm-quick-actions">
              <div className="qa-info">
                <span className="qa-badge">FIFO</span>
                <p>Ưu tiên xuất các lô hàng cũ trước để kiểm soát tuổi thọ vật phẩm.</p>
              </div>
              <div className="qa-buttons">
                {onOpenInbound && <button type="button" className="sm-btn-ghost" onClick={() => onOpenInbound?.(initial)}>Nhập kho</button>}
                {onOpenOutbound && <button type="button" className="sm-btn-ghost" onClick={() => onOpenOutbound?.(initial)}>Xuất kho</button>}
              </div>
            </section>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button type="button" className="sm-btn-cancel" onClick={() => requestCloseWithDraft(onClose)}>Hủy bỏ</button>
        <button type="button" className="sm-btn-submit" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Xác nhận tạo"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default SupplyModal;
