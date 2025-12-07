// src/components/Customer/Homepage_Client/HeaderSearch.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchSuggestions } from "../../../../hooks/useSearchSuggestions";
import { debounce } from "../../../../utils/debounce";

const HISTORY_KEY = "foodhub_search_history_v1";
const HISTORY_LIMIT = 6;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_LIMIT);
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

function getTypeInfo(type) {
  if (type === "RESTAURANT") {
    return { label: "Nhà hàng", icon: "🏠" };
  }
  if (type === "MENU_ITEM") {
    return { label: "Món ăn", icon: "🍽️" };
  }
  if (type === "OWNER") {
    return { label: "Chủ/QL", icon: "👤" };
  }
  if (type === "LOCATION") {
    return { label: "Khu vực", icon: "📍" };
  }
  return { label: "", icon: "" };
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

  const debouncedSearch = useMemo(
    () =>
      debounce((q) => {
        run(q);
      }, 300),
    [run]
  );

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      cancel();
      setIsFocused(false);
      setActiveIndex(-1);
    }, 3000);
  };

  const handleInputChange = (value) => {
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

    if (query.trim().length >= 2) {
      debouncedSearch(query.trim());
      setIsOpen(true);
    } else if (history.length > 0) {
      setIsOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) {
        setIsFocused(false);
        setActiveIndex(-1);
        cancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [cancel]);

  const flatItems = useMemo(() => {
    if (!suggestions) return [];
    const list = [];

    if (suggestions.restaurants) {
      suggestions.restaurants.forEach((r) =>
        list.push({ type: "RESTAURANT", data: r })
      );
    }

    if (suggestions.menuItems) {
      suggestions.menuItems
        .slice(0, 3)
        .forEach((m) => list.push({ type: "MENU_ITEM", data: m }));
    }

    if (suggestions.owners) {
      suggestions.owners.forEach((o) => list.push({ type: "OWNER", data: o }));
    }

    if (suggestions.locations) {
      suggestions.locations.forEach((l) =>
        list.push({ type: "LOCATION", data: l })
      );
    }

    return list;
  }, [suggestions]);

  const pushHistory = (text) => {
    const q = text.trim();
    if (!q) return;
    setHistory((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
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
      pushHistory(item.data.name || keyword);
      navigate(`/restaurant/${item.data.id}`);
      return;
    }

    if (item.type === "MENU_ITEM") {
      pushHistory(item.data.name || keyword);
      navigate(
        `/cus-menu?restaurantId=${item.data.restaurantId}&menuItemId=${item.data.id}`
      );
      return;
    }

    if (item.type === "OWNER") {
      pushHistory(item.data.fullName || keyword);
      navigate(`/owner/${item.data.id}`);
      return;
    }

    if (item.type === "LOCATION") {
      const label = item.data.label || keyword;
      pushHistory(label);
      navigate(`/search?q=${encodeURIComponent(label)}`);
      return;
    }

    if (keyword) {
      pushHistory(keyword);
      navigate(`/search?q=${encodeURIComponent(keyword)}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < flatItems.length) {
        handleSelect(flatItems[activeIndex]);
      } else {
        handleSelect(null);
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
    if (history.length > 0) {
      setIsOpen(true);
    }
    cancel();
  };

  const clearHistoryAll = () => {
    setHistory([]);
    saveHistory([]);
  };

  const removeHistoryItem = (text) => {
    const next = history.filter((x) => x !== text);
    setHistory(next);
    saveHistory(next);
  };

  const showHistory =
    isOpen && isFocused && query.trim().length === 0 && history.length > 0;

  const shouldShowDropdown =
    showHistory || (isOpen && (flatItems.length > 0 || loading));

  return (
    <div className="header-search" ref={wrapperRef}>
      <input
        type="text"
        className="header__search-input"
        placeholder="Tìm nhà hàng, món ăn, chủ, khu vực..."
        value={query}
        onFocus={handleFocus}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="header__search-icon">🔍</span>

      {query.length > 0 && (
        <button
          type="button"
          className="header-search__clear-input"
          onClick={clearInput}
        >
          ✕
        </button>
      )}

      {shouldShowDropdown && (
        <div className="header-search__dropdown header-search__dropdown--fade">
          {showHistory && (
            <div className="header-search__group header-search__group--history">
              <div className="header-search__group-title-row">
                <div className="header-search__group-title">
                  Tìm kiếm gần đây
                </div>
                <button
                  type="button"
                  className="header-search__clear-history"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearHistoryAll();
                  }}
                >
                  Xóa lịch sử
                </button>
              </div>

              {history.map((h) => (
                <div
                  key={h}
                  className="header-search__item header-search__item--history"
                >
                  <button
                    type="button"
                    className="header-search__item-main-btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(h, true);
                    }}
                  >
                    <span className="header-search__item-main">{h}</span>
                  </button>
                  <button
                    type="button"
                    className="header-search__remove-history-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      removeHistoryItem(h);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {isOpen && flatItems.length > 0 && (
            <div className="header-search__group">
              <div className="header-search__group-title">Gợi ý phù hợp</div>
              {flatItems.map((item, idx) => {
                const active = idx === activeIndex;
                const main =
                  item.data.name || item.data.fullName || item.data.label || "";
                const sub =
                  item.data.shortAddress ||
                  item.data.restaurantName ||
                  item.data.email ||
                  item.data.city ||
                  "";
                const typeInfo = getTypeInfo(item.type);

                return (
                  <button
                    key={`${item.type}-${idx}`}
                    type="button"
                    className={
                      "header-search__item" +
                      (active ? " header-search__item--active" : "")
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                  >
                    <div className="header-search__item-content">
                      <div className="header-search__item-main">{main}</div>
                      {sub && (
                        <div className="header-search__item-sub">{sub}</div>
                      )}
                    </div>
                    {typeInfo.label && (
                      <div className="header-search__item-type">
                        <span className="header-search__item-type-icon">
                          {typeInfo.icon}
                        </span>
                        <span>{typeInfo.label}</span>
                      </div>
                    )}
                  </button>
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
