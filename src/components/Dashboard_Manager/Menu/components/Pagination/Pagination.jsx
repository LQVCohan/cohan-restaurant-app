import React, { useState, useEffect } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiMoreHorizontal,
  FiCornerDownLeft, // Icon Enter
} from "react-icons/fi";
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
  // State cục bộ cho input "Go to" để tránh giật khi gõ
  const [jumpPage, setJumpPage] = useState(currentPage);

  // Đồng bộ state khi props thay đổi
  useEffect(() => {
    setJumpPage(currentPage);
  }, [currentPage]);

  const getVisiblePages = () => {
    const delta = 1; // Giảm delta xuống 1 để gọn hơn
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
      if (totalPages > 1) {
        rangeWithDots.push(totalPages);
      }
    }

    return rangeWithDots;
  };

  const handlePageClick = (page) => {
    if (page !== "..." && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  // Xử lý Jump Input
  const handleJumpSubmit = (e) => {
    // Submit khi nhấn Enter hoặc Blur
    if (e.key === "Enter" || e.type === "blur") {
      let page = parseInt(jumpPage);
      if (isNaN(page)) page = currentPage;

      // Validate range
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;

      setJumpPage(page); // Update UI lại số chuẩn
      if (page !== currentPage) {
        onPageChange(page);
      }
    }
  };

  const getItemRange = () => {
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);
    return { start, end };
  };

  // Không render nếu không có trang nào (hoặc tùy logic dự án)
  if (totalPages <= 0) return null;

  const { start, end } = getItemRange();
  const visiblePages = getVisiblePages();

  return (
    <div className="pgn-container">
      {/* LEFT: Info & Page Size */}
      <div className="pgn-left">
        {showItemsPerPage && (
          <div className="pgn-select-wrapper">
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={5}>5 / trang</option>
              <option value={10}>10 / trang</option>
              <option value={20}>20 / trang</option>
              <option value={50}>50 / trang</option>
            </select>
          </div>
        )}

        {showInfo && totalItems > 0 && (
          <span className="pgn-info-text">
            {start}-{end} của <strong>{totalItems}</strong>
          </span>
        )}
      </div>

      {/* MIDDLE: Pagination Buttons */}
      <div className="pgn-nav">
        <button
          className="pgn-btn-arrow"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          title="Trang trước"
        >
          <FiChevronLeft size={16} />
        </button>

        {visiblePages.map((page, index) => {
          if (page === "...") {
            return (
              <button key={`dots-${index}`} className="pgn-dots" disabled>
                <FiMoreHorizontal />
              </button>
            );
          }
          return (
            <button
              key={page}
              className={page === currentPage ? "is-active" : ""}
              onClick={() => handlePageClick(page)}
            >
              {page}
            </button>
          );
        })}

        <button
          className="pgn-btn-arrow"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          title="Trang sau"
        >
          <FiChevronRight size={16} />
        </button>
      </div>

      {/* RIGHT: Quick Jump */}
      {totalPages > 5 && (
        <div className="pgn-right">
          <div className="pgn-jump-box" title="Nhập số trang và nhấn Enter">
            <span>Đến:</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={handleJumpSubmit}
              onBlur={handleJumpSubmit}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Pagination;
