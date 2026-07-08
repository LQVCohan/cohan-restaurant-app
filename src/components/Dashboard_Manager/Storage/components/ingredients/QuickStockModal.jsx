import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import {
  calculateStockReceipt,
  getConvertibleUnits,
} from "../../../../../utils/unitConversion";
import { formatPrice } from "../../../../../utils/formatters";
import {
  convertCurrencyAmount,
  normalizeCurrency,
} from "../../../../../utils/currency";
import "./QuickStockModal.scss";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseLocalDateOnly = (value) => {
  if (!DATE_ONLY_RE.test(value || "")) return null;
  const [y, m, d] = value.split("-").map((v) => Number(v));
  const parsed = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  return parsed;
};

const toLocalDateInputValue = (value) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

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
  currency = "VND",
  usdToVndRate = 26000,
}) => {
  const activeCurrency = normalizeCurrency(currency, "VND");
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
  const [prevCurrency, setPrevCurrency] = useState(activeCurrency);
  const todayDate = useMemo(() => toLocalDateInputValue(new Date()), []);

  const ingredientMap = useMemo(() => {
    const map = new Map();
    (ingredients || []).forEach((x) => map.set(String(x.id), x));
    return map;
  }, [ingredients]);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const defaultDate = now.toISOString().slice(0, 16);
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
      })),
    );
    setErrors({});
    setSubmitError("");
    setSubmitting(false);
    setPriceHintsByIngredient({});
    setPrevCurrency(activeCurrency);
    // activeCurrency intentionally omitted: changing currency converts the current draft below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, normalized]);

  useEffect(() => {
    if (!isOpen || prevCurrency === activeCurrency) return;
    setFormRows((rows) =>
      rows.map((row) => ({
        ...row,
        unitPrice:
          row.unitPrice === ""
            ? ""
            : String(
                convertCurrencyAmount(
                  Number(row.unitPrice) || 0,
                  prevCurrency,
                  activeCurrency,
                  usdToVndRate,
                ),
              ),
      })),
    );
    setPrevCurrency(activeCurrency);
  }, [activeCurrency, isOpen, prevCurrency, usdToVndRate]);

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
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const getIngredient = (row) => ingredientMap.get(String(row.id));

  const getAllowedUnits = (row) => {
    const ingredient = getIngredient(row);
    if (!ingredient) return [row.unit].filter(Boolean);
    return getConvertibleUnits(
      ingredient.baseUnit || row.unit,
      ingredient.conversions || [],
    );
  };

  const getDerivedPricing = (row) => {
    const ingredient = getIngredient(row);
    if (!ingredient || !(Number(row.qty) > 0) || !(Number(row.unitPrice) > 0)) {
      return null;
    }

    try {
      return calculateStockReceipt({
        qty: row.qty,
        unit: row.unit || ingredient.baseUnit,
        unitPrice: convertCurrencyAmount(
          Number(row.unitPrice),
          activeCurrency,
          "VND",
          usdToVndRate,
        ),
        baseUnit: ingredient.baseUnit,
        conversions: ingredient.conversions || [],
      });
    } catch {
      return null;
    }
  };

  const validate = () => {
    const nextErrors = {};
    formRows.forEach((row, idx) => {
      const qtyNum = Number(row.qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        nextErrors[idx] = { qty: "Số lượng phải > 0" };
        return;
      }
      const priceNum = Number(row.unitPrice);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        nextErrors[idx] = { unitPrice: "Giá nhập là bắt buộc và phải > 0" };
        return;
      }

      const ingredient = getIngredient(row);
      if (ingredient) {
        try {
          calculateStockReceipt({
            qty: qtyNum,
            unit: row.unit || ingredient.baseUnit,
            unitPrice: convertCurrencyAmount(
              priceNum,
              activeCurrency,
              "VND",
              usdToVndRate,
            ),
            baseUnit: ingredient.baseUnit,
            conversions: ingredient.conversions || [],
          });
        } catch (error) {
          nextErrors[idx] = { unit: error?.message || "Đơn vị nhập không hợp lệ." };
          return;
        }
      }

      if (row.expiry) {
        const expiryDate = parseLocalDateOnly(row.expiry);
        if (!expiryDate) {
          nextErrors[idx] = { expiry: "Hạn dùng không hợp lệ. Vui lòng chọn đúng ngày." };
          return;
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (expiryDate.getTime() < todayStart.getTime()) {
          nextErrors[idx] = { expiry: "Hạn dùng không được ở trong quá khứ." };
        }
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitError("");
    const payload = formRows.map((row) => ({
      id: row.id,
      type: row.type,
      qty: Number(row.qty),
      unit: row.unit,
      unitPrice: convertCurrencyAmount(
        Number(row.unitPrice),
        activeCurrency,
        "VND",
        usdToVndRate,
      ),
      supplier: row.supplier?.trim() || null,
      note: row.note?.trim() || null,
      datetime: row.datetime ? new Date(row.datetime).toISOString() : null,
      lot: row.lot?.trim() || null,
      expiry: row.expiry ? parseLocalDateOnly(row.expiry)?.toISOString() || null : null,
    }));
    try {
      setSubmitting(true);
      await onSubmit?.(payload);
    } catch (e) {
      const message = e?.message || "";
      if (message.includes("DateTime cannot represent")) {
        setSubmitError("Hạn dùng không hợp lệ. Vui lòng chọn lại ngày hết hạn.");
      } else {
        setSubmitError(message || "Không thể nhập kho. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const applySuggestedBasePrice = (idx, basePrice, qtyBase) => {
    const totalVnd = Number(basePrice || 0) * Number(qtyBase || 0);
    updateRow(idx, {
      unitPrice: String(
        Math.round(
          convertCurrencyAmount(
            totalVnd,
            "VND",
            activeCurrency,
            usdToVndRate,
          ),
        ),
      ),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nhập kho nhanh"
      size="lg"
      className="storage-modal-shell storage-modal-quick-stock"
    >
      <div className="qsm-wrapper">
        {submitError ? (
          <div className="qsm-error" role="alert">
            {submitError}
          </div>
        ) : null}
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
                    step="any"
                    inputMode="decimal"
                    name={`stock-quantity-${idx}`}
                    autoComplete="off"
                    value={row.qty}
                    onChange={(e) => updateRow(idx, { qty: e.target.value })}
                    className={errors[idx]?.qty ? "error" : ""}
                    placeholder="0"
                  />
                  {errors[idx]?.qty && (
                    <small className="qsm-error">{errors[idx].qty}</small>
                  )}
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Đơn vị nhập</span>
                  <select
                    name={`stock-unit-${idx}`}
                    autoComplete="off"
                    value={row.unit}
                    onChange={(e) => updateRow(idx, { unit: e.target.value })}
                    className={errors[idx]?.unit ? "error" : ""}
                  >
                    {getAllowedUnits(row).map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  {errors[idx]?.unit && (
                    <small className="qsm-error">{errors[idx].unit}</small>
                  )}
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">
                    Giá lô nhập ({activeCurrency}) <span className="req">*</span>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    name={`stock-price-${idx}`}
                    autoComplete="off"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(idx, { unitPrice: e.target.value })}
                    className={errors[idx]?.unitPrice ? "error" : ""}
                    placeholder="0"
                  />
                  {errors[idx]?.unitPrice && (
                    <small className="qsm-error">{errors[idx].unitPrice}</small>
                  )}
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Nhà cung cấp / Nguồn</span>
                  <input
                    type="text"
                    name={`stock-supplier-${idx}`}
                    autoComplete="organization"
                    value={row.supplier}
                    onChange={(e) => updateRow(idx, { supplier: e.target.value })}
                    placeholder="Tên NCC hoặc nguồn…"
                  />
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Ngày giờ nhập</span>
                  <input
                    type="datetime-local"
                    name={`stock-datetime-${idx}`}
                    autoComplete="off"
                    value={row.datetime}
                    onChange={(e) => updateRow(idx, { datetime: e.target.value })}
                  />
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Mã lô</span>
                  <input
                    type="text"
                    name={`stock-lot-${idx}`}
                    autoComplete="off"
                    spellCheck={false}
                    value={row.lot}
                    onChange={(e) => updateRow(idx, { lot: e.target.value })}
                    placeholder="LOT-2026-001"
                  />
                </label>

                <label className="qsm-field">
                  <span className="qsm-label">Hạn dùng</span>
                  <input
                    type="date"
                    name={`stock-expiry-${idx}`}
                    autoComplete="off"
                    value={row.expiry}
                    min={todayDate}
                    onChange={(e) => updateRow(idx, { expiry: e.target.value })}
                    className={errors[idx]?.expiry ? "error" : ""}
                  />
                  {errors[idx]?.expiry && (
                    <small className="qsm-error">{errors[idx].expiry}</small>
                  )}
                </label>
              </div>

              {(() => {
                const hint = priceHintsByIngredient[String(row.id)];
                const derived = getDerivedPricing(row);
                return (
                  <div className="qsm-derived">
                    {derived && (
                      <div className="qsm-meta">
                        Quy đổi: {Number(derived.qtyBase).toLocaleString("vi-VN")} {" "}
                        {derived.baseUnit} • Giá/base: {" "}
                        <b>
                          {formatPrice(
                            convertCurrencyAmount(
                              derived.costPerBaseUnit,
                              "VND",
                              activeCurrency,
                              usdToVndRate,
                            ),
                            { currency: activeCurrency },
                          )}
                        </b>{" "}
                        • Tổng lô: {" "}
                        <b>
                          {formatPrice(Number(row.unitPrice) || 0, {
                            currency: activeCurrency,
                          })}
                        </b>
                      </div>
                    )}
                    {hint && derived && (
                      <div className="qsm-hints">
                        {hint.latestCostPerBaseUnit > 0 && (
                          <button
                            type="button"
                            className="qsm-btn qsm-btn--secondary"
                            onClick={() =>
                              applySuggestedBasePrice(
                                idx,
                                hint.latestCostPerBaseUnit,
                                derived.qtyBase,
                              )
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
                              applySuggestedBasePrice(
                                idx,
                                hint.avgRecentCostPerBaseUnit,
                                derived.qtyBase,
                              )
                            }
                          >
                            TB gần đây
                          </button>
                        )}
                        {(hint.recent || []).slice(0, 3).map((point, pointIndex) => (
                          <button
                            key={`${point.movementId}_${pointIndex}`}
                            type="button"
                            className="qsm-btn qsm-btn--secondary"
                            onClick={() =>
                              applySuggestedBasePrice(
                                idx,
                                point.costPerBaseUnit,
                                derived.qtyBase,
                              )
                            }
                          >
                            {new Intl.DateTimeFormat("vi-VN").format(
                              new Date(point.createdAt),
                            )}
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
                  name={`stock-note-${idx}`}
                  autoComplete="off"
                  value={row.note}
                  onChange={(e) => updateRow(idx, { note: e.target.value })}
                  placeholder="Thông tin bổ sung…"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <Modal.Footer>
        <button type="button" className="qsm-btn qsm-btn--secondary" onClick={onClose}>
          Huỷ
        </button>
        <button
          type="button"
          className="qsm-btn qsm-btn--primary"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Đang nhập…" : "Xác nhận nhập kho"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default QuickStockModal;
