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

  // Reset thanh tìm kiếm mỗi khi mở modal
  useEffect(() => {
    if (!isOpenPicker) return;
    setDishSearchText("");
  }, [isOpenPicker]);

  // Bắt sự kiện phím Escape để đóng modal
  useEffect(() => {
    if (!isOpenPicker) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onRequestClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpenPicker, onRequestClose]);

  // Lọc món ăn dựa trên từ khóa
  const filteredRows = useMemo(() => {
    const key = dishSearchText.trim().toLowerCase();
    if (!key) return dishRows || [];

    return (dishRows || []).filter((row) => {
      const name = String(row?.name || "").toLowerCase();
      const code = String(
        row?._rawMenuItem?.code || row?.code || "",
      ).toLowerCase();
      const desc = String(row?.description || "").toLowerCase();
      return name.includes(key) || code.includes(key) || desc.includes(key);
    });
  }, [dishSearchText, dishRows]);

  if (!isOpenPicker) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onRequestClose}>
      <div className={styles.modal} onClick={stop}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={styles.title}>
              Chọn món ăn cần cài đặt công thức
            </div>
            <div className={styles.subTitle}>
              Tìm kiếm theo tên hoặc mã món để thiết lập định lượng nguyên liệu
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <input
            autoFocus
            className={styles.searchInput}
            placeholder="Tìm theo tên, mã món, mô tả..."
            value={dishSearchText}
            onChange={(e) => setDishSearchText(e.target.value)}
          />

          <div className={styles.list}>
            {filteredRows.length > 0 ? (
              filteredRows.map((row, idx) => {
                const hasRecipe = Boolean(row?.recipeId || row?.hasRecipe);

                return (
                  <button
                    key={row?.id || idx}
                    type="button"
                    className={styles.row}
                    onClick={() => {
                      onPickDishRow?.(row);
                      onRequestClose?.();
                    }}
                  >
                    <div className={styles.left}>
                      {/* Ảnh đại diện món / Fallback */}
                      <div className={styles.thumb}>
                        {row?.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt={row.name}
                            className={styles.thumbImg}
                          />
                        ) : (
                          <span className={styles.thumbFallback}>🍽️</span>
                        )}
                      </div>

                      {/* Thông tin món */}
                      <div className={styles.meta}>
                        <div className={styles.nameLine}>
                          <span className={styles.name}>
                            {row?.name || "Chưa có tên"}
                          </span>
                          {row?.code && (
                            <span
                              style={{ fontSize: "12px", color: "#64748b" }}
                            >
                              ({row.code})
                            </span>
                          )}

                          {/* Badges */}
                          {hasRecipe ? (
                            <span className={styles.badgeOk}>
                              Đã có công thức
                            </span>
                          ) : (
                            <span className={styles.badgeNew}>
                              Chưa có công thức
                            </span>
                          )}

                          {row?.status ? (
                            <span className={styles.badgeStatus}>
                              {row.status}
                            </span>
                          ) : null}
                        </div>

                        {row?.description ? (
                          <div className={styles.desc}>{row.description}</div>
                        ) : (
                          <div className={styles.descMuted}>Không có mô tả</div>
                        )}
                      </div>
                    </div>

                    {/* Cột phải: Giá + Nút chọn */}
                    <div className={styles.right}>
                      <div className={styles.price}>
                        {typeof row?.basePrice === "number"
                          ? row.basePrice.toLocaleString("vi-VN") + "đ"
                          : "0đ"}
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
        </div>

        {/* Footer */}
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
    document.body,
  );
}
