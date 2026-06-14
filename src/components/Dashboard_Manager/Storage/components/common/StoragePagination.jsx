import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const getPageItems = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("left-ellipsis");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < totalPages - 1) items.push("right-ellipsis");
  items.push(totalPages);
  return items;
};

const StoragePagination = ({
  page = 1,
  totalItems = 0,
  pageSize = 9,
  onPageChange,
  itemLabel = "mục",
  className = "",
}) => {
  const totalPages = Math.max(1, Math.ceil(Number(totalItems || 0) / Number(pageSize || 1)));
  const safePage = Math.min(Math.max(1, Number(page || 1)), totalPages);

  if (totalPages <= 1) return null;

  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);
  const goTo = (nextPage) => {
    const normalized = Math.min(Math.max(1, nextPage), totalPages);
    if (normalized !== safePage) onPageChange?.(normalized);
  };

  return (
    <nav className={`storage-pagination ${className}`} aria-label={`Phân trang ${itemLabel}`}>
      <div className="storage-pagination__summary">
        Hiển thị <strong>{from.toLocaleString("vi-VN")}</strong>–<strong>{to.toLocaleString("vi-VN")}</strong>
        <span>/</span>
        <strong>{Number(totalItems || 0).toLocaleString("vi-VN")}</strong>
        <span>{itemLabel}</span>
      </div>

      <div className="storage-pagination__controls">
        <button
          type="button"
          className="storage-pagination__btn storage-pagination__btn--icon"
          onClick={() => goTo(1)}
          disabled={safePage === 1}
          aria-label="Trang đầu"
          title="Trang đầu"
        >
          <ChevronsLeft size={15} />
        </button>
        <button
          type="button"
          className="storage-pagination__btn storage-pagination__btn--icon"
          onClick={() => goTo(safePage - 1)}
          disabled={safePage === 1}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="storage-pagination__pages" aria-hidden="false">
          {getPageItems(safePage, totalPages).map((item) =>
            typeof item === "number" ? (
              <button
                type="button"
                key={item}
                className={`storage-pagination__btn ${item === safePage ? "is-active" : ""}`}
                onClick={() => goTo(item)}
                aria-current={item === safePage ? "page" : undefined}
              >
                {item}
              </button>
            ) : (
              <span className="storage-pagination__ellipsis" key={item}>
                …
              </span>
            )
          )}
        </div>

        <button
          type="button"
          className="storage-pagination__btn storage-pagination__btn--icon"
          onClick={() => goTo(safePage + 1)}
          disabled={safePage === totalPages}
          aria-label="Trang sau"
          title="Trang sau"
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          className="storage-pagination__btn storage-pagination__btn--icon"
          onClick={() => goTo(totalPages)}
          disabled={safePage === totalPages}
          aria-label="Trang cuối"
          title="Trang cuối"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </nav>
  );
};

export default StoragePagination;
