const TAB_ITEMS = [
  { key: "overview", label: "Tổng quan" },
  { key: "configuration", label: "Cấu hình" },
  { key: "operations", label: "Vận hành" },
  { key: "booking", label: "Đặt bàn" },
  { key: "assistant", label: "Gợi ý AI" },
];

const SAVE_TABS = new Set(["configuration", "booking"]);

const TAB_STATE_COPY = {
  overview: "Xem nhanh tình trạng bàn. Thao tác trạng thái được áp dụng ngay.",
  configuration: "Các thay đổi trong mục này được áp dụng khi bấm Lưu cấu hình.",
  operations: "Các thao tác vận hành được áp dụng ngay sau khi xác nhận.",
  booking: "Các thay đổi đặt bàn được áp dụng khi bấm Lưu cấu hình.",
  assistant: "Gợi ý AI chỉ hỗ trợ quyết định và không tự thay đổi dữ liệu bàn.",
};

const normalizeText = (value) => String(value || "").trim().toLocaleLowerCase("vi");

const getGroupTitle = (group) =>
  normalizeText(
    group?.querySelector?.(".talite-group-header .talite-label, .talite-label")
      ?.textContent,
  );

const classifyGroup = (group) => {
  const title = getGroupTitle(group);

  if (title.includes("trợ lý vận hành") || title.includes("gợi ý ai")) {
    return "assistant";
  }

  if (title.includes("đặt cọc") || title.includes("chính sách đặt bàn")) {
    return "booking";
  }

  if (
    title.includes("trạng thái") ||
    title.includes("chuyển bàn") ||
    title.includes("đổi vị trí") ||
    title.includes("đổi chỗ") ||
    title.includes("ghép hoặc tách")
  ) {
    return "operations";
  }

  return "configuration";
};

const isStatusGroup = (group) => getGroupTitle(group).includes("trạng thái");

const getDirectSections = (body) =>
  Array.from(body?.children || []).filter(
    (element) =>
      element.classList?.contains("talite-group") ||
      element.classList?.contains("actions-end"),
  );

const getDirectSummary = (body) =>
  Array.from(body?.children || []).find((element) =>
    element.classList?.contains("talite-info"),
  );

const getSaveButton = (modal) =>
  modal.querySelector(".talite-footer .btn.primary") ||
  Array.from(modal.querySelectorAll(".talite-footer button")).find((button) =>
    normalizeText(button.textContent).includes("lưu"),
  );

const ensureFooterState = (modal) => {
  const footer = modal.querySelector(".talite-footer");
  const actions = footer?.querySelector(".actions");
  if (!footer) return null;

  let state = footer.querySelector(".table-detail-tab-state");
  if (!state) {
    state = document.createElement("div");
    state.className = "table-detail-tab-state";
    state.setAttribute("aria-live", "polite");
    footer.insertBefore(state, actions || null);
  }

  return state;
};

const syncSections = (modal, activeKey) => {
  const body = modal.querySelector(".talite-body");
  if (!body) return;

  const summary = getDirectSummary(body);
  if (summary) summary.hidden = false;

  getDirectSections(body).forEach((section) => {
    const sectionKey = section.classList.contains("talite-group")
      ? classifyGroup(section)
      : "configuration";
    const visibleInOverview = section.classList.contains("talite-group") && isStatusGroup(section);

    section.dataset.tableDetailSection = sectionKey;
    section.hidden = !(
      sectionKey === activeKey ||
      (activeKey === "overview" && visibleInOverview)
    );
  });
};

const syncFooter = (modal, activeKey) => {
  const state = ensureFooterState(modal);
  const copy = TAB_STATE_COPY[activeKey] || TAB_STATE_COPY.overview;
  if (state && state.textContent !== copy) state.textContent = copy;

  const saveButton = getSaveButton(modal);
  if (!saveButton) return;

  const saveLabel = normalizeText(saveButton.textContent);
  if (saveLabel === "lưu thay đổi" || saveLabel === "lưu cấu hình") {
    saveButton.textContent = "Lưu cấu hình";
  }
  saveButton.hidden = !SAVE_TABS.has(activeKey);
};

const syncTabButtons = (modal, activeKey) => {
  const nav = modal.querySelector(".table-detail-tabs");
  const body = modal.querySelector(".talite-body");
  if (!nav || !body) return;

  nav.querySelectorAll("[role='tab']").forEach((button) => {
    const isActive = button.dataset.tableDetailTab === activeKey;
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
    if (isActive) body.setAttribute("aria-labelledby", button.id);
  });
};

export const activateTableDetailTab = (modal, nextKey, { focus = false } = {}) => {
  if (!modal) return;
  const activeKey = TAB_ITEMS.some((item) => item.key === nextKey) ? nextKey : "overview";
  const previousKey = modal.dataset.tableDetailActiveTab;

  modal.dataset.tableDetailActiveTab = activeKey;
  syncSections(modal, activeKey);
  syncFooter(modal, activeKey);
  syncTabButtons(modal, activeKey);

  const body = modal.querySelector(".talite-body");
  if (body && previousKey !== activeKey) body.scrollTop = 0;

  if (focus) {
    modal
      .querySelector(`[data-table-detail-tab='${activeKey}']`)
      ?.focus?.();
  }
};

const handleTabKeyDown = (event, modal) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

  const currentKey = event.currentTarget.dataset.tableDetailTab;
  const currentIndex = TAB_ITEMS.findIndex((item) => item.key === currentKey);
  if (currentIndex < 0) return;

  event.preventDefault();

  let nextIndex = currentIndex;
  if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + TAB_ITEMS.length) % TAB_ITEMS.length;
  } else if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % TAB_ITEMS.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = TAB_ITEMS.length - 1;
  }

  activateTableDetailTab(modal, TAB_ITEMS[nextIndex].key, { focus: true });
};

const ensureTabBar = (modal) => {
  const header = modal.querySelector(".talite-header");
  const body = modal.querySelector(".talite-body");
  if (!header || !body) return;

  if (!body.id) body.id = `table-detail-tab-panel-${Math.random().toString(36).slice(2, 9)}`;
  body.setAttribute("role", "tabpanel");

  let nav = modal.querySelector(".table-detail-tabs");
  if (!nav) {
    nav = document.createElement("div");
    nav.className = "table-detail-tabs";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Nhóm thông tin chi tiết bàn");

    TAB_ITEMS.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id = `table-detail-tab-${item.key}-${Math.random().toString(36).slice(2, 7)}`;
      button.dataset.tableDetailTab = item.key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", body.id);
      button.textContent = item.label;
      button.addEventListener("click", () => activateTableDetailTab(modal, item.key));
      button.addEventListener("keydown", (event) => handleTabKeyDown(event, modal));
      nav.appendChild(button);
    });

    header.insertAdjacentElement("afterend", nav);
  }
};

export const enhanceTableDetailModal = (modal) => {
  if (!modal?.matches?.(".talite-modal")) return;

  ensureTabBar(modal);
  modal.dataset.tableDetailTabsReady = "true";
  activateTableDetailTab(modal, modal.dataset.tableDetailActiveTab || "overview");
};

const findTableDetailModals = (root) => {
  if (!root?.querySelectorAll) return [];
  const matches = root.matches?.(".talite-modal") ? [root] : [];
  return [...matches, ...root.querySelectorAll(".talite-modal")];
};

export const installTableDetailModalTabs = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__tableDetailModalTabsInstalled) return;
  window.__tableDetailModalTabsInstalled = true;

  const enhance = (root = document.body) => {
    findTableDetailModals(root).forEach(enhanceTableDetailModal);
  };

  enhance();

  const observer = new MutationObserver((mutations) => {
    const pendingModals = new Set();

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        enhance(node);
        const parentModal = node.closest?.(".talite-modal");
        if (parentModal) pendingModals.add(parentModal);
      });
    });

    pendingModals.forEach(enhanceTableDetailModal);
  });

  observer.observe(document.body, { childList: true, subtree: true });
};
