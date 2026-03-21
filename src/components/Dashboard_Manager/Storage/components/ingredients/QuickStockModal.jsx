import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import "./QuickStockModal.scss";

/**
 * QuickStockModal
 * - Dùng chung cho nguyên liệu và supply
 * - Hỗ trợ nhiều dòng nhập (khi mở từ cảnh báo kho)
 *
 * entry: {
 *   id: string;
 *   type: "ingredient" | "supply";
 *   name: string;
 *   unit: string;
 * }
 */
const QuickStockModal = ({ isOpen, onClose, entries = [], onSubmit }) => {
  const normalized = useMemo(() => {
    return (entries || []).map((e) => ({
      id: String(e.id || ""),
      type: e.type === "supply" ? "supply" : "ingredient",
      name: e.name || "",
      unit: e.unit || "",
    }));
  }, [entries]);

  const [formRows, setFormRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const defaultDate = now.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
    setFormRows(
      normalized.map((e) => ({
        ...e,
        qty: "",
        supplier: "",
        note: "",
        datetime: defaultDate,
      }))
    );
    setErrors({});
    setSubmitError("");
    setSubmitting(false);
  }, [isOpen, normalized]);

  if (!isOpen) return null;

  const updateRow = (idx, patch) => {
    setFormRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  const validate = () => {
    const nextErrors = {};
    formRows.forEach((row, idx) => {
      const qtyNum = Number(row.qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        nextErrors[idx] = "Số lượng phải > 0";
        return;
      }
      // Cả ingredient và supply đều lưu integer ở BE
      if (!Number.isInteger(qtyNum)) {
        nextErrors[idx] = "Số lượng phải là số nguyên";
        return;
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (submitting) return;
    if (!validate()) return;
    setSubmitError("");
    const payload = formRows.map((row) => ({
      id: row.id,
      type: row.type,
      qty: Number(row.qty),
      unit: row.unit,
      supplier: row.supplier?.trim() || null,
      note: row.note?.trim() || null,
      datetime: row.datetime ? new Date(row.datetime).toISOString() : null,
    }));
    try {
      setSubmitting(true);
      await onSubmit?.(payload);
    } catch (e) {
      setSubmitError(e?.message || "Không thể nhập kho. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📦 Nhập kho nhanh"
      size="lg"
    >
      <div className="qsm-wrapper">
        {submitError ? <div className="qsm-error">{submitError}</div> : null}
        <div className="qsm-list">
          {formRows.map((row, idx) => (
            <div className="qsm-item" key={`${row.id}-${idx}`}>
              <div className="qsm-item__head">
                <div>
                  <div className="qsm-name">{row.name || "—"}</div>
                  <div className="qsm-meta">
                    {row.type === "supply" ? "Supply" : "Nguyên liệu"} • Đơn vị
                    nhập: <b>{row.unit || "—"}</b>
                  </div>
                </div>
                <span className="qsm-badge">#{idx + 1}</span>
              </div>

              <div className="qsm-grid">
                <label className="qsm-field">
                  <span className="qsm-label">
                    Số lượng <span className="req">*</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.qty}
                    onChange={(e) => updateRow(idx, { qty: e.target.value })}
                    className={errors[idx] ? "error" : ""}
                    placeholder="0"
                  />
                  {errors[idx] && (
                    <small className="qsm-error">{errors[idx]}</small>
                  )}
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Nhà cung cấp / Nguồn</span>
                  <input
                    type="text"
                    value={row.supplier}
                    onChange={(e) =>
                      updateRow(idx, { supplier: e.target.value })
                    }
                    placeholder="Tên NCC hoặc nguồn"
                  />
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Ngày giờ nhập</span>
                  <input
                    type="datetime-local"
                    value={row.datetime}
                    onChange={(e) =>
                      updateRow(idx, { datetime: e.target.value })
                    }
                  />
                </label>
              </div>

              <label className="qsm-field">
                <span className="qsm-label">Ghi chú</span>
                <textarea
                  value={row.note}
                  onChange={(e) => updateRow(idx, { note: e.target.value })}
                  placeholder="Thông tin bổ sung..."
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <Modal.Footer>
        <button className="qsm-btn qsm-btn--secondary" onClick={onClose}>
          Huỷ
        </button>
        <button
          className="qsm-btn qsm-btn--primary"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Đang nhập..." : "Xác nhận nhập kho"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default QuickStockModal;
