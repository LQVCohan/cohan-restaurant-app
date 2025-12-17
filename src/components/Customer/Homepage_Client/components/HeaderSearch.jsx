// src/components/Customer/Homepage_Client/HeaderSearch.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchSuggestions } from "../../../../hooks/useSearchSuggestions";
import { debounce } from "../../../../utils/debounce";

// --- CONSTANTS & HELPERS ---
const HISTORY_KEY = "foodhub_search_history_v1";
const HISTORY_LIMIT = 5; // Giảm xuống 5 để dropdown gọn hơn

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(list.slice(0, HISTORY_LIMIT))
    );
  } catch {}
}

// Helper để lấy icon và label đẹp hơn
function getTypeInfo(type) {
  switch (type) {
    case "RESTAURANT":
      return {
        label: "Nhà hàng",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 21h18M5 21V7l8-4 8 4v14M8 21V12a4 4 0 0 1 8 0v9" />
          </svg>
        ),
      };
    case "MENU_ITEM":
      return {
        label: "Món ăn",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
          </svg>
        ),
      };
    case "OWNER":
      return {
        label: "Chủ quán",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      };
    case "LOCATION":
      return {
        label: "Khu vực",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        ),
      };
    default:
      return { label: "", icon: null };
  }
}

// --- COMPONENT ---
export default function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());

  const idleTimer = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const { run, cancel, suggestions, loading } = useSearchSuggestions();

  // Debounce API call
  const debouncedSearch = useMemo(() => debounce((q) => run(q), 300), [run]);

  // Logic Idle Timer
  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      cancel();
      setIsFocused(false);
      setActiveIndex(-1);
    }, 5000); // Tăng lên 5s cho thoải mái
  };

  // Handlers
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (!isFocused) return;
    resetIdleTimer();

    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) {
      cancel();
      return;
    }
    debouncedSearch(trimmed);
    setIsOpen(true);
  };

  const handleFocus = () => {
    setIsFocused(true);
    resetIdleTimer();
    if (query.trim().length >= 2 || history.length > 0) {
      setIsOpen(true);
    }
  };

  // Click Outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsFocused(false);
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Flatten suggestions data
  const flatItems = useMemo(() => {
    if (!suggestions) return [];
    const list = [];
    if (suggestions.restaurants)
      suggestions.restaurants.forEach((r) =>
        list.push({ type: "RESTAURANT", data: r })
      );
    if (suggestions.menuItems)
      suggestions.menuItems
        .slice(0, 3)
        .forEach((m) => list.push({ type: "MENU_ITEM", data: m }));
    if (suggestions.owners)
      suggestions.owners.forEach((o) => list.push({ type: "OWNER", data: o }));
    if (suggestions.locations)
      suggestions.locations.forEach((l) =>
        list.push({ type: "LOCATION", data: l })
      );
    return list;
  }, [suggestions]);

  // History Actions
  const pushHistory = (text) => {
    const q = text?.trim();
    if (!q) return;
    setHistory((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
  };

  const clearHistoryAll = () => {
    setHistory([]);
    saveHistory([]);
  };

  const removeHistoryItem = (e, text) => {
    e.stopPropagation(); // Stop click event propagation
    const next = history.filter((x) => x !== text);
    setHistory(next);
    saveHistory(next);
  };

  // Navigation Logic
  const handleSelect = (item, fromHistory = false) => {
    setIsOpen(false);
    setActiveIndex(-1);
    setIsFocused(false);
    cancel();

    let keyword = query.trim();
    if (fromHistory && typeof item === "string") {
      keyword = item;
      setQuery(item);
    }

    // Nếu không có item cụ thể (User nhấn Enter khi đang gõ)
    if (!item) {
      if (keyword) {
        pushHistory(keyword);
        navigate(`/search?q=${encodeURIComponent(keyword)}`);
      }
      return;
    }

    // Xử lý navigate theo Type
    if (item.type === "RESTAURANT") {
      pushHistory(item.data.name);
      navigate(`/restaurant/${item.data.id}`);
    } else if (item.type === "MENU_ITEM") {
      pushHistory(item.data.name);
      navigate(
        `/cus-menu?restaurantId=${item.data.restaurantId}&menuItemId=${item.data.id}`
      );
    } else if (item.type === "OWNER") {
      pushHistory(item.data.fullName);
      navigate(`/owner/${item.data.id}`);
    } else if (item.type === "LOCATION") {
      const label = item.data.label || keyword;
      pushHistory(label);
      navigate(`/search?q=${encodeURIComponent(label)}`);
    } else if (keyword) {
      pushHistory(keyword);
      navigate(`/search?q=${encodeURIComponent(keyword)}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < flatItems.length) {
        handleSelect(flatItems[activeIndex]);
      } else {
        handleSelect(null); // Search keyword hiện tại
      }
      return;
    }
    if (!flatItems.length || !isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 >= flatItems.length ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev - 1 < 0 ? flatItems.length - 1 : prev - 1
      );
    }
  };

  const clearInput = () => {
    setQuery("");
    setActiveIndex(-1);
    // Nếu có lịch sử, focus lại để hiện lịch sử
    if (history.length > 0) setIsOpen(true);
    cancel();
  };

  // Conditions to show dropdown
  const showHistory =
    isOpen && isFocused && !query.trim() && history.length > 0;
  const showSuggestions = isOpen && (flatItems.length > 0 || loading);

  return (
    <div className="header-search" ref={wrapperRef}>
      {/* Wrapper input để bo tròn và chứa icon */}
      <div className="header-search__input-wrapper">
        <input
          type="text"
          className="header-search__input"
          placeholder="Tìm nhà hàng, món ăn, khu vực..."
          value={query}
          onFocus={handleFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        {/* Nút Clear Input (X) */}
        {query.length > 0 && (
          <button
            type="button"
            className="header-search__clear-input"
            onClick={clearInput}
          >
            ✕
          </button>
        )}

        {/* Nút Search Icon (🔍) */}
        <button
          className="header-search__icon-btn"
          onClick={() => handleSelect(null)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* DROPDOWN */}
      {(showHistory || showSuggestions) && (
        <div className="header-search__dropdown">
          {/* --- HISTORY SECTION --- */}
          {showHistory && (
            <div className="header-search__group">
              <div className="header-search__dropdown-header">
                <span className="header-search__dropdown-title">
                  Tìm kiếm gần đây
                </span>
                <button
                  type="button"
                  className="header-search__dropdown-clear"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearHistoryAll();
                  }}
                >
                  Xóa tất cả
                </button>
              </div>

              {history.map((h, idx) => (
                <div
                  key={`hist-${idx}`}
                  className="header-search__dropdown-item"
                  onClick={() => handleSelect(h, true)}
                >
                  <div className="header-search__item-content">
                    {/* Icon đồng hồ */}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="mr-2 text-gray-400"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="header-search__item-main">{h}</span>
                  </div>
                  <button
                    type="button"
                    className="header-search__remove-history-item"
                    onMouseDown={(e) => removeHistoryItem(e, h)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* --- SUGGESTIONS SECTION --- */}
          {showSuggestions && (
            <div className="header-search__group">
              <div className="header-search__dropdown-header">
                <span className="header-search__dropdown-title">
                  Gợi ý phù hợp
                </span>
              </div>

              {flatItems.map((item, idx) => {
                const active = idx === activeIndex;
                const typeInfo = getTypeInfo(item.type);
                const mainText =
                  item.data.name || item.data.fullName || item.data.label;
                const subText =
                  item.data.address ||
                  item.data.shortAddress ||
                  item.data.restaurantName ||
                  "";

                return (
                  <div
                    key={`${item.type}-${idx}`}
                    className={`header-search__dropdown-item ${
                      active ? "header-search__dropdown-item--active" : ""
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <div className="header-search__item-content">
                      <div className="flex items-center gap-2">
                        <span className="header-search__item-main">
                          {mainText}
                        </span>
                        {typeInfo.label && (
                          <span className="header-search__item-tag">
                            {typeInfo.icon} {typeInfo.label}
                          </span>
                        )}
                      </div>
                      {subText && (
                        <div className="header-search__item-sub">{subText}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loading && (
            <div className="header-search__loading">Đang tìm kiếm...</div>
          )}
        </div>
      )}
    </div>
  );
}
