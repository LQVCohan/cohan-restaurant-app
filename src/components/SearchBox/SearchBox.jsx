import React, { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { managerNestedSearchData, searchData } from "../../data/searchData";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import "./SearchBox.scss";

export const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

export const expandSearchSource = (items) => {
  const source = Array.isArray(items) ? items : searchData;
  if (!Array.isArray(items)) return source;

  const allowedParents = new Map(
    source.map((item) => [String(item?.id || ""), item]),
  );
  const nestedItems = managerNestedSearchData
    .filter((item) => allowedParents.has(item.page))
    .map((item) => ({
      ...item,
      icon: item.icon || allowedParents.get(item.page)?.icon,
      type: "manager-navigation",
    }));

  return [...source, ...nestedItems];
};

const scoreToken = (token, fields) => {
  if (!token) return 0;
  if (fields.title.startsWith(token)) return 100;
  if (fields.title.includes(token)) return 60;
  if (fields.keywords.some((keyword) => keyword.includes(token))) return 45;
  if (fields.description.includes(token)) return 30;
  if (fields.category.includes(token)) return 15;
  return 0;
};

const SearchBox = ({
  items = null,
  onSelectItem,
  placeholder = "Tìm kiếm mọi thứ trong trang...",
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const searchSource = useMemo(() => expandSearchSource(items), [items]);

  useKeyboardShortcuts({
    "ctrl+k": () => {
      inputRef.current?.focus();
    },
  });

  const renderHighlightedText = (text, searchQuery) => {
    const safeText = String(text || "");
    if (!searchQuery) return safeText;

    const escapedQuery = String(searchQuery).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return safeText.split(regex).map((part, index) =>
      part.toLowerCase() === String(searchQuery).toLowerCase() ? (
        <span key={`${part}-${index}`} className="search-highlight">
          {part}
        </span>
      ) : (
        <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      ),
    );
  };

  const performSearch = (searchQuery) => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return [];

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const searchResults = [];

    searchSource.forEach((item) => {
      const fields = {
        title: normalizeSearchText(item.title),
        description: normalizeSearchText(item.description),
        category: normalizeSearchText(item.category),
        keywords: (Array.isArray(item.keywords) ? item.keywords : []).map(
          normalizeSearchText,
        ),
      };
      const tokenScores = tokens.map((token) => scoreToken(token, fields));
      if (tokenScores.some((score) => score === 0)) return;

      const phraseBonus = fields.title.includes(normalizedQuery)
        ? 50
        : fields.description.includes(normalizedQuery)
          ? 20
          : 0;
      searchResults.push({
        ...item,
        score: tokenScores.reduce((sum, score) => sum + score, phraseBonus),
        highlightedTitle: renderHighlightedText(item.title, searchQuery),
        highlightedDescription: renderHighlightedText(
          item.description,
          searchQuery,
        ),
      });
    });

    return searchResults.sort((a, b) => b.score - a.score).slice(0, 12);
  };

  const handleSearch = (event) => {
    const searchQuery = event.target.value;
    setQuery(searchQuery);
    setResults(performSearch(searchQuery));
    setSelectedIndex(-1);
    setShowResults(searchQuery.length > 0);
  };

  const selectResult = (result) => {
    setQuery("");
    setShowResults(false);
    inputRef.current?.blur();

    if (result.page) {
      const navigationQuery = { ...(result.query || {}) };
      if (result.restaurantScoped) {
        const restaurantId = localStorage.getItem("manager.selectedRestaurantId");
        if (restaurantId) navigationQuery.restaurantId = restaurantId;
      }
      window.dispatchEvent(
        new CustomEvent("manager:navigate", {
          detail: {
            page: result.page,
            query: navigationQuery,
            source: "manager-search",
          },
        }),
      );
      return;
    }

    if (typeof onSelectItem === "function") {
      onSelectItem(result);
      return;
    }

    if (result.type === "navigation" && result.route) {
      window.location.hash = result.route;
    }
  };

  const handleKeyDown = (event) => {
    if (!showResults) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter": {
        event.preventDefault();
        const result = results[selectedIndex >= 0 ? selectedIndex : 0];
        if (result) selectResult(result);
        break;
      }
      case "Escape":
        event.preventDefault();
        setShowResults(false);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const groupedResults = results.reduce((groups, result) => {
    const category = result.category || "Kết quả";
    if (!groups[category]) groups[category] = [];
    groups[category].push(result);
    return groups;
  }, {});

  return (
    <div className="search-container">
      <div className="search-box">
        <Search
          className="search-icon"
          size={17}
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="search-input"
          value={query}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length > 0 && setShowResults(true)}
          autoComplete="off"
          aria-label={placeholder}
          aria-expanded={showResults}
        />
        <div className="search-shortcut">
          <kbd>Ctrl</kbd> + <kbd>K</kbd>
        </div>
      </div>

      {showResults && (
        <div className="search-results active">
          <div className="search-results-content">
            {results.length === 0 ? (
              <div className="search-no-results">
                <Search
                  className="search-no-results-icon"
                  size={28}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <div>
                  Không tìm thấy kết quả cho "<strong>{query}</strong>"
                </div>
              </div>
            ) : (
              Object.entries(groupedResults).map(([category, categoryItems]) => (
                <div key={category}>
                  <div className="search-results-header">{category}</div>
                  {categoryItems.map((result) => {
                    const globalIndex = results.indexOf(result);
                    return (
                      <div
                        key={result.id}
                        className={`search-result-item ${
                          selectedIndex === globalIndex ? "highlighted" : ""
                        }`}
                        onClick={() => selectResult(result)}
                        role="button"
                        tabIndex={-1}
                      >
                        <div className="search-result-icon" aria-hidden="true">
                          {result.icon}
                        </div>
                        <div className="search-result-content">
                          <div className="search-result-title">
                            {result.highlightedTitle}
                          </div>
                          <div className="search-result-description">
                            {result.highlightedDescription}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="search-shortcut-hint">
            <span>Điều hướng</span>
            <div className="search-shortcut-keys">
              <kbd>↑</kbd> <kbd>↓</kbd> để chọn • <kbd>Enter</kbd> để mở •{" "}
              <kbd>Esc</kbd> để đóng
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBox;
