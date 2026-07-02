import React, { useState, useRef } from "react";
import { Search } from "lucide-react";
import { searchData } from "../../data/searchData";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import "./SearchBox.scss";

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
  const searchSource = Array.isArray(items) && items.length > 0 ? items : searchData;

  useKeyboardShortcuts({
    "ctrl+k": () => {
      inputRef.current?.focus();
    },
  });

  const performSearch = (searchQuery) => {
    if (!searchQuery || searchQuery.length < 1) {
      return [];
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const searchResults = [];

    searchSource.forEach((item) => {
      let score = 0;

      const titleLower = String(item.title || "").toLowerCase();
      if (titleLower.includes(normalizedQuery)) {
        score += titleLower.indexOf(normalizedQuery) === 0 ? 100 : 50;
      }

      const descriptionLower = String(item.description || "").toLowerCase();
      if (descriptionLower.includes(normalizedQuery)) {
        score += 25;
      }

      const categoryLower = String(item.category || "").toLowerCase();
      if (categoryLower.includes(normalizedQuery)) {
        score += 15;
      }

      const keywords = Array.isArray(item.keywords) ? item.keywords : [];
      if (keywords.some((keyword) => String(keyword).toLowerCase().includes(normalizedQuery))) {
        score += 35;
      }

      if (score > 0) {
        searchResults.push({
          ...item,
          score,
          highlightedTitle: renderHighlightedText(item.title, searchQuery),
          highlightedDescription: renderHighlightedText(item.description, searchQuery),
        });
      }
    });

    return searchResults.sort((a, b) => b.score - a.score).slice(0, 10);
  };

  const renderHighlightedText = (text, searchQuery) => {
    const safeText = String(text || "");
    if (!searchQuery) return safeText;

    const escapedQuery = String(searchQuery).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return safeText.split(regex).map((part, index) =>
      part.toLowerCase() === String(searchQuery).toLowerCase() ? (
        <span key={`${part}-${index}`} className="search-highlight">{part}</span>
      ) : (
        <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      )
    );
  };

  const handleSearch = (event) => {
    const searchQuery = event.target.value;
    setQuery(searchQuery);

    const searchResults = performSearch(searchQuery);
    setResults(searchResults);
    setSelectedIndex(-1);
    setShowResults(searchQuery.length > 0);
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
      case "Enter":
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          selectResult(results[selectedIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        setShowResults(false);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const selectResult = (result) => {
    setQuery("");
    setShowResults(false);
    inputRef.current?.blur();

    if (typeof onSelectItem === "function") {
      onSelectItem(result);
      return;
    }

    if (result.type === "navigation" && result.route) {
      window.location.hash = result.route;
    }
  };

  const groupedResults = results.reduce((groups, result) => {
    const category = result.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(result);
    return groups;
  }, {});

  return (
    <div className="search-container">
      <div className="search-box">
        <Search className="search-icon" size={17} strokeWidth={2} aria-hidden="true" />
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
                <Search className="search-no-results-icon" size={28} strokeWidth={1.8} aria-hidden="true" />
                <div>
                  Không tìm thấy kết quả cho "<strong>{query}</strong>"
                </div>
              </div>
            ) : (
              Object.keys(groupedResults).map((category) => (
                <div key={category}>
                  <div className="search-results-header">{category}</div>
                  {groupedResults[category].map((result) => {
                    const globalIndex = results.indexOf(result);
                    return (
                      <div
                        key={result.id}
                        className={`search-result-item ${
                          selectedIndex === globalIndex ? "highlighted" : ""
                        }`}
                        onClick={() => selectResult(result)}
                      >
                        <div className="search-result-icon">{result.icon}</div>
                        <div className="search-result-content">
                          <div className="search-result-title">{result.highlightedTitle}</div>
                          <div className="search-result-description">{result.highlightedDescription}</div>
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
