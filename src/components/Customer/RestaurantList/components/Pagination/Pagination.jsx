import React from "react";
import "./Pagination.scss";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    // Always show first page
    if (currentPage > 3) {
      pages.push(
        <button
          key={1}
          className="pagination__btn"
          onClick={() => onPageChange(1)}
        >
          1
        </button>
      );

      if (currentPage > 4) {
        pages.push(
          <span key="start-ellipsis" className="pagination__ellipsis">
            ...
          </span>
        );
      }
    }

    // Show pages around current page
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          className={`pagination__btn ${
            i === currentPage ? "pagination__btn--active" : ""
          }`}
          onClick={() => onPageChange(i)}
        >
          {i}
        </button>
      );
    }

    // Always show last page
    if (currentPage < totalPages - 2) {
      if (currentPage < totalPages - 3) {
        pages.push(
          <span key="end-ellipsis" className="pagination__ellipsis">
            ...
          </span>
        );
      }

      pages.push(
        <button
          key={totalPages}
          className="pagination__btn"
          onClick={() => onPageChange(totalPages)}
        >
          {totalPages}
        </button>
      );
    }

    return pages;
  };

  return (
    <div className="pagination">
      <div className="pagination__info">
        Trang {currentPage} / {totalPages}
      </div>

      <div className="pagination__controls">
        <button
          className="pagination__btn pagination__btn--nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← Trước
        </button>

        <div className="pagination__numbers">{renderPageNumbers()}</div>

        <button
          className="pagination__btn pagination__btn--nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Tiếp →
        </button>
      </div>
    </div>
  );
};

export default Pagination;
