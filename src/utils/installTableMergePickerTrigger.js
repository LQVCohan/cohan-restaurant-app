import { gql } from "@apollo/client";
import { apolloClient } from "@/apollo/client";

const OBSERVER_KEY = "__cohanTableMergePickerObserver";
const CLICK_HANDLER_KEY = "__cohanTableMergePickerClickHandler";
const LEGACY_OBSERVER_KEYS = [
  "__cohanTableMergePickerTriggerObserver",
  "__cohanTableTransferMergeObserver",
];
const LEGACY_CLICK_HANDLER_KEYS = ["__cohanTableMergePickerTriggerClickHandler"];
const OPEN_BUTTON_CLASS = "cohan-merge-picker-open";
const INPUT_CLASS = "cohan-merge-code-input";
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

const getMergeGroup = (modal) =>
  Array.from(modal?.querySelectorAll?.(".talite-group") || []).find((group) => {
    const title = normalizeText(
      group.querySelector(".talite-group-header .talite-label, .talite-label")
        ?.textContent,
    );
    return title.includes("ghep") && title.includes("tach");
  });

const getMergeInput = (group) => group?.querySelector("input.talite-input");

const getMergeButton = (group) =>
  Array.from(group?.querySelectorAll?.("button") || []).find((button) => {
    if (button.classList.contains(OPEN_BUTTON_CLASS)) return false;
    return normalizeText(button.textContent).includes("ghep ban");
  });

const getRestaurantId = () =>
  document.querySelector(".management-page-header .mph-select")?.value || "";

const getInfoValue = (modal, label) => {
  const normalizedLabel = normalizeText(label);
  const row = Array.from(modal.querySelectorAll(".talite-info .kv")).find((item) =>
    normalizeText(item.querySelector(".k")?.textContent).startsWith(normalizedLabel),
  );
  return row?.querySelector(".v")?.textContent?.trim() || "";
};

const parseFloorLevel = (value) => {
  const match = String(value || "").match(/-?\d+/);
  return match ? Number(match[0]) : null;
};

const setNativeInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const prepareMergeGroup = (modal) => {
  const group = getMergeGroup(modal);
  const input = getMergeInput(group);
  const mergeButton = getMergeButton(group);
  if (!group || !input || !mergeButton) return null;

  input.readOnly = true;
  input.classList.add(INPUT_CLASS);
  input.placeholder = "Chưa chọn bàn";
  input.setAttribute("aria-label", "Các bàn đã chọn để ghép");
  input.setAttribute("aria-haspopup", "dialog");

  // Disable the legacy per-button listener when Vite HMR kept it alive.
  mergeButton.dataset.mergePickerBypass = "true";

  let openButton = group.querySelector(`.${OPEN_BUTTON_CLASS}`);
  if (!openButton) {
    openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = `btn ghost ${OPEN_BUTTON_CLASS}`;
    openButton.textContent = "Chọn bàn từ danh sách";
    openButton.setAttribute("aria-haspopup", "dialog");
    input.insertAdjacentElement("afterend", openButton);
  }

  let hint = group.querySelector(".cohan-merge-picker-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.className = "cohan-merge-picker-hint";
    hint.textContent =
      "Danh sách chỉ hiển thị các bàn cùng tầng. Có thể tìm theo mã, trạng thái hoặc sức chứa.";
    openButton.insertAdjacentElement("afterend", hint);
  }

  mergeButton.textContent = input.value.trim()
    ? "Ghép bàn đã chọn"
    : "Ghép bàn";

  return { modal, group, input, mergeButton, openButton };
};

const prepareAllTableModals = () => {
  document
    .querySelectorAll(".talite-modal")
    .forEach((modal) => prepareMergeGroup(modal));
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
        <button type="button" class="${PICKER_CLASS}__close" aria-label="Đóng danh sách chọn bàn">×</button>
      </header>
      <div class="${PICKER_CLASS}__body">
        <div class="${PICKER_CLASS}__anchor">
          <span>Bàn đại diện</span>
          <strong data-anchor>--</strong>
        </div>
        <label class="${PICKER_CLASS}__search">
          <span>Tìm bàn</span>
          <input name="tableMergeSearch" type="search" autocomplete="off" placeholder="Nhập mã bàn, trạng thái hoặc sức chứa…" />
        </label>
        <div class="${PICKER_CLASS}__summary" aria-live="polite">
          <span data-result-count>Đang tải danh sách bàn…</span>
          <strong data-selected-count>Đã chọn 0 bàn</strong>
        </div>
        <div class="${PICKER_CLASS}__list" role="list">
          <div class="${PICKER_CLASS}__loading">Đang tải các bàn cùng tầng…</div>
        </div>
      </div>
      <footer class="${PICKER_CLASS}__footer">
        <button type="button" data-cancel>Hủy</button>
        <button type="button" data-confirm disabled>Chọn ít nhất 1 bàn</button>
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
      dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
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
    confirmButton.textContent = selectedIds.size
      ? `Dùng ${selectedIds.size} bàn đã chọn`
      : "Chọn ít nhất 1 bàn";
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
  const currentCode =
    modal.querySelector(".talite-title b")?.textContent?.trim() ||
    getInfoValue(modal, "Mã bàn");
  const currentFloorLevel = parseFloorLevel(getInfoValue(modal, "Tầng"));
  anchorLabel.textContent =
    currentFloorLevel == null
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
      if (existingCodes.has(normalizeText(item.code)) && !item.joinGroupId) {
        selectedIds.add(item.id);
      }
    });
    renderCandidates();
  } catch (error) {
    list.replaceChildren();
    const errorState = document.createElement("div");
    errorState.className = `${PICKER_CLASS}__error`;
    errorState.textContent =
      error?.message || "Không thể tải danh sách bàn. Vui lòng thử lại.";
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
    mergeButton.textContent = "Ghép bàn đã chọn";
    close();
  });
};

export const installTableMergePickerTrigger = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  LEGACY_OBSERVER_KEYS.forEach((key) => {
    window[key]?.disconnect?.();
    delete window[key];
  });
  LEGACY_CLICK_HANDLER_KEYS.forEach((key) => {
    const handler = window[key];
    if (handler) document.removeEventListener("click", handler, true);
    delete window[key];
  });

  prepareAllTableModals();

  window[OBSERVER_KEY]?.disconnect?.();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      prepareAllTableModals();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window[OBSERVER_KEY] = observer;

  const previousHandler = window[CLICK_HANDLER_KEY];
  if (previousHandler) document.removeEventListener("click", previousHandler, true);

  const handleClick = (event) => {
    const modal = event.target?.closest?.(".talite-modal");
    if (!modal) return;
    const prepared = prepareMergeGroup(modal);
    if (!prepared) return;

    const clickedOpenButton = event.target.closest?.(`.${OPEN_BUTTON_CLASS}`);
    const clickedInput = event.target.closest?.(`.${INPUT_CLASS}`);
    const clickedMergeButton = event.target.closest?.("button") === prepared.mergeButton;
    const shouldOpen =
      Boolean(clickedOpenButton || clickedInput) ||
      (clickedMergeButton && !prepared.input.value.trim());
    if (!shouldOpen) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openMergePicker(prepared);
  };

  document.addEventListener("click", handleClick, true);
  window[CLICK_HANDLER_KEY] = handleClick;
};

export const __testables = {
  normalizeText,
  getMergeGroup,
  getMergeButton,
  prepareMergeGroup,
  prepareAllTableModals,
  openMergePicker,
  OBSERVER_KEY,
  CLICK_HANDLER_KEY,
  OPEN_BUTTON_CLASS,
  PICKER_CLASS,
};
