import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarClock, ChevronDown, PackagePlus, Zap } from "lucide-react";
import Modal from "../../../../common/Modal";
import {
  calculateStockReceipt,
  getConvertibleUnits,
  toBaseQty,
} from "../../../../../utils/unitConversion";
import { formatPrice } from "../../../../../utils/formatters";
import {
  convertCurrencyAmount,
  normalizeCurrency,
} from "../../../../../utils/currency";
import {
  formatVietnamDateTimeLocal,
  toVietnamDateTimeISO,
} from "../../../../../utils/vietnamDateTime";
import "./QuickStockModal.scss";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

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

const formatVietnamDateTimeDisplay = (value) => {
  if (!DATETIME_LOCAL_RE.test(value || "")) return "Chưa chọn thời gian";
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}, ${timePart}`;
};

const isRowSelectedForStock = (row) =>
  String(row?.qty ?? "").trim() !== "" ||
  String(row?.unitPrice ?? "").trim() !== "";

/**
 * QuickStockModal
 * - Dùng chung cho nguyên liệu và vật tư
 * - Hỗ trợ nhiều dòng nhập khi mở từ cảnh báo kho
 * - Payload giữ nguyên để các caller hiện tại không phải đổi
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
  const generatedId = useId().replace(/:/g, "");
  const formId = `quick-stock-${generatedId}`;
  const receiptDatetimeHelpId = `${formId}-datetime-help`;
  const fieldRefs = useRef(new Map());
  const receiptDatetimeRef = useRef(null);

  const normalized = useMemo(
    () =>
      (entries || []).map((entry) => ({
        id: String(entry.id || ""),
        type: entry.type === "supply" ? "supply" : "ingredient",
        name: entry.name || "",
        unit: entry.unit || "",
      })),
    [entries],
  );

  const [formRows, setFormRows] = useState([]);
  const [receiptSupplier, setReceiptSupplier] = useState("");
  const [receiptDatetime, setReceiptDatetime] = useState("");
  const [receiptErrors, setReceiptErrors] = useState({});
  const [errors, setErrors] = useState({});
  const [priceHintsByIngredient, setPriceHintsByIngredient] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prevCurrency, setPrevCurrency] = useState(activeCurrency);
  const todayDate = useMemo(
    () => formatVietnamDateTimeLocal(new Date()).slice(0, 10),
    [],
  );

  const ingredientMap = useMemo(() => {
    const map = new Map();
    (ingredients || []).forEach((ingredient) =>
      map.set(String(ingredient.id), ingredient),
    );
    return map;
  }, [ingredients]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const defaultDate = formatVietnamDateTimeLocal(new Date());
    fieldRefs.current.clear();
    setReceiptSupplier("");
    setReceiptDatetime(defaultDate);
    setReceiptErrors({});
    setFormRows(
      normalized.map((entry) => ({
        ...entry,
        qty: "",
        unitPrice: "",
        lot: "",
        expiry: "",
        supplier: "",
        note: "",
        datetime: "",
      })),
    );
    setErrors({});
    setSubmitError("");
    setSubmitting(false);
    setPriceHintsByIngredient({});
    setPrevCurrency(activeCurrency);

    // Modal dùng focus trap riêng; focus trễ hơn một nhịp để ô số lượng thắng focus container.
    const focusTimer = window.setTimeout(() => {
      const firstQuantity = fieldRefs.current.get("0:qty");
      firstQuantity?.focus();
      firstQuantity?.select?.();
    }, 80);

    return () => window.clearTimeout(focusTimer);
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
    if (!isOpen || !onGetPriceSuggestions) return undefined;
    let cancelled = false;

    const run = async () => {
      const pairs = await Promise.all(
        normalized.map(async (entry) => {
          try {
            const data = await onGetPriceSuggestions(entry.id, 5);
            return [String(entry.id), data];
          } catch {
            return [String(entry.id), null];
          }
        }),
      );
      if (!cancelled) setPriceHintsByIngredient(Object.fromEntries(pairs));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, onGetPriceSuggestions, normalized]);

  if (!isOpen) return null;

  const selectedRowCount = formRows.filter(isRowSelectedForStock).length;

  const setFieldRef = (idx, field, node) => {
    const key = `${idx}:${field}`;
    if (node) fieldRefs.current.set(key, node);
    else fieldRefs.current.delete(key);
  };

  const focusField = (idx, field) => {
    const target = fieldRefs.current.get(`${idx}:${field}`);
    target?.focus();
    target?.select?.();
  };

  const updateRow = (idx, patch) => {
    setFormRows((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === idx ? { ...row, ...patch } : row,
      ),
    );
    setErrors((current) => {
      if (!current[idx]) return current;
      const nextRowErrors = { ...current[idx] };
      Object.keys(patch).forEach((key) => delete nextRowErrors[key]);
      const next = { ...current };
      if (Object.keys(nextRowErrors).length) next[idx] = nextRowErrors;
      else delete next[idx];
      return next;
    });
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
    if (!ingredient || !(Number(row.qty) > 0)) return null;

    const qtyBase = toBaseQty(
      row.qty,
      row.unit || ingredient.baseUnit,
      ingredient.baseUnit,
      ingredient.conversions || [],
    );
    if (!Number.isFinite(qtyBase) || qtyBase <= 0) return null;

    const totalValue =
      Number(row.unitPrice) > 0
        ? convertCurrencyAmount(
            Number(row.unitPrice),
            activeCurrency,
            "VND",
            usdToVndRate,
          )
        : 0;

    return {
      qtyBase,
      costPerBaseUnit: totalValue > 0 ? totalValue / qtyBase : 0,
      totalValue,
      baseUnit: ingredient.baseUnit,
    };
  };

  const getSuggestedPrices = (row, hint, derived) => {
    if (!derived) return [];
    const ingredient = getIngredient(row);
    const latestHistorical = Number(hint?.latestCostPerBaseUnit || 0);
    const savedPrice = Number(ingredient?.costPerBaseUnit || 0);
    const candidates = [
      {
        label: latestHistorical > 0 ? "Giá gần nhất" : "Giá đang lưu",
        basePrice: latestHistorical || savedPrice,
      },
      {
        label: "Giá trung bình",
        basePrice: Number(hint?.avgRecentCostPerBaseUnit || 0),
      },
    ];
    const seen = new Set();

    return candidates
      .filter(({ basePrice }) => Number.isFinite(basePrice) && basePrice > 0)
      .filter(({ basePrice }) => {
        const key = Number(basePrice).toFixed(6);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 2)
      .map((candidate) => ({
        ...candidate,
        total: Math.round(
          convertCurrencyAmount(
            candidate.basePrice * derived.qtyBase,
            "VND",
            activeCurrency,
            usdToVndRate,
          ),
        ),
      }));
  };

  const validate = () => {
    const nextErrors = {};
    const nextReceiptErrors = {};
    const selectedRows = formRows.filter(isRowSelectedForStock);
    const usesSharedDatetime = selectedRows.some((row) => !row.datetime);

    if (!selectedRows.length) {
      setSubmitError("Nhập số lượng cho ít nhất một mặt hàng.");
      setReceiptErrors({});
      setErrors({});
      window.setTimeout(() => focusField(0, "qty"), 0);
      return false;
    }

    if (usesSharedDatetime) {
      try {
        if (!DATETIME_LOCAL_RE.test(receiptDatetime || "")) throw new Error();
        toVietnamDateTimeISO(receiptDatetime);
      } catch {
        nextReceiptErrors.datetime =
          "Thời gian nhập không hợp lệ. Vui lòng chọn lại.";
      }
    }

    formRows.forEach((row, idx) => {
      if (!isRowSelectedForStock(row)) return;
      const rowErrors = {};
      const qtyNum = Number(row.qty);
      const priceNum = Number(row.unitPrice);

      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        rowErrors.qty = "Nhập số lượng lớn hơn 0";
      } else if (!Number.isFinite(priceNum) || priceNum <= 0) {
        rowErrors.unitPrice = "Nhập giá lô lớn hơn 0";
      } else {
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
            rowErrors.unit = error?.message || "Đơn vị nhập không hợp lệ.";
          }
        }
      }

      if (row.datetime) {
        try {
          if (!DATETIME_LOCAL_RE.test(row.datetime)) throw new Error();
          toVietnamDateTimeISO(row.datetime);
        } catch {
          rowErrors.datetime = "Thời gian riêng không hợp lệ.";
        }
      }

      if (row.expiry) {
        const expiryDate = parseLocalDateOnly(row.expiry);
        if (!expiryDate) {
          rowErrors.expiry = "Hạn dùng không hợp lệ. Vui lòng chọn đúng ngày.";
        } else {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          if (expiryDate.getTime() < todayStart.getTime()) {
            rowErrors.expiry = "Hạn dùng không được ở trong quá khứ.";
          }
        }
      }

      if (Object.keys(rowErrors).length) nextErrors[idx] = rowErrors;
    });

    setReceiptErrors(nextReceiptErrors);
    setErrors(nextErrors);

    if (nextReceiptErrors.datetime) {
      window.setTimeout(() => receiptDatetimeRef.current?.focus(), 0);
    } else {
      const firstInvalidIndex = Number(Object.keys(nextErrors)[0]);
      if (Number.isInteger(firstInvalidIndex)) {
        const rowErrors = nextErrors[firstInvalidIndex];
        window.setTimeout(
          () =>
            focusField(
              firstInvalidIndex,
              rowErrors.unitPrice ? "unitPrice" : "qty",
            ),
          0,
        );
      }
    }

    return (
      Object.keys(nextReceiptErrors).length === 0 &&
      Object.keys(nextErrors).length === 0
    );
  };

  const submit = async () => {
    if (submitting) return;
    if (!formRows.length) {
      setSubmitError("Không có mặt hàng nào để nhập kho.");
      return;
    }
    if (!validate()) return;

    setSubmitError("");
    const payload = formRows.filter(isRowSelectedForStock).map((row) => ({
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
      supplier: row.supplier?.trim() || receiptSupplier.trim() || null,
      note: row.note?.trim() || null,
      datetime: toVietnamDateTimeISO(row.datetime || receiptDatetime),
      lot: row.lot?.trim() || null,
      expiry: row.expiry
        ? parseLocalDateOnly(row.expiry)?.toISOString() || null
        : null,
    }));

    try {
      setSubmitting(true);
      await onSubmit?.(payload);
    } catch (error) {
      const message = error?.message || "";
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
    window.setTimeout(() => focusField(idx, "unitPrice"), 0);
  };

  const handleRequiredKeyDown = (event, idx, field) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    event.preventDefault();
    if (field === "qty") {
      focusField(idx, "unitPrice");
      return;
    }
    if (idx < formRows.length - 1) {
      focusField(idx + 1, "qty");
      return;
    }
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onBeforeClose={() => !submitting}
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      title="Nhập kho nhanh"
      size="lg"
      className="storage-modal-shell storage-modal-quick-stock"
    >
      <Modal.Body className="qsm-wrapper">
        <form
          id={formId}
          className="qsm-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <section className="qsm-fast-start" aria-label="Hướng dẫn nhập nhanh">
            <span className="qsm-fast-start__icon" aria-hidden="true">
              <Zap size={18} />
            </span>
            <div>
              <strong>Nhập số lượng và giá lô</strong>
              <span>Chỉ nhập những mặt hàng cần bổ sung; dòng để trống sẽ được bỏ qua.</span>
            </div>
            <span className="qsm-fast-start__count">
              {formRows.length} mặt hàng
            </span>
          </section>

          <section className="qsm-receipt" aria-label="Thông tin chung của phiếu nhập">
            <label className="qsm-field">
              <span className="qsm-label">Nhà cung cấp / Nguồn chung</span>
              <input
                type="text"
                name="stock-receipt-supplier"
                autoComplete="organization"
                value={receiptSupplier}
                onChange={(event) => setReceiptSupplier(event.target.value)}
                placeholder="Nhập một lần cho toàn bộ phiếu"
              />
            </label>

            <label className="qsm-field qsm-field--datetime">
              <span className="qsm-label">
                Thời gian nhập <span className="req">*</span>
              </span>
              <input
                ref={receiptDatetimeRef}
                type="datetime-local"
                lang="vi-VN"
                name="stock-receipt-datetime"
                autoComplete="off"
                value={receiptDatetime}
                aria-describedby={receiptDatetimeHelpId}
                onChange={(event) => {
                  setReceiptDatetime(event.target.value);
                  setReceiptErrors((current) => ({ ...current, datetime: "" }));
                }}
                className={receiptErrors.datetime ? "error" : ""}
              />
              <span className="qsm-datetime-help" id={receiptDatetimeHelpId}>
                <CalendarClock size={14} aria-hidden="true" />
                Giờ Việt Nam: {" "}
                <strong>{formatVietnamDateTimeDisplay(receiptDatetime)}</strong>
              </span>
              {receiptErrors.datetime ? (
                <small className="qsm-error">{receiptErrors.datetime}</small>
              ) : null}
            </label>
          </section>

          {submitError ? (
            <div className="qsm-submit-error" role="alert">
              {submitError}
            </div>
          ) : null}

          <div className="qsm-list">
            {formRows.map((row, idx) => {
              const hint = priceHintsByIngredient[String(row.id)];
              const derived = getDerivedPricing(row);
              const suggestedPrices = getSuggestedPrices(row, hint, derived);
              const rowDatetimeHelpId = `${formId}-row-datetime-${idx}`;
              const priceInputId = `${formId}-price-${idx}`;
              const optionalHasError = Boolean(
                errors[idx]?.expiry || errors[idx]?.datetime,
              );

              return (
                <article className="qsm-item" key={`${row.id}-${idx}`}>
                  <div className="qsm-item__head">
                    <div>
                      <div className="qsm-name">{row.name || "—"}</div>
                      <div className="qsm-meta">
                        {row.type === "supply" ? "Vật tư" : "Nguyên liệu"} · Đơn vị
                        gốc <b>{row.unit || "—"}</b>
                      </div>
                    </div>
                    {formRows.length > 1 ? (
                      <span className="qsm-badge">
                        {idx + 1}/{formRows.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="qsm-grid qsm-grid--primary">
                    <label className="qsm-field">
                      <span className="qsm-label">
                        Số lượng <span className="req">*</span>
                      </span>
                      <input
                        ref={(node) => setFieldRef(idx, "qty", node)}
                        autoFocus={idx === 0}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        name={`stock-quantity-${idx}`}
                        autoComplete="off"
                        value={row.qty}
                        onChange={(event) =>
                          updateRow(idx, { qty: event.target.value })
                        }
                        onKeyDown={(event) =>
                          handleRequiredKeyDown(event, idx, "qty")
                        }
                        className={errors[idx]?.qty ? "error" : ""}
                        placeholder="0"
                      />
                      {errors[idx]?.qty ? (
                        <small className="qsm-error">{errors[idx].qty}</small>
                      ) : null}
                    </label>

                    <label className="qsm-field">
                      <span className="qsm-label">Đơn vị</span>
                      <select
                        name={`stock-unit-${idx}`}
                        autoComplete="off"
                        value={row.unit}
                        onChange={(event) =>
                          updateRow(idx, { unit: event.target.value })
                        }
                        className={errors[idx]?.unit ? "error" : ""}
                      >
                        {getAllowedUnits(row).map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                      {errors[idx]?.unit ? (
                        <small className="qsm-error">{errors[idx].unit}</small>
                      ) : null}
                    </label>

                    <div className="qsm-field qsm-field--price">
                      <label className="qsm-label" htmlFor={priceInputId}>
                        Giá lô ({activeCurrency}) <span className="req">*</span>
                      </label>
                      <input
                        id={priceInputId}
                        ref={(node) => setFieldRef(idx, "unitPrice", node)}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        name={`stock-price-${idx}`}
                        autoComplete="off"
                        value={row.unitPrice}
                        onChange={(event) =>
                          updateRow(idx, { unitPrice: event.target.value })
                        }
                        onKeyDown={(event) =>
                          handleRequiredKeyDown(event, idx, "unitPrice")
                        }
                        className={errors[idx]?.unitPrice ? "error" : ""}
                        placeholder="0"
                      />
                      {suggestedPrices.length ? (
                        <span className="qsm-price-suggestions" aria-label="Gợi ý giá lô">
                          {suggestedPrices.map((suggestion) => (
                            <button
                              key={`${suggestion.label}-${suggestion.basePrice}`}
                              type="button"
                              onClick={() =>
                                applySuggestedBasePrice(
                                  idx,
                                  suggestion.basePrice,
                                  derived.qtyBase,
                                )
                              }
                            >
                              {suggestion.label}: {" "}
                              {formatPrice(suggestion.total, {
                                currency: activeCurrency,
                              })}
                            </button>
                          ))}
                        </span>
                      ) : null}
                      {errors[idx]?.unitPrice ? (
                        <small className="qsm-error">
                          {errors[idx].unitPrice}
                        </small>
                      ) : null}
                    </div>
                  </div>

                  {derived ? (
                    <div className="qsm-derived" aria-live="polite">
                      <span>
                        Nhập vào kho
                        <strong>
                          {Number(derived.qtyBase).toLocaleString("vi-VN")} {" "}
                          {derived.baseUnit}
                        </strong>
                      </span>
                      {derived.totalValue > 0 ? (
                        <>
                          <span>
                            Giá mỗi {derived.baseUnit}
                            <strong>
                              {formatPrice(
                                convertCurrencyAmount(
                                  derived.costPerBaseUnit,
                                  "VND",
                                  activeCurrency,
                                  usdToVndRate,
                                ),
                                { currency: activeCurrency },
                              )}
                            </strong>
                          </span>
                          <span>
                            Tổng lô
                            <strong>
                              {formatPrice(Number(row.unitPrice) || 0, {
                                currency: activeCurrency,
                              })}
                            </strong>
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <details
                    className="qsm-details"
                    open={optionalHasError ? true : undefined}
                  >
                    <summary>
                      <span>Thông tin lô và ghi chú</span>
                      <small>Không bắt buộc</small>
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="qsm-details__content">
                      <div className="qsm-grid qsm-grid--details">
                        {formRows.length > 1 ? (
                          <>
                            <label className="qsm-field">
                              <span className="qsm-label">Nguồn riêng</span>
                              <input
                                type="text"
                                name={`stock-supplier-${idx}`}
                                autoComplete="organization"
                                value={row.supplier}
                                onChange={(event) =>
                                  updateRow(idx, { supplier: event.target.value })
                                }
                                placeholder="Để trống để dùng nguồn chung"
                              />
                            </label>

                            <label className="qsm-field qsm-field--datetime">
                              <span className="qsm-label">Thời gian riêng</span>
                              <input
                                type="datetime-local"
                                lang="vi-VN"
                                name={`stock-datetime-${idx}`}
                                autoComplete="off"
                                value={row.datetime}
                                aria-describedby={rowDatetimeHelpId}
                                onChange={(event) =>
                                  updateRow(idx, { datetime: event.target.value })
                                }
                                className={errors[idx]?.datetime ? "error" : ""}
                              />
                              <span
                                className="qsm-datetime-help"
                                id={rowDatetimeHelpId}
                              >
                                <CalendarClock size={14} aria-hidden="true" />
                                {row.datetime
                                  ? formatVietnamDateTimeDisplay(row.datetime)
                                  : `Dùng giờ chung: ${formatVietnamDateTimeDisplay(
                                      receiptDatetime,
                                    )}`}
                              </span>
                              {errors[idx]?.datetime ? (
                                <small className="qsm-error">
                                  {errors[idx].datetime}
                                </small>
                              ) : null}
                            </label>
                          </>
                        ) : null}

                        <label className="qsm-field">
                          <span className="qsm-label">Mã lô</span>
                          <input
                            type="text"
                            name={`stock-lot-${idx}`}
                            autoComplete="off"
                            spellCheck={false}
                            value={row.lot}
                            onChange={(event) =>
                              updateRow(idx, { lot: event.target.value })
                            }
                            placeholder="VD: LOT-2026-001"
                          />
                        </label>

                        <label className="qsm-field">
                          <span className="qsm-label">Hạn dùng</span>
                          <input
                            type="date"
                            lang="vi-VN"
                            name={`stock-expiry-${idx}`}
                            autoComplete="off"
                            value={row.expiry}
                            min={todayDate}
                            onChange={(event) =>
                              updateRow(idx, { expiry: event.target.value })
                            }
                            className={errors[idx]?.expiry ? "error" : ""}
                          />
                          {errors[idx]?.expiry ? (
                            <small className="qsm-error">
                              {errors[idx].expiry}
                            </small>
                          ) : null}
                        </label>
                      </div>

                      <label className="qsm-field qsm-field--note">
                        <span className="qsm-label">Ghi chú</span>
                        <textarea
                          name={`stock-note-${idx}`}
                          autoComplete="off"
                          value={row.note}
                          onChange={(event) =>
                            updateRow(idx, { note: event.target.value })
                          }
                          placeholder="Chất lượng, bao bì hoặc điều kiện nhận hàng…"
                        />
                      </label>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </form>
      </Modal.Body>

      <Modal.Footer className="qsm-footer">
        <span className="qsm-footer__hint">
          <kbd>Enter</kbd>
          <span>chuyển ô; Enter tại giá cuối để nhập kho</span>
        </span>
        <div className="qsm-footer__actions">
          <button
            type="button"
            className="qsm-btn qsm-btn--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Huỷ
          </button>
          <button
            type="submit"
            form={formId}
            className="qsm-btn qsm-btn--primary"
            disabled={submitting || !formRows.length}
          >
            <PackagePlus size={17} aria-hidden="true" />
            {submitting
              ? "Đang nhập…"
              : formRows.length > 1
                ? selectedRowCount > 0
                  ? `Nhập ${selectedRowCount} mặt hàng`
                  : "Chọn mặt hàng cần nhập"
                : "Nhập kho ngay"}
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default QuickStockModal;
