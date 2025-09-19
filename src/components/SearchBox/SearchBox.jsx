import React, { useState, useEffect, useRef } from "react";
import { searchData } from "../../data/searchData";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import "./SearchBox.scss";

const SearchBox = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "ctrl+k": () => {
      inputRef.current?.focus();
    },
  });

  // Search function
  const performSearch = (searchQuery) => {
    if (!searchQuery || searchQuery.length < 1) {
      return [];
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const searchResults = [];

    searchData.forEach((item) => {
      let score = 0;
      let titleMatch = false;
      let descriptionMatch = false;

      // Check title match
      const titleLower = item.title.toLowerCase();
      if (titleLower.includes(normalizedQuery)) {
        score += titleLower.indexOf(normalizedQuery) === 0 ? 100 : 50;
        titleMatch = true;
      }

      // Check description match
      const descriptionLower = item.description.toLowerCase();
      if (descriptionLower.includes(normalizedQuery)) {
        score += 25;
        descriptionMatch = true;
      }

      // Check category match
      const categoryLower = item.category.toLowerCase();
      if (categoryLower.includes(normalizedQuery)) {
        score += 15;
      }

      if (score > 0) {
        searchResults.push({
          ...item,
          score,
          highlightedTitle: highlightText(item.title, searchQuery),
          highlightedDescription: highlightText(item.description, searchQuery),
        });
      }
    });

    return searchResults.sort((a, b) => b.score - a.score).slice(0, 8);
  };

  // Highlight matching text
  const highlightText = (text, searchQuery) => {
    if (!searchQuery) return text;

    const regex = new RegExp(
      `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  };

  // Handle search input
  const handleSearch = (event) => {
    const searchQuery = event.target.value;
    setQuery(searchQuery);

    const searchResults = performSearch(searchQuery);
    setResults(searchResults);
    setSelectedIndex(-1);

    if (searchQuery.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  // Handle keyboard navigation
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
    }
  };

  // Select a result
  const selectResult = (result) => {
    console.log("Selected:", result);
    setQuery("");
    setShowResults(false);
    inputRef.current?.blur();

    // Handle different result types
    switch (result.type) {
      case "navigation":
        // Navigate to page
        break;
      case "action":
        // Perform action
        break;
      default:
        break;
    }
  };

  // Group results by category
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
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Tìm kiếm mọi thứ trong trang..."
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
                <div className="search-no-results-icon">🔍</div>
                <div>
                  Không tìm thấy kết quả cho "<strong>{query}</strong>"
                </div>
              </div>
            ) : (
              Object.keys(groupedResults).map((category) => (
                <div key={category}>
                  <div className="search-results-header">{category}</div>
                  {groupedResults[category].map((result, index) => {
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
                          <div
                            className="search-result-title"
                            dangerouslySetInnerHTML={{
                              __html: result.highlightedTitle,
                            }}
                          />
                          <div
                            className="search-result-description"
                            dangerouslySetInnerHTML={{
                              __html: result.highlightedDescription,
                            }}
                          />
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
