// src/components/Customer/Homepage_Client/HeaderSearch.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchSuggestions } from "../../../../hooks/useSearchSuggestions";
import { debounce } from "../../../../utils/debounce";

const HISTORY_KEY = "foodhub_search_history_v1";
const HISTORY_LIMIT = 5;

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
  } catch {
    // ignore localStorage write errors
  }
}

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
    case "CHEF":
      return {
        label: "Bếp trưởng",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 13.8V20h12v-6.2" />
            <path d="M6.5 13.5a4 4 0 1 1 2.7-7A4.5 4.5 0 0 1 18 8a3.5 3.5 0 0 1-.5 5.5Z" />
            <path d="M9 17h6" />
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

function getSuggestionSubText(item) {
  const data = item?.data || {};

  if (item?.type === "MENU_ITEM") {
    return [
      data.restaurantName,
      data.categoryName,
      data.servingLabel,
      data.cookingMethods?.join(", "),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (item?.type === "CHEF") {
    return [data.positionTitle, data.restaurantName, data.contactPhone]
      .filter(Boolean)
      .join(" · ");
  }

  if (item?.type === "RESTAURANT") {
    return [data.fullAddress || data.shortAddress, data.phone]
      .filter(Boolean)
      .join(" · ");
  }

  if (item?.type === "OWNER") {
    return [data.email, data.phone].filter(Boolean).join(" · ");
  }

  return data.fullAddress || data.shortAddress || data.restaurantName || "";
}

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
  const debouncedSearch = useMemo(() => debounce((q) => run(q), 300), [run]);

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      cancel();
      setIsFocused(false);
      setActiveIndex(-1);
    }, 5000);
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    setQuery(value);

    if (!isFocused) return;
    resetIdleTimer();

    const trimmed = value.trim();
    if (trimmed.length < 2) {
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      cancel();
    },
    [cancel]
  );

  const flatItems = useMemo(() => {
    if (!suggestions) return [];

    const list = [];
    suggestions.restaurants?.forEach((restaurant) =>
      list.push({ type: "RESTAURANT", data: restaurant })
    );
    suggestions.menuItems
      ?.slice(0, 3)
      .forEach((menuItem) =>
        list.push({ type: "MENU_ITEM", data: menuItem })
      );
    suggestions.chefs
      ?.slice(0, 3)
      .forEach((chef) => list.push({ type: "CHEF", data: chef }));
    suggestions.owners?.forEach((owner) =>
      list.push({ type: "OWNER", data: owner })
    );
    suggestions.locations?.forEach((location) =>
      list.push({ type: "LOCATION", data: location })
    );

    return list;
  }, [suggestions]);

  const pushHistory = (text) => {
    const normalized = text?.trim();
    if (!normalized) return;

    setHistory((previous) => {
      const next = [
        normalized,
        ...previous.filter((item) => item !== normalized),
      ].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
  };

  const clearHistoryAll = () => {
    setHistory([]);
    saveHistory([]);
  };

  const removeHistoryItem = (event, text) => {
    event.stopPropagation();
    const next = history.filter((item) => item !== text);
    setHistory(next);
    saveHistory(next);
  };

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

    if (!item) {
      if (keyword) {
        pushHistory(keyword);
        navigate(`/search?q=${encodeURIComponent(keyword)}`);
      }
      return;
    }

    if (item.type === "RESTAURANT") {
      pushHistory(item.data.name);
      navigate(`/restaurant/${item.data.id}`);
    } else if (item.type === "MENU_ITEM") {
      pushHistory(item.data.name);
      navigate(
        `/cus-menu?restaurantId=${encodeURIComponent(
          item.data.restaurantId
        )}&menuItemId=${encodeURIComponent(item.data.id)}`
      );
    } else if (item.type === "CHEF") {
      pushHistory(item.data.fullName || item.data.restaurantName);
      navigate(`/restaurant/${item.data.restaurantId}`);
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

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < flatItems.length) {
        handleSelect(flatItems[activeIndex]);
      } else {
        handleSelect(null);
      }
      return;
    }

    if (!flatItems.length || !isOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((previous) =>
        previous + 1 >= flatItems.length ? 0 : previous + 1
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((previous) =>
        previous - 1 < 0 ? flatItems.length - 1 : previous - 1
      );
    }
  };

  const clearInput = () => {
    setQuery("");
    setActiveIndex(-1);
    if (history.length > 0) setIsOpen(true);
    cancel();
  };

  const showHistory =
    isOpen && isFocused && !query.trim() && history.length > 0;
  const showSuggestions = isOpen && (flatItems.length > 0 || loading);

  return (
    <div className="header-search" ref={wrapperRef}>
      <div className="header-search__input-wrapper">
        <input
          type="text"
          className="header-search__input"
          placeholder="Tìm món, nhà hàng, bếp trưởng..."
          value={query}
          onFocus={handleFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        {query.length > 0 && (
          <button
            type="button"
            className="header-search__clear-input"
            onClick={clearInput}
            aria-label="Xóa từ khóa tìm kiếm"
          >
            ✕
          </button>
        )}

        <button
          type="button"
          className="header-search__icon-btn"
          onClick={() => handleSelect(null)}
          aria-label="Tìm kiếm"
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

      {(showHistory || showSuggestions) && (
        <div className="header-search__dropdown">
          {showHistory && (
            <div className="header-search__group">
              <div className="header-search__dropdown-header">
                <span className="header-search__dropdown-title">
                  Tìm kiếm gần đây
                </span>
                <button
                  type="button"
                  className="header-search__dropdown-clear"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    clearHistoryAll();
                  }}
                >
                  Xóa tất cả
                </button>
              </div>

              {history.map((item, index) => (
                <div
                  key={`hist-${index}`}
                  className="header-search__dropdown-item"
                  onClick={() => handleSelect(item, true)}
                >
                  <div className="header-search__item-content">
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
                    <span className="header-search__item-main">{item}</span>
                  </div>
                  <button
                    type="button"
                    className="header-search__remove-history-item"
                    onMouseDown={(event) =>
                      removeHistoryItem(event, item)
                    }
                    aria-label={`Xóa ${item} khỏi lịch sử`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {showSuggestions && (
            <div className="header-search__group">
              <div className="header-search__dropdown-header">
                <span className="header-search__dropdown-title">
                  Gợi ý phù hợp
                </span>
              </div>

              {flatItems.map((item, index) => {
                const active = index === activeIndex;
                const typeInfo = getTypeInfo(item.type);
                const mainText =
                  item.data.name ||
                  item.data.fullName ||
                  item.data.label ||
                  "Kết quả tìm kiếm";
                const subText = getSuggestionSubText(item);

                return (
                  <div
                    key={`${item.type}-${item.data.id || item.data.label || index}`}
                    className={`header-search__dropdown-item ${
                      active ? "header-search__dropdown-item--active" : ""
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(index)}
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
                        <div className="header-search__item-sub">
                          {subText}
                        </div>
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
