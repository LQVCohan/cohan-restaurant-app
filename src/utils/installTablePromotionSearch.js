const STYLE_ID = "cohan-table-promotion-search-style";
const OBSERVER_KEY = "__cohanTablePromotionSearchObserver";
const SEARCH_CLASS = "cohan-table-promotion-search";
const EMPTY_CLASS = "cohan-table-promotion-search__empty";

let nextSearchId = 0;

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${SEARCH_CLASS} {
      margin: 8px 0 10px;
    }

    .${SEARCH_CLASS} .talite-input {
      width: 100%;
    }

    .${SEARCH_CLASS} .hint,
    .${EMPTY_CLASS} {
      margin-top: 6px;
    }
  `;
  document.head.appendChild(style);
};

const isPromotionBox = (box) =>
  box
    ?.querySelector(":scope > .talite-label")
    ?.textContent?.trim()
    ?.includes("Khuyến mãi đang hiệu lực");

const applyFilter = (box, input, summary, emptyState) => {
  const rows = Array.from(box.querySelectorAll(".talite-promo-list .talite-check"));
  const query = normalizeText(input.value);
  let visibleCount = 0;

  rows.forEach((row) => {
    const matches = !query || normalizeText(row.textContent).includes(query);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  const summaryText = query
    ? `Tìm thấy ${visibleCount}/${rows.length} khuyến mãi.`
    : `${rows.length} khuyến mãi đang hiệu lực.`;
  if (summary.textContent !== summaryText) summary.textContent = summaryText;

  emptyState.hidden = !query || visibleCount > 0;
};

const enhancePromotionBox = (box) => {
  if (!isPromotionBox(box)) return;

  const list = box.querySelector(".talite-promo-list");
  if (!list) return;

  let search = box.querySelector(`:scope > .${SEARCH_CLASS}`);
  let emptyState = box.querySelector(`:scope > .${EMPTY_CLASS}`);

  if (!search) {
    nextSearchId += 1;
    const inputId = `talite-promotion-search-${nextSearchId}`;
    const summaryId = `${inputId}-summary`;

    search = document.createElement("div");
    search.className = SEARCH_CLASS;
    search.innerHTML = `
      <label class="talite-label" for="${inputId}">Tìm khuyến mãi</label>
      <input
        id="${inputId}"
        name="promotionSearch"
        class="talite-input"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="Nhập tên khuyến mãi…"
        aria-describedby="${summaryId}"
      />
      <div id="${summaryId}" class="hint" aria-live="polite"></div>
    `;
    list.before(search);
  }

  if (!emptyState) {
    emptyState = document.createElement("div");
    emptyState.className = `hint ${EMPTY_CLASS}`;
    emptyState.textContent = "Không tìm thấy khuyến mãi phù hợp.";
    emptyState.hidden = true;
    list.after(emptyState);
  }

  const input = search.querySelector("input[type='search']");
  const summary = search.querySelector("[aria-live='polite']");
  if (!input || !summary) return;

  if (input.dataset.promotionSearchReady !== "true") {
    input.dataset.promotionSearchReady = "true";
    input.addEventListener("input", () => applyFilter(box, input, summary, emptyState));
  }

  applyFilter(box, input, summary, emptyState);
};

const enhancePromotionSearch = (root = document.body) => {
  if (!root?.querySelectorAll) return;

  const boxes = root.matches?.(".talite-promo-box")
    ? [root]
    : Array.from(root.querySelectorAll(".talite-promo-box"));
  boxes.forEach(enhancePromotionBox);
};

export const installTablePromotionSearch = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[OBSERVER_KEY]) return;

  ensureStyles();
  let scheduled = false;
  const run = () => {
    scheduled = false;
    enhancePromotionSearch(document.body);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(run);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window[OBSERVER_KEY] = observer;
  schedule();
};

export const __testables = {
  normalizeText,
  enhancePromotionSearch,
  STYLE_ID,
  OBSERVER_KEY,
};
