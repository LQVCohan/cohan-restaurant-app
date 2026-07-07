import { gql } from "@apollo/client";
import { apolloClient } from "@/apollo/client";

const STYLE_ID = "cohan-table-transfer-merge-style";
const OBSERVER_KEY = "__cohanTableTransferMergeObserver";
const PICKER_CLASS = "cohan-table-merge-picker";

const TABLES_QUERY = gql`
  query TableMergePickerTables($restaurantId: ID!) {
    tables(restaurantId: $restaurantId) {
      id
      code
      capacity
      status
      type
      floorId
      floorLevel
      joinGroupId
    }
  }
`;

const STATUS_LABELS = {
  available: "Trống",
  occupied: "Đang phục vụ",
  reserved: "Đã đặt",
  cleaning: "Đang dọn",
  payment_pending: "Chờ thanh toán",
  offline: "Ngừng phục vụ",
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const formatFloorOptionLabel = (value) => {
  const parts = String(value || "")
    .split(/\s+[—–-]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set();
  return parts
    .filter((part) => {
      const key = normalizeText(part);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" — ");
};

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .cohan-floor-transfer-select {
      width: 100%;
      min-height: 42px !important;
      padding: 9px 38px 9px 12px !important;
      border-color: rgba(83, 108, 97, .24) !important;
      color: #293832 !important;
      background-color: #fffdf8 !important;
      font-weight: 650;
      text-overflow: ellipsis;
    }

    .cohan-floor-transfer-select:focus {
      border-color: rgba(83, 108, 97, .58) !important;
      box-shadow: 0 0 0 3px rgba(83, 108, 97, .13) !important;
    }

    .cohan-merge-code-input[readonly] {
      cursor: pointer;
      color: #43564d;
      background: #f5f8f6 !important;
    }

    .cohan-merge-picker-hint {
      margin-top: 6px;
      color: #6c7872;
      font-size: .75rem;
      line-height: 1.4;
    }

    .${PICKER_CLASS} {
      position: fixed;
      inset: 0;
      z-index: 1450;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(34, 43, 39, .56);
      -webkit-backdrop-filter: blur(10px) saturate(1.04);
      backdrop-filter: blur(10px) saturate(1.04);
    }

    .${PICKER_CLASS}__dialog {
      width: min(720px, 96vw);
      max-height: min(760px, 90dvh);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(83, 108, 97, .18);
      border-radius: 22px;
      color: #26352f;
      background: linear-gradient(180deg, #fffdf8, #f6f2eb);
      box-shadow: 0 30px 82px rgba(31, 42, 36, .3);
    }

    .${PICKER_CLASS}__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 20px 15px;
      border-bottom: 1px solid rgba(83, 108, 97, .14);
      background: rgba(255, 253, 248, .96);
    }

    .${PICKER_CLASS}__header h2 {
      margin: 0;
      font-size: 1.08rem;
      font-weight: 850;
      letter-spacing: -.025em;
    }

    .${PICKER_CLASS}__header p {
      margin: 4px 0 0;
      color: #69756f;
      font-size: .8rem;
    }

    .${PICKER_CLASS}__close {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border: 1px solid rgba(83, 108, 97, .18);
      border-radius: 12px;
      color: #6e7c75;
      background: #fff;
      cursor: pointer;
      font-size: 1.25rem;
    }

    .${PICKER_CLASS}__body {
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      overflow: hidden;
    }

    .${PICKER_CLASS}__anchor {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid rgba(83, 108, 97, .16);
      border-radius: 14px;
      background: #edf4f0;
    }

    .${PICKER_CLASS}__anchor span {
      color: #66736c;
      font-size: .76rem;
    }

    .${PICKER_CLASS}__anchor strong {
      color: #315044;
      font-size: .92rem;
    }

    .${PICKER_CLASS}__search {
      display: grid;
      gap: 6px;
    }

    .${PICKER_CLASS}__search span {
      color: #46554e;
      font-size: .78rem;
      font-weight: 750;
    }

    .${PICKER_CLASS}__search input {
      width: 100%;
      min-height: 42px;
      padding: 9px 12px;
      border: 1px solid rgba(83, 108, 97, .22);
      border-radius: 11px;
      color: #26352f;
      background: #fff;
      font: inherit;
      outline: none;
    }

    .${PICKER_CLASS}__search input:focus {
      border-color: rgba(83, 108, 97, .58);
      box-shadow: 0 0 0 3px rgba(83, 108, 97, .13);
    }

    .${PICKER_CLASS}__summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #6a756f;
      font-size: .76rem;
    }

    .${PICKER_CLASS}__summary strong {
      color: #315044;
      font-variant-numeric: tabular-nums;
    }

    .${PICKER_CLASS}__list {
      min-height: 180px;
      max-height: 360px;
      display: grid;
      gap: 8px;
      padding-right: 5px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(83, 108, 97, .28) transparent;
    }

    .${PICKER_CLASS}__item {
      min-height: 64px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid rgba(86, 72, 58, .14);
      border-radius: 14px;
      background: rgba(255, 255, 255, .82);
      cursor: pointer;
      transition: border-color .16s ease, background .16s ease, transform .16s ease;
    }

    .${PICKER_CLASS}__item:hover {
      border-color: rgba(83, 108, 97, .34);
      background: #f4f8f6;
      transform: translateY(-1px);
    }

    .${PICKER_CLASS}__item.is-selected {
      border-color: rgba(83, 108, 97, .58);
      background: #eaf2ee;
      box-shadow: inset 0 0 0 1px rgba(83, 108, 97, .12);
    }

    .${PICKER_CLASS}__item.is-disabled {
      opacity: .58;
      cursor: not-allowed;
      transform: none;
    }

    .${PICKER_CLASS}__item input {
      width: 18px;
      height: 18px;
      accent-color: #536c61;
    }

    .${PICKER_CLASS}__item-main {
      min-width: 0;
    }

    .${PICKER_CLASS}__item-main strong {
      display: block;
      overflow: hidden;
      color: #27372f;
      font-size: .9rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .${PICKER_CLASS}__item-main span {
      display: block;
      margin-top: 3px;
      color: #6c7872;
      font-size: .74rem;
    }

    .${PICKER_CLASS}__status {
      padding: 5px 8px;
      border-radius: 8px;
      color: #4a5d54;
      background: #eef3f0;
      font-size: .7rem;
      font-weight: 750;
      white-space: nowrap;
    }

    .${PICKER_CLASS}__empty,
    .${PICKER_CLASS}__error,
    .${PICKER_CLASS}__loading {
      min-height: 150px;
      display: grid;
      place-items: center;
      padding: 18px;
      border: 1px dashed rgba(83, 108, 97, .22);
      border-radius: 14px;
      color: #6b7771;
      background: rgba(255, 253, 248, .72);
      text-align: center;
      font-size: .82rem;
    }

    .${PICKER_CLASS}__error {
      color: #9a4545;
      border-color: rgba(165, 69, 69, .22);
      background: #fff5f3;
    }

    .${PICKER_CLASS}__footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px 16px;
      border-top: 1px solid rgba(83, 108, 97, .14);
      background: rgba(255, 253, 248, .97);
    }

    .${PICKER_CLASS}__footer button {
      min-height: 40px;
      padding: 9px 15px;
      border: 1px solid rgba(83, 108, 97, .17);
      border-radius: 11px;
      color: #46564f;
      background: #eff4f1;
      cursor: pointer;
      font-weight: 750;
    }

    .${PICKER_CLASS}__footer button[data-confirm] {
      color: #fff;
      border-color: #486158;
      background: linear-gradient(145deg, #657f73, #466056);
      box-shadow: 0 8px 18px rgba(55, 82, 70, .2);
    }

    .${PICKER_CLASS}__footer button:disabled {
      opacity: .55;
      cursor: not-allowed;
      box-shadow: none;
    }

    .${PICKER_CLASS} button:focus-visible,
    .${PICKER_CLASS} input:focus-visible {
      outline: 3px solid rgba(83, 108, 97, .22);
      outline-offset: 2px;
    }

    @media (max-width: 560px) {
      .${PICKER_CLASS} {
        align-items: end;
        padding: 0;
      }

      .${PICKER_CLASS}__dialog {
        width: 100%;
        max-height: 92dvh;
        border-right: 0;
        border-bottom: 0;
        border-left: 0;
        border-radius: 22px 22px 0 0;
      }

      .${PICKER_CLASS}__item {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .${PICKER_CLASS}__status {
        grid-column: 2;
        justify-self: start;
      }

      .${PICKER_CLASS}__footer {
        display: grid;
        grid-template-columns: 1fr 1fr;
        padding-bottom: calc(14px + env(safe-area-inset-bottom));
      }
    }
  `;
  document.head.appendChild(style);
};

const getGroupTitle = (group) =>
  group?.querySelector(".talite-group-header .talite-label, .talite-label")?.textContent?.trim() || "";

const findGroup = (modal, words) =>
  Array.from(modal.querySelectorAll(".talite-group")).find((group) => {
    const title = normalizeText(getGroupTitle(group));
    return words.every((word) => title.includes(normalizeText(word)));
  });

const optimizeFloorSelect = (modal) => {
  const group = findGroup(modal, ["chuyển", "tầng"]);
  const select = group?.querySelector("select");
  if (!select) return;

  select.classList.add("cohan-floor-transfer-select");
  select.setAttribute("aria-label", "Chọn tầng đích");
  Array.from(select.options).forEach((option) => {
    const nextLabel = formatFloorOptionLabel(option.textContent);
    if (nextLabel && nextLabel !== option.textContent) option.textContent = nextLabel;
  });
};

const getInfoValue = (modal, label) => {
  const normalizedLabel = normalizeText(label);
  const row = Array.from(modal.querySelectorAll(".talite-info .kv")).find((item) =>
    normalizeText(item.querySelector(".k")?.textContent).startsWith(normalizedLabel),
  );
  return row?.querySelector(".v")?.textContent?.trim() || "";
};

const setNativeInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const getRestaurantId = () =>
  document.querySelector(".management-page-header .mph-select")?.value || "";

const parseFloorLevel = (value) => {
  const match = String(value || "").match(/-?\d+/);
  return match ? Number(match[0]) : null;
};

const createPickerShell = () => {
  const overlay = document.createElement("div");
  overlay.className = PICKER_CLASS;
  overlay.innerHTML = `
    <section class="${PICKER_CLASS}__dialog" role="dialog" aria-modal="true" aria-labelledby="cohan-merge-picker-title">
      <header class="${PICKER_CLASS}__header">
        <div>
          <h2 id="cohan-merge-picker-title">Chọn bàn để ghép</h2>
          <p>Tìm và chọn các bàn cùng tầng với bàn đang mở.</p>
        </div>
        <button type="button" class="${PICKER_CLASS}__close" aria-label="Đóng">×</button>
      </header>
      <div class="${PICKER_CLASS}__body">
        <div class="${PICKER_CLASS}__anchor">
          <span>Bàn đại diện</span>
          <strong data-anchor>--</strong>
        </div>
        <label class="${PICKER_CLASS}__search">
          <span>Tìm bàn</span>
          <input type="search" autocomplete="off" placeholder="Nhập mã bàn, trạng thái hoặc sức chứa…" />
        </label>
        <div class="${PICKER_CLASS}__summary" aria-live="polite">
          <span data-result-count>Đang tải danh sách bàn…</span>
          <strong data-selected-count>Đã chọn 0 bàn</strong>
        </div>
        <div class="${PICKER_CLASS}__list" role="listbox" aria-multiselectable="true">
          <div class="${PICKER_CLASS}__loading">Đang tải các bàn cùng tầng…</div>
        </div>
      </div>
      <footer class="${PICKER_CLASS}__footer">
        <button type="button" data-cancel>Hủy</button>
        <button type="button" data-confirm disabled>Ghép các bàn đã chọn</button>
      </footer>
    </section>
  `;
  return overlay;
};

const openMergePicker = async ({ modal, input, mergeButton }) => {
  document.querySelector(`.${PICKER_CLASS}`)?.remove();
  const overlay = createPickerShell();
  const dialog = overlay.querySelector(`.${PICKER_CLASS}__dialog`);
  const closeButton = overlay.querySelector(`.${PICKER_CLASS}__close`);
  const cancelButton = overlay.querySelector("[data-cancel]");
  const confirmButton = overlay.querySelector("[data-confirm]");
  const searchInput = overlay.querySelector("input[type='search']");
  const list = overlay.querySelector(`.${PICKER_CLASS}__list`);
  const resultCount = overlay.querySelector("[data-result-count]");
  const selectedCount = overlay.querySelector("[data-selected-count]");
  const anchorLabel = overlay.querySelector("[data-anchor]");
  const previousFocus = document.activeElement;
  const selectedIds = new Set();
  let candidates = [];
  let currentTable = null;

  const close = () => {
    document.removeEventListener("keydown", handleKeyDown, true);
    overlay.remove();
    previousFocus?.focus?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateSummary = (visibleCount = candidates.length) => {
    resultCount.textContent = `${visibleCount}/${candidates.length} bàn phù hợp`;
    selectedCount.textContent = `Đã chọn ${selectedIds.size} bàn`;
    confirmButton.disabled = selectedIds.size === 0;
  };

  const renderCandidates = () => {
    const query = normalizeText(searchInput.value);
    const visible = candidates.filter((item) => {
      const haystack = normalizeText(
        `${item.code} ${item.capacity} ${item.status} ${STATUS_LABELS[item.status] || ""} ${item.type || ""}`,
      );
      return !query || haystack.includes(query);
    });

    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = `${PICKER_CLASS}__empty`;
      empty.textContent = candidates.length
        ? "Không tìm thấy bàn phù hợp với từ khóa."
        : "Tầng này chưa có bàn khác để ghép.";
      list.appendChild(empty);
      updateSummary(0);
      return;
    }

    visible.forEach((item) => {
      const disabled = Boolean(item.joinGroupId);
      const label = document.createElement("label");
      label.className = `${PICKER_CLASS}__item${selectedIds.has(item.id) ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`;
      label.setAttribute("role", "option");
      label.setAttribute("aria-selected", selectedIds.has(item.id) ? "true" : "false");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = item.id;
      checkbox.checked = selectedIds.has(item.id);
      checkbox.disabled = disabled;
      checkbox.setAttribute("aria-label", `Chọn bàn ${item.code}`);

      const main = document.createElement("span");
      main.className = `${PICKER_CLASS}__item-main`;
      const code = document.createElement("strong");
      code.textContent = `Bàn ${item.code || "chưa có mã"}`;
      const meta = document.createElement("span");
      meta.textContent = disabled
        ? `${item.capacity || 0} chỗ · Đang thuộc nhóm bàn khác`
        : `${item.capacity || 0} chỗ · ${item.type || "standard"}`;
      main.append(code, meta);

      const status = document.createElement("span");
      status.className = `${PICKER_CLASS}__status`;
      status.textContent = STATUS_LABELS[item.status] || item.status || "Chưa rõ";

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedIds.add(item.id);
        else selectedIds.delete(item.id);
        renderCandidates();
      });

      label.append(checkbox, main, status);
      list.appendChild(label);
    });
    updateSummary(visible.length);
  };

  closeButton.addEventListener("click", close);
  cancelButton.addEventListener("click", close);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });
  searchInput.addEventListener("input", renderCandidates);
  document.addEventListener("keydown", handleKeyDown, true);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => searchInput.focus());

  const restaurantId = getRestaurantId();
  const currentCode = modal.querySelector(".talite-title b")?.textContent?.trim() || getInfoValue(modal, "Mã bàn");
  const currentFloorLevel = parseFloorLevel(getInfoValue(modal, "Tầng"));
  anchorLabel.textContent = currentFloorLevel == null
    ? `Bàn ${currentCode || "--"}`
    : `Bàn ${currentCode || "--"} · Tầng ${currentFloorLevel}`;

  if (!restaurantId) {
    list.innerHTML = `<div class="${PICKER_CLASS}__error">Chưa xác định được chi nhánh đang quản lý.</div>`;
    resultCount.textContent = "Không thể tải danh sách bàn";
    return;
  }

  try {
    const response = await apolloClient.query({
      query: TABLES_QUERY,
      variables: { restaurantId },
      fetchPolicy: "network-only",
    });
    const allTables = response?.data?.tables || [];
    currentTable = allTables.find(
      (item) =>
        normalizeText(item.code) === normalizeText(currentCode) &&
        (currentFloorLevel == null || Number(item.floorLevel) === currentFloorLevel),
    );

    if (!currentTable) {
      throw new Error("Không tìm thấy bàn đang mở trong danh sách của chi nhánh.");
    }

    anchorLabel.textContent = `Bàn ${currentTable.code} · Tầng ${currentTable.floorLevel ?? "--"}`;
    if (currentTable.joinGroupId) {
      list.innerHTML = `<div class="${PICKER_CLASS}__error">Bàn này đang thuộc một nhóm ghép. Hãy tách bàn trước khi tạo nhóm mới.</div>`;
      resultCount.textContent = "Không thể ghép thêm bàn";
      return;
    }

    candidates = allTables
      .filter(
        (item) =>
          String(item.id) !== String(currentTable.id) &&
          String(item.floorId) === String(currentTable.floorId),
      )
      .sort((a, b) =>
        String(a.code || "").localeCompare(String(b.code || ""), "vi", {
          numeric: true,
          sensitivity: "base",
        }),
      );

    const existingCodes = new Set(
      String(input.value || "")
        .split(/[ ,]+/)
        .map(normalizeText)
        .filter(Boolean),
    );
    candidates.forEach((item) => {
      if (existingCodes.has(normalizeText(item.code)) && !item.joinGroupId) selectedIds.add(item.id);
    });
    renderCandidates();
  } catch (error) {
    list.replaceChildren();
    const errorState = document.createElement("div");
    errorState.className = `${PICKER_CLASS}__error`;
    errorState.textContent = error?.message || "Không thể tải danh sách bàn. Vui lòng thử lại.";
    list.appendChild(errorState);
    resultCount.textContent = "Không thể tải danh sách bàn";
  }

  confirmButton.addEventListener("click", () => {
    if (!currentTable || selectedIds.size === 0) return;
    const selectedCodes = candidates
      .filter((item) => selectedIds.has(item.id))
      .map((item) => item.code)
      .filter(Boolean);
    setNativeInputValue(input, selectedCodes.join(", "));
    close();
    mergeButton.dataset.mergePickerBypass = "true";
    requestAnimationFrame(() => {
      mergeButton.click();
      delete mergeButton.dataset.mergePickerBypass;
    });
  });
};

const enhanceMergeGroup = (modal) => {
  const group = findGroup(modal, ["ghép", "tách"]);
  if (!group || group.dataset.mergePickerReady === "true") return;
  const input = group.querySelector("input.talite-input");
  const mergeButton = Array.from(group.querySelectorAll("button")).find((button) =>
    normalizeText(button.textContent).includes("ghép bàn"),
  );
  if (!input || !mergeButton) return;

  group.dataset.mergePickerReady = "true";
  input.readOnly = true;
  input.classList.add("cohan-merge-code-input");
  input.placeholder = "Nhấn Ghép bàn để tìm và chọn";
  input.setAttribute("aria-label", "Các bàn đã chọn để ghép");

  const hint = document.createElement("div");
  hint.className = "cohan-merge-picker-hint";
  hint.textContent = "Tìm và chọn bàn cùng tầng; không cần nhập mã thủ công.";
  input.insertAdjacentElement("afterend", hint);

  mergeButton.addEventListener(
    "click",
    (event) => {
      if (mergeButton.dataset.mergePickerBypass === "true") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openMergePicker({ modal, input, mergeButton });
    },
    true,
  );
};

const enhanceTableModal = (root = document.body) => {
  if (!root?.querySelectorAll) return;
  const modals = root.matches?.(".talite-modal")
    ? [root]
    : Array.from(root.querySelectorAll(".talite-modal"));
  modals.forEach((modal) => {
    optimizeFloorSelect(modal);
    enhanceMergeGroup(modal);
  });
};

export const installTableTransferMergeEnhancement = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[OBSERVER_KEY]) return;

  ensureStyles();
  let scheduled = false;
  const run = () => {
    scheduled = false;
    enhanceTableModal(document.body);
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
  formatFloorOptionLabel,
  enhanceTableModal,
  STYLE_ID,
  OBSERVER_KEY,
  PICKER_CLASS,
};
