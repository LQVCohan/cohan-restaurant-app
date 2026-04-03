import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import { toBaseQty } from "../../../../../utils/unitConversion";
import { formatPrice } from "../../../../../utils/formatters";
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
const QuickStockModal = ({
  isOpen,
  onClose,
  entries = [],
  onSubmit,
  ingredients = [],
  onGetPriceSuggestions,
}) => {
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
  const [priceHintsByIngredient, setPriceHintsByIngredient] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ingredientMap = useMemo(() => {
    const map = new Map();
    (ingredients || []).forEach((x) => map.set(String(x.id), x));
    return map;
  }, [ingredients]);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const defaultDate = now.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
    setFormRows(
      normalized.map((e) => ({
        ...e,
        qty: "",
        unitPrice: "",
        lot: "",
        expiry: "",
        supplier: "",
        note: "",
        datetime: defaultDate,
      }))
    );
    setErrors({});
    setSubmitError("");
    setSubmitting(false);
    setPriceHintsByIngredient({});
  }, [isOpen, normalized]);

  useEffect(() => {
    if (!isOpen || !onGetPriceSuggestions) return;
    let cancelled = false;
    const run = async () => {
      const pairs = await Promise.all(
        normalized.map(async (e) => {
          try {
            const data = await onGetPriceSuggestions?.(e.id, 5);
            return [String(e.id), data];
          } catch {
            return [String(e.id), null];
          }
        }),
      );
      if (cancelled) return;
      setPriceHintsByIngredient(Object.fromEntries(pairs));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, onGetPriceSuggestions, normalized]);

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
      const priceNum = Number(row.unitPrice);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        nextErrors[idx] = "Giá nhập là bắt buộc và phải > 0";
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
      unitPrice: Number(row.unitPrice),
      supplier: row.supplier?.trim() || null,
      note: row.note?.trim() || null,
      datetime: row.datetime ? new Date(row.datetime).toISOString() : null,
      lot: row.lot?.trim() || null,
      expiry: row.expiry || null,
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

  const getAllowedUnits = (row) => {
    const ing = ingredientMap.get(String(row.id));
    if (!ing) return [row.unit].filter(Boolean);
    const base = ing.baseUnit || row.unit;
    const set = new Set([base]);
    (ing.conversions || []).forEach((c) => {
      const from = c?.from;
      const to = c?.to;
      if (from === base && to) set.add(to);
      if (to === base && from) set.add(from);
    });
    return Array.from(set);
  };

  const getDerivedPricing = (row) => {
    const ing = ingredientMap.get(String(row.id));
    if (!ing) return null;
    const qty = Number(row.qty) || 0;
    if (!(qty > 0)) return null;
    const unitPrice = Number(row.unitPrice) || 0;
    const qtyBase = toBaseQty(qty, row.unit || ing.baseUnit, ing.baseUnit);
    if (!(qtyBase > 0)) return null;
    const costPerBaseUnit = unitPrice > 0 ? unitPrice / qtyBase : 0;
    return {
      qtyBase,
      costPerBaseUnit,
      totalValue: unitPrice,
      baseUnit: ing.baseUnit,
    };
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
                  <span className="qsm-label">Đơn vị nhập</span>
                  <select
                    value={row.unit}
                    onChange={(e) => updateRow(idx, { unit: e.target.value })}
                  >
                    {getAllowedUnits(row).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">
                    Giá lô nhập (VND) <span className="req">*</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={row.unitPrice}
                    onChange={(e) =>
                      updateRow(idx, { unitPrice: e.target.value })
                    }
                    className={errors[idx] ? "error" : ""}
                    placeholder="0"
                  />
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

                <label className="qsm-field">
                  <span className="qsm-label">Mã lô</span>
                  <input
                    type="text"
                    value={row.lot}
                    onChange={(e) => updateRow(idx, { lot: e.target.value })}
                    placeholder="LOT-2026-001"
                  />
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Hạn dùng</span>
                  <input
                    type="date"
                    value={row.expiry}
                    onChange={(e) => updateRow(idx, { expiry: e.target.value })}
                  />
                </label>
              </div>

              {(() => {
                const hint = priceHintsByIngredient[String(row.id)];
                const d = getDerivedPricing(row);
                return (
                  <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
                    {d && (
                      <div className="qsm-meta">
                        Quy đổi: {Number(d.qtyBase).toLocaleString("vi-VN")}{" "}
                        {d.baseUnit} • Giá/base:{" "}
                        <b>{formatPrice(d.costPerBaseUnit)}</b> • Tổng lô:{" "}
                        <b>{formatPrice(d.totalValue)}</b>
                      </div>
                    )}
                    {hint && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {hint.latestCostPerBaseUnit > 0 && (
                          <button
                            type="button"
                            className="qsm-btn qsm-btn--secondary"
                            onClick={() =>
                              d &&
                              updateRow(idx, {
                                unitPrice: String(
                                  Math.round(
                                    hint.latestCostPerBaseUnit * d.qtyBase,
                                  ),
                                ),
                              })
                            }
                          >
                            Giá gần nhất
                          </button>
                        )}
                        {hint.avgRecentCostPerBaseUnit > 0 && (
                          <button
                            type="button"
                            className="qsm-btn qsm-btn--secondary"
                            onClick={() =>
                              d &&
                              updateRow(idx, {
                                unitPrice: String(
                                  Math.round(
                                    hint.avgRecentCostPerBaseUnit * d.qtyBase,
                                  ),
                                ),
                              })
                            }
                          >
                            TB gần đây
                          </button>
                        )}
                        {(hint.recent || []).slice(0, 3).map((p, pIdx) => (
                          <button
                            key={`${p.movementId}_${pIdx}`}
                            type="button"
                            className="qsm-btn qsm-btn--secondary"
                            onClick={() =>
                              d &&
                              updateRow(idx, {
                                unitPrice: String(
                                  Math.round((Number(p.costPerBaseUnit) || 0) * d.qtyBase),
                                ),
                              })
                            }
                          >
                            {new Date(p.createdAt).toLocaleDateString("vi-VN")}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

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
