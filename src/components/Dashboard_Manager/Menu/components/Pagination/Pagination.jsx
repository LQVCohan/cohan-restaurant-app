import React from "react";
import "./Pagination.scss";

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  showInfo = true,
}) => {
  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, "...");
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push("...", totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const handlePageClick = (page) => {
    if (
      page !== "..." &&
      page !== currentPage &&
      page >= 1 &&
      page <= totalPages
    ) {
      onPageChange(page);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getItemRange = () => {
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);
    return { start, end };
  };

  if (totalPages <= 1) {
    return null;
  }

  const { start, end } = getItemRange();
  const visiblePages = getVisiblePages();

  return (
    <div className="pagination">
      {/* Items per page selector */}
      {showItemsPerPage && (
        <div className="pagination__per-page">
          <label className="per-page-label">
            Hiển thị:
            <select
              className="per-page-select"
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            món/trang
          </label>
        </div>
      )}

      {/* Page info */}
      {showInfo && (
        <div className="pagination__info">
          <span className="page-info">
            Hiển thị {start}-{end} trong tổng số {totalItems} món
          </span>
        </div>
      )}

      {/* Page navigation */}
      <div className="pagination__nav">
        {/* Previous button */}
        <button
          className={`page-btn page-btn--prev ${
            currentPage === 1 ? "page-btn--disabled" : ""
          }`}
          onClick={handlePrevious}
          disabled={currentPage === 1}
        >
          ← Trước
        </button>

        {/* Page numbers */}
        <div className="page-numbers">
          {visiblePages.map((page, index) => (
            <button
              key={index}
              className={`page-btn ${
                page === currentPage ? "page-btn--active" : ""
              } ${page === "..." ? "page-btn--dots" : ""}`}
              onClick={() => handlePageClick(page)}
              disabled={page === "..."}
            >
              {page}
            </button>
          ))}
        </div>

        {/* Next button */}
        <button
          className={`page-btn page-btn--next ${
            currentPage === totalPages ? "page-btn--disabled" : ""
          }`}
          onClick={handleNext}
          disabled={currentPage === totalPages}
        >
          Sau →
        </button>
      </div>

      {/* Quick jump */}
      <div className="pagination__jump">
        <span className="jump-label">Đến trang:</span>
        <input
          type="number"
          className="jump-input"
          min="1"
          max={totalPages}
          value={currentPage}
          onChange={(e) => {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= totalPages) {
              onPageChange(page);
            }
          }}
        />
        <span className="jump-total">/ {totalPages}</span>
      </div>
    </div>
  );
};

export default Pagination;
