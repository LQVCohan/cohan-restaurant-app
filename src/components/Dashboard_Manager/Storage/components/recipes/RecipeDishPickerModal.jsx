import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChefHat, CheckCircle2, CirclePlus, Search, Utensils, X } from "lucide-react";
import styles from "./RecipeDishPickerModal.module.scss";

const stop = (e) => e.stopPropagation();

const STATUS_LABEL = {
  ACTIVE: "Đang bán",
  AVAILABLE: "Đang bán",
  INACTIVE: "Tạm ngưng",
  UNAVAILABLE: "Tạm ngưng",
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const getDishPrice = (row) =>
  Number(row?.basePrice ?? row?.price ?? row?.menuPrice ?? row?._rawMenuItem?.price ?? 0);

const hasRecipeData = (row) =>
  Boolean(
    row?.recipeId ||
      row?.hasRecipe ||
      row?._meta?.hasRecipe ||
      (Array.isArray(row?.servingVariants) && row.servingVariants.length),
  );

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
    if (!isOpenPicker) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpenPicker]);

  useEffect(() => {
    if (!isOpenPicker) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onRequestClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpenPicker, onRequestClose]);

  const rows = useMemo(() => dishRows || [], [dishRows]);
  const totalCount = rows.length;
  const recipeCount = useMemo(() => rows.filter(hasRecipeData).length, [rows]);
  const missingCount = Math.max(0, totalCount - recipeCount);

  const filteredRows = useMemo(() => {
    const key = normalizeText(dishSearchText);
    if (!key) return rows;

    return rows.filter((row) => {
      const raw = row?._rawMenuItem || {};
      return [row?.name, raw?.name, row?.code, raw?.code, row?.sku, raw?.sku, row?.description, raw?.description]
        .map(normalizeText)
        .some((value) => value.includes(key));
    });
  }, [dishSearchText, rows]);

  if (!isOpenPicker) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onRequestClose} role="presentation">
      <section
        className={styles.modal}
        onClick={stop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-dish-picker-title"
      >
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.eyebrow}>Bước 1 · Chọn món ăn</span>
            <h2 id="recipe-dish-picker-title" className={styles.title}>
              Chọn món để thiết lập công thức
            </h2>
            <p className={styles.subTitle}>
              Sau khi chọn món, hệ thống sẽ mở modal thêm/cập nhật công thức cho đúng món đó.
            </p>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.statCard}>
              <strong>{totalCount}</strong>
              <span>Tổng món</span>
            </div>
            <div className={styles.statCard}>
              <strong>{missingCount}</strong>
              <span>Cần cài</span>
            </div>
            <button className={styles.closeBtn} type="button" onClick={onRequestClose} aria-label="Đóng modal chọn món">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.searchShell}>
            <Search size={18} />
            <input
              autoFocus
              className={styles.searchInput}
              placeholder="Tìm theo tên món, mã món hoặc mô tả..."
              value={dishSearchText}
              onChange={(e) => setDishSearchText(e.target.value)}
            />
            {dishSearchText ? (
              <button className={styles.clearSearch} type="button" onClick={() => setDishSearchText("")} aria-label="Xóa tìm kiếm">
                <X size={15} />
              </button>
            ) : null}
          </div>

          <div className={styles.resultMeta}>
            <span>Hiển thị {filteredRows.length} / {totalCount} món</span>
            <span className={styles.metaHint}>Ưu tiên chọn món chưa có công thức để tránh nhập trùng.</span>
          </div>

          <div className={styles.list}>
            {filteredRows.length > 0 ? (
              filteredRows.map((row, idx) => {
                const raw = row?._rawMenuItem || {};
                const name = row?.name || raw?.name || "Chưa có tên";
                const code = row?.code || raw?.code || row?.sku || raw?.sku || "";
                const desc = row?.description || raw?.description || "";
                const status = row?.status || raw?.status || "ACTIVE";
                const imageUrl = row?.imageUrl || raw?.imageUrl || raw?.image || "";
                const hasRecipe = hasRecipeData(row);

                return (
                  <button
                    key={row?.id || raw?.id || idx}
                    type="button"
                    className={`${styles.row} ${hasRecipe ? styles.rowHasRecipe : styles.rowNewRecipe}`}
                    onClick={() => {
                      onPickDishRow?.(row);
                      onRequestClose?.();
                    }}
                  >
                    <div className={styles.left}>
                      <div className={styles.thumb}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={name} className={styles.thumbImg} />
                        ) : (
                          <Utensils size={24} strokeWidth={1.8} />
                        )}
                      </div>

                      <div className={styles.meta}>
                        <div className={styles.nameLine}>
                          <span className={styles.name}>{name}</span>
                          {code ? <span className={styles.code}>#{code}</span> : null}
                        </div>

                        <div className={styles.badgeLine}>
                          {hasRecipe ? (
                            <span className={styles.badgeOk}><CheckCircle2 size={12} /> Đã có công thức</span>
                          ) : (
                            <span className={styles.badgeNew}><CirclePlus size={12} /> Chưa có công thức</span>
                          )}
                          <span className={styles.badgeStatus}>{STATUS_LABEL[status] || status || "Không rõ"}</span>
                        </div>

                        {desc ? <p className={styles.desc}>{desc}</p> : <p className={styles.descMuted}>Không có mô tả</p>}
                      </div>
                    </div>

                    <div className={styles.right}>
                      <span className={styles.price}>{formatMoney(getDishPrice(row))}</span>
                      <span className={styles.pickHint}>{hasRecipe ? "Cập nhật" : "Cài công thức"} →</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={styles.empty}>
                <ChefHat size={34} strokeWidth={1.5} />
                <strong>Không tìm thấy món phù hợp</strong>
                <span>Thử nhập tên món ngắn hơn hoặc kiểm tra lại bộ lọc danh sách món.</span>
              </div>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <span>Chọn món trước để tránh mở nhầm modal công thức.</span>
          <button className={styles.secondary} type="button" onClick={onRequestClose}>
            Đóng cửa sổ
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
