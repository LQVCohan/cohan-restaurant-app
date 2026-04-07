import React, { useState, useEffect, useMemo, useCallback } from "react";
import s from "./MenuItemModal.module.scss";
import { formatPrice } from "../../utils/format";
import { flyToOrder } from "../../../../../utils/flyToOrder";
import { useAvatarUploadLocal } from "../../../../../hooks/useAvatarUploadLocal";
import useModalKeyboardClose from "./useModalKeyboardClose";

// ... (Giữ nguyên phần Import Icons như cũ) ...
const IconCamera = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);
const IconX = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
const IconMinus = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const IconPlus = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const IconImageEmpty = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: 0.4 }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

export default function MenuItemModal({
  isOpen,
  item,
  onAdd,
  onClose,
  isReviewMode = false,
}) {
  // --- STATE ---
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const [selectedVariantKey, setSelectedVariantKey] = useState(null);
  const [note, setNote] = useState("");

  // Upload Logic
  const [proofFiles, setProofFiles] = useState([]);
  const [proofPreviews, setProofPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [zoomedImage, setZoomedImage] = useState(null);

  const { upload } = useAvatarUploadLocal();

  // --- DERIVED VALUES ---
  const variants = useMemo(() => {
    if (Array.isArray(item?.servingVariants)) return item.servingVariants;
    return [];
  }, [item]);
  const activeVariant = useMemo(() => {
    return (
      variants.find((v) => v.key === selectedVariantKey) || variants[0] || null
    );
  }, [variants, selectedVariantKey]);

  const currentUnit = useMemo(() => {
    if (!activeVariant) return "portion";
    return activeVariant.mode === "BY_WEIGHT"
      ? activeVariant.sellUnit || "kg"
      : activeVariant.sellUnit || "portion";
  }, [activeVariant]);

  // 🔥 LOGIC GIÁ: Trả về null nếu variant.price là null
  const currentPrice = useMemo(() => {
    if (isReviewMode) return Number(item?.price ?? 0);

    if (activeVariant) {
      // ✅ null nghĩa là "chưa có giá"
      if (activeVariant.price === null) return null;
      return Number(activeVariant.price ?? 0);
    }

    if (item?._displayPrice !== undefined && item?._displayPrice !== null) {
      return Number(item._displayPrice);
    }

    return Number(item?.basePrice ?? 0);
  }, [isReviewMode, item, activeVariant]);

  // --- LOGIC HELPERS ---
  const toNumber = (v) => {
    if (typeof v !== "string") return Number(v) || 0;
    const norm = v.replace(",", ".").replace(/^\.([0-9])/, "0.$1");
    const n = Number(norm);
    return Number.isFinite(n) ? n : NaN;
  };

  const clampForUnit = useCallback(
    (n) => {
      const isWeight = currentUnit === "kg";
      if (!Number.isFinite(n)) return isWeight ? 0.5 : 1;
      if (isWeight) return Math.max(0.1, Math.round(n * 100) / 100);
      return Math.max(1, Math.floor(n));
    },
    [currentUnit]
  );

  const setQtyFromInput = useCallback(
    (text) => {
      setQtyInput(text);
      if (["", ".", ",", "-"].includes(text)) return;
      const n = toNumber(text);
      if (!Number.isNaN(n)) setQty(clampForUnit(n));
    },
    [clampForUnit]
  );

  const bump = (delta) => {
    if (isReviewMode) return;
    const isWeight = currentUnit === "kg";
    const base = Number.isFinite(qty) ? qty : isWeight ? 0.5 : 1;
    const next = clampForUnit(base + delta);
    setQty(next);
    setQtyInput(String(next));
  };

  const onBlurQty = () => {
    const isWeight = currentUnit === "kg";
    if (["", ".", ","].includes(qtyInput)) {
      const fallback = isWeight ? 0.5 : 1;
      setQty(fallback);
      setQtyInput(String(fallback));
      return;
    }
    const n = toNumber(qtyInput);
    const fixed = clampForUnit(Number.isNaN(n) ? (isWeight ? 0.5 : 1) : n);
    setQty(fixed);
    setQtyInput(String(fixed));
  };

  const handleFilesChange = (e) => {
    if (isReviewMode) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const validFiles = [];
    const newPreviews = [];
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} quá lớn (Max 5MB)`);
        return;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    });
    setProofFiles((prev) => [...prev, ...validFiles]);
    setProofPreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const removeProofImage = (index) => {
    if (isReviewMode) return;
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
    setProofPreviews((prev) => {
      const newPreviews = prev.filter((_, i) => i !== index);
      if (prev[index] && prev[index].startsWith("blob:")) {
        URL.revokeObjectURL(prev[index]);
      }
      return newPreviews;
    });
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (isOpen && item) {
      const variantList = Array.isArray(item.servingVariants)
        ? item.servingVariants
        : [];
      const defaultVariant =
        variantList.find((v) => v?.isDefault) ||
        (variantList.length === 1 ? variantList[0] : null) ||
        variantList[0] ||
        null;

      if (isReviewMode) {
        setQty(item.quantity || 1);
        setQtyInput(String(item.quantity || 1));
        setNote(item.note || "");
        setSelectedVariantKey(item.variantKey || defaultVariant?.key || null);
      } else {
        setQty(1);
        setQtyInput("1");
        setNote("");
        setSelectedVariantKey(defaultVariant?.key || null);
      }

      setProofPreviews(
        item.proofImages && Array.isArray(item.proofImages)
          ? item.proofImages
          : []
      );
      setProofFiles([]);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText("");
      setZoomedImage(null);
    }
  }, [isOpen, item, isReviewMode]);

  // --- RENDER HELPERS ---

  // 🔥 Xử lý hiển thị Tổng tiền ở Footer
  const formattedTotal =
    currentPrice === null ? "Chưa có giá" : formatPrice(currentPrice * qty);

  const formattedUnitPrice =
    currentPrice === null ? "Chưa có giá" : formatPrice(currentPrice);

  const handleAdd = async () => {
    if (isReviewMode) {
      onClose();
      return;
    }
    // Chặn thêm nếu chưa có giá (tuỳ business logic, ở đây mình chặn để an toàn)
    if (currentPrice === null) {
      alert("Sản phẩm này chưa có giá, vui lòng liên hệ nhân viên.");
      return;
    }
    if (isUploading) return;

    const n = clampForUnit(toNumber(qtyInput));
    const isWeight = currentUnit === "kg";
    const finalQty = Number.isFinite(n) ? n : isWeight ? 0.5 : 1;
    const finalProofUrls = [];

    if (proofFiles.length > 0) {
      setIsUploading(true);
      try {
        for (let i = 0; i < proofFiles.length; i++) {
          setUploadStatusText(`Đang tải ảnh ${i + 1}/${proofFiles.length}`);
          setUploadProgress(0);
          const url = await upload(proofFiles[i], (percent) =>
            setUploadProgress(percent)
          );
          finalProofUrls.push(url);
        }
      } catch (error) {
        console.error(error);
        alert("Lỗi khi tải ảnh lên server");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const menuCard = document.querySelector(`[data-menu-id="${item.id}"]`);
    const rightPanel = document.querySelector("[data-pos-order-panel]");
    if (menuCard && rightPanel) flyToOrder(menuCard, rightPanel);

    onAdd?.({
      menuItem: item,
      quantity: finalQty,
      variantName: activeVariant?.name || "",
      variantKey: activeVariant?.key || "",
      servingKey: activeVariant?.key || item?.defaultServingKey || "",
      variant: activeVariant || null,
      cookingOption: activeVariant?.name || "",
      unit: currentUnit,
      note,
      price: currentPrice,
      proofImages: finalProofUrls,
    });
  };

  useModalKeyboardClose({ isOpen, onClose, disabled: isUploading });
  if (!isOpen || !item) return null;

  return (
    <>
      <div
        className={s.backdrop}
        onClick={!isUploading ? onClose : undefined}
        role="dialog"
        aria-modal="true"
      >
        <div className={s.modal} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
          {/* HEADER IMAGE */}
          <div className={s.header}>
            {item.thumbImage ? (
              <img src={item.thumbImage} alt="" className={s.image} />
            ) : (
              <div className={s.imagePlaceholder}>{item.emoji || "🍽️"}</div>
            )}
            <button
              className={s.closeBtn}
              onClick={onClose}
              disabled={isUploading}
            >
              <IconX />
            </button>
            <div className={s.headerGradient}></div>
          </div>

          {/* BODY CONTENT */}
          <div className={s.body}>
            <div className={s.titleSection}>
              <div className={s.titleRow}>
                <h3 className={s.title}>{item.name}</h3>
                {/* Giá cơ bản hoặc giá variant đang chọn */}
                <span
                  className={`${s.basePriceTag} ${
                    currentPrice === null ? s.noPrice : ""
                  }`}
                >
                  {formattedUnitPrice}
                </span>
              </div>
              {item.description && (
                <p className={s.description}>{item.description}</p>
              )}
            </div>

            <div className={s.optionsGrid}>
              {/* === 1. SERVING VARIANTS (Cách chế biến/Quy cách) === */}
              {variants.length > 0 && (
                <div className={`${s.section} ${s.fullWidth}`}>
                  <label className={s.sectionTitle}>Quy cách / Chế biến</label>
                  <div className={s.chipGrid}>
                    {variants.map((v, idx) => {
                      const isSelected = selectedVariantKey === v.key;
                      const isPriceNull = v.price === null;

                      return (
                        <button
                          key={`${item?.id || "x"}-${v.key}-${idx}`}
                          onClick={() =>
                            !isReviewMode && setSelectedVariantKey(v.key)
                          }
                          disabled={isReviewMode}
                          className={`${s.chip} ${
                            isSelected ? s.activeChip : ""
                          } ${isReviewMode ? s.readOnly : ""}`}
                        >
                          <span className={s.chipName}>{v.name}</span>

                          {/* 🔥 HIỂN THỊ GIÁ TRÊN CHIP */}
                          <span
                            className={`${s.chipPrice} ${
                              isPriceNull ? s.missingPrice : ""
                            }`}
                          >
                            {isPriceNull ? "Chưa có giá" : formatPrice(v.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* === 2. QUANTITY CONTROL === */}
              <div className={s.section}>
                <label className={s.sectionTitle}>
                  Số lượng ({currentUnit === "kg" ? "Kg" : "Phần"})
                </label>
                <div
                  className={`${s.qtyWrapper} ${
                    isReviewMode ? s.readOnlyBox : ""
                  }`}
                >
                  <button
                    className={s.qtyControl}
                    onClick={() => bump(currentUnit === "kg" ? -0.1 : -1)}
                    disabled={isUploading || isReviewMode}
                  >
                    <IconMinus />
                  </button>
                  <input
                    className={s.qtyInput}
                    type="text"
                    inputMode="decimal"
                    value={qtyInput}
                    readOnly={isReviewMode}
                    onChange={(e) => {
                      if (/^[0-9.,]*$/.test(e.target.value))
                        setQtyFromInput(e.target.value);
                    }}
                    onBlur={onBlurQty}
                  />
                  <button
                    className={s.qtyControl}
                    onClick={() => bump(currentUnit === "kg" ? +0.1 : +1)}
                    disabled={isUploading || isReviewMode}
                  >
                    <IconPlus />
                  </button>
                </div>
              </div>

              {/* === 3. NOTES === */}
              <div className={`${s.section} ${s.fullWidth}`}>
                <label className={s.sectionTitle}>Ghi chú cho bếp</label>
                <textarea
                  className={s.noteInput}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isUploading || isReviewMode}
                  placeholder="Ví dụ: Không hành, ít cay..."
                />
              </div>

              {/* === 4. PROOF IMAGES === */}
              {/* (Giữ nguyên phần upload ảnh) */}
              <div className={`${s.section} ${s.fullWidth}`}>
                <div className={s.sectionHeader}>
                  <label className={s.sectionTitle}>Ảnh xác nhận</label>
                  {!isReviewMode && (
                    <span className={s.optional}>(Tuỳ chọn)</span>
                  )}
                </div>
                <div className={s.imagesScroll}>
                  {!isReviewMode && (
                    <label
                      className={`${s.uploadTile} ${
                        isUploading ? s.disabled : ""
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={handleFilesChange}
                        disabled={isUploading}
                      />
                      <IconCamera />
                      <span>Thêm</span>
                    </label>
                  )}
                  {proofPreviews.map((src, idx) => (
                    <div
                      key={idx}
                      className={s.previewItem}
                      onClick={() => setZoomedImage(src)}
                    >
                      <img src={src} alt="proof" className={s.previewImg} />
                      {!isUploading && !isReviewMode && (
                        <button
                          className={s.removeBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProofImage(idx);
                          }}
                        >
                          <IconX />
                        </button>
                      )}
                    </div>
                  ))}
                  {isReviewMode && proofPreviews.length === 0 && (
                    <div className={s.emptyState}>
                      <IconImageEmpty />
                      <span>Không có ảnh</span>
                    </div>
                  )}
                </div>
                {isUploading && (
                  <div className={s.uploadStatusBox}>
                    <div className={s.spinner}></div>
                    <div className={s.uploadInfo}>
                      <span className={s.uploadText}>
                        {uploadStatusText} ({uploadProgress}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className={s.footer}>
            <div className={s.totalInfo}>
              <span className={s.totalLabel}>Tạm tính</span>
              <span
                className={`${s.totalValue} ${
                  currentPrice === null ? s.noPrice : ""
                }`}
              >
                {formattedTotal}
              </span>
            </div>
            <button
              className={`${s.confirmBtn} ${isUploading ? s.loadingBtn : ""} ${
                isReviewMode ? s.closeMode : ""
              }`}
              onClick={handleAdd}
              disabled={isUploading || currentPrice === null} // Disable nếu không có giá
            >
              {isUploading
                ? "Đang tải..."
                : isReviewMode
                ? "Đóng"
                : "Thêm vào đơn"}
            </button>
          </div>
        </div>
      </div>

      {/* LIGHTBOX */}
      {zoomedImage && (
        <div className={s.lightbox} onClick={() => setZoomedImage(null)}>
          <div className={s.lightboxContent}>
            <img src={zoomedImage} alt="Full view" />
            <button className={s.lightboxClose}>
              <IconX />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
