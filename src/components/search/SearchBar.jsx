import { useState, useEffect } from "react";
import { useSearchSuggestions } from "../../hooks/useSearchSuggestions";
import { debounce } from "../../utils/search/debounce";

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState("");
  const { run, suggestions, loading } = useSearchSuggestions();

  const debounced = debounce((q) => run(q), 300);

  useEffect(() => {
    if (!query) return;
    debounced(query);
  }, [query]);

  return (
    <div className="searchbar">
      <input
        className="searchbar-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm món ăn, nhà hàng, vị trí..."
      />

      {query && suggestions && (
        <div className="searchbar-dropdown">
          {loading && <div className="loading">Đang tìm...</div>}

          {suggestions.restaurants?.map((r) => (
            <button
              key={r.id}
              className="item"
              onClick={() => onSelect("restaurant", r)}
            >
              <div className="label">{r.name}</div>
              <div className="sub">{r.shortAddress}</div>
            </button>
          ))}

          {suggestions.menuItems?.map((m) => (
            <button
              key={m.id}
              className="item"
              onClick={() => onSelect("menuItem", m)}
            >
              <div className="label">{m.name}</div>
              <div className="sub">{m.restaurantName}</div>
            </button>
          ))}

          {suggestions.locations?.map((l) => (
            <button
              key={l.label}
              className="item"
              onClick={() => onSelect("location", l)}
            >
              <div className="label">{l.label}</div>
            </button>
          ))}

          {suggestions.owners?.map((o) => (
            <button
              key={o.id}
              className="item"
              onClick={() => onSelect("owner", o)}
            >
              <div className="label">{o.fullName}</div>
              <div className="sub">{o.email}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
