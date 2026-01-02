import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./RecipeDishPickerModal.module.scss";

const stop = (e) => e.stopPropagation();

export default function RecipeDishPickerModal({
  isOpenPicker,
  onRequestClose,
  dishRows = [],
  onPickDishRow,
}) {
  const [dishSearchText, setDishSearchText] = useState("");

  useEffect(() => {
    if (!isOpenPicker) return;
    setDishSearchText("");
  }, [isOpenPicker]);

  useEffect(() => {
    if (!isOpenPicker) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onRequestClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpenPicker, onRequestClose]);

  const filteredRows = useMemo(() => {
    const key = dishSearchText.trim().toLowerCase();
    if (!key) return dishRows || [];

    return (dishRows || []).filter((row) => {
      const name = String(row?.name || "").toLowerCase();
      const code = String(
        row?._rawMenuItem?.code || row?.code || ""
      ).toLowerCase();
      const desc = String(row?.description || "").toLowerCase();
      return name.includes(key) || code.includes(key) || desc.includes(key);
    });
  }, [dishRows, dishSearchText]);

  const getRowId = (row) => String(row?.id || row?.menuItemId || "");

  const detectHasRecipe = (row) => {
    // ưu tiên các id nếu tồn tại
    if (row?._rawRecipeId || row?.recipeId || row?.recipe?.id) return true;

    // fallback: có ingredients trong variants
    const variants = Array.isArray(row?.servingVariants)
      ? row.servingVariants
      : [];
    return variants.some((v) => {
      const lines = v?.ingredients || v?.components || [];
      return Array.isArray(lines) && lines.length > 0;
    });
  };

  if (!isOpenPicker) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onRequestClose}>
      <div
        className={styles.modal}
        onClick={stop}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={styles.title}>
              Chọn món để thêm/cập nhật công thức
            </div>
            <div className={styles.subTitle}>
              Tổng: <b>{dishRows?.length || 0}</b> • Hiển thị:{" "}
              <b>{filteredRows?.length || 0}</b>
            </div>
          </div>

          <button
            className={styles.closeBtn}
            type="button"
            onClick={onRequestClose}
          >
            ✕
          </button>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            value={dishSearchText}
            onChange={(e) => setDishSearchText(e.target.value)}
            placeholder="Tìm theo tên / mô tả / mã món…"
          />
        </div>

        <div className={styles.list}>
          {filteredRows?.length ? (
            filteredRows.map((row) => {
              const rowId = getRowId(row);
              const hasRecipe = detectHasRecipe(row);

              return (
                <button
                  key={rowId}
                  className={styles.row}
                  type="button"
                  onClick={() => onPickDishRow?.(row)}
                  title={row?.description || row?.name || ""}
                >
                  <div className={styles.thumb}>
                    {row?.thumbImage ? (
                      <img src={row.thumbImage} alt={row?.name || "thumb"} />
                    ) : (
                      <div className={styles.thumbFallback}>🍽️</div>
                    )}
                  </div>

                  <div className={styles.meta}>
                    <div className={styles.nameLine}>
                      <span className={styles.name}>
                        {row?.name || "Unnamed"}
                      </span>

                      {hasRecipe ? (
                        <span className={styles.badgeOk}>Đã có công thức</span>
                      ) : (
                        <span className={styles.badgeNew}>
                          Chưa có công thức
                        </span>
                      )}

                      {row?.status ? (
                        <span className={styles.badgeStatus}>{row.status}</span>
                      ) : null}
                    </div>

                    {row?.description ? (
                      <div className={styles.desc}>{row.description}</div>
                    ) : (
                      <div className={styles.descMuted}>Không có mô tả</div>
                    )}
                  </div>

                  <div className={styles.right}>
                    <div className={styles.price}>
                      {typeof row?.basePrice === "number" ? row.basePrice : 0}
                    </div>
                    <div className={styles.pickHint}>Chọn →</div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className={styles.empty}>Không tìm thấy món phù hợp.</div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.secondary}
            type="button"
            onClick={onRequestClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
