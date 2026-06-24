const WORKFLOW_TEXT_REPLACEMENTS = new Map([
  ["T.Toán", "Thu tiền"],
  ["Thanh toán", "Thu tiền"],
  ["Tags (phân tách dấu phẩy)", "Nhãn bàn"],
  ["Khu vực (zone)", "Khu vực"],
  ["Đổi chỗ với bàn khác (đổi vị trí)", "Đổi vị trí với bàn khác"],
  ["swap code", "đổi vị trí"],
  ["Source:", "Nguồn:"],
  ["License:", "Bản quyền:"],
  ["Model URL:", "Liên kết model:"],
  ["Placement:", "Vị trí 3D:"],
  ["Key:", "Mã mẫu:"],
  ["metadata model và camera placement", "thông tin mô phỏng và vị trí camera"],
  ["Floor Plan Designer", "Thiết kế sơ đồ bàn"],
  ["Lối staff", "Lối nhân viên"],
]);

const FLOOR_TEXT_REPLACEMENTS = new Map([
  ["test", "Khu thử nghiệm"],
  ["Tầng 3 – test", "Tầng 3 – Khu thử nghiệm"],
  ["Tầng 3 - test", "Tầng 3 - Khu thử nghiệm"],
]);

const MODAL_SECTION_NAV = [
  { key: "overview", label: "Tổng quan", selector: ".talite-info" },
  { key: "basic", label: "Thông tin", match: ["Thông tin cơ bản"] },
  { key: "ops", label: "Vận hành", match: ["Trạng thái", "Chuyển tầng"] },
  { key: "booking", label: "Đặt bàn", match: ["Đặt cọc", "Chính sách"] },
  { key: "vr", label: "VR/3D", selector: ".talite-vr-block, .talite-visual-card" },
  { key: "ai", label: "AI", match: ["AI", "Gợi ý"] },
];

const SECTION_KIND_RULES = [
  { className: "talite-group--basic", match: ["Thông tin cơ bản"] },
  { className: "talite-group--operation", match: ["Trạng thái", "Chuyển tầng", "Đổi vị trí", "Gộp / Tách"] },
  { className: "talite-group--booking", match: ["Đặt cọc", "Chính sách"] },
  { className: "talite-group--ai", match: ["AI", "Gợi ý"] },
];

const shouldTuneElement = (element) => {
  if (!element?.closest) return false;
  return Boolean(
    element.closest(".tm-container") ||
      element.closest(".talite-modal") ||
      element.closest(".tm-modal--vr") ||
      element.closest(".table-3d-modal") ||
      element.closest(".fp-layout")
  );
};

const replaceExactText = (textNode) => {
  const value = textNode.nodeValue;
  if (!value || !value.trim()) return;
  const trimmed = value.trim();
  const exact = WORKFLOW_TEXT_REPLACEMENTS.get(trimmed) || FLOOR_TEXT_REPLACEMENTS.get(trimmed);
  if (exact) {
    textNode.nodeValue = value.replace(trimmed, exact);
    return;
  }

  let next = value;
  WORKFLOW_TEXT_REPLACEMENTS.forEach((replacement, search) => {
    if (next.includes(search)) next = next.split(search).join(replacement);
  });
  FLOOR_TEXT_REPLACEMENTS.forEach((replacement, search) => {
    if (next.trim() === search) next = next.replace(search, replacement);
  });
  if (next !== value) textNode.nodeValue = next;
};

const tuneText = (root) => {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  if (!shouldTuneElement(root)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    replaceExactText(node);
    node = walker.nextNode();
  }
};

const tuneButtons = (root) => {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(".tm-table-card .btn-mini.warning").forEach((button) => {
    const text = button.textContent?.trim();
    if (text === "T.Toán" || text === "Thanh toán") {
      button.textContent = "Thu tiền";
      button.setAttribute("aria-label", "Thu tiền bàn đang phục vụ");
      button.setAttribute("title", "Thu tiền");
    }
  });
};

const tuneFloorNames = (root) => {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(".tm-floor-item .name, .talite-info .v, .fp-layout option").forEach((element) => {
    const text = element.textContent?.trim();
    const replacement = FLOOR_TEXT_REPLACEMENTS.get(text);
    if (replacement) element.textContent = replacement;
  });
};

const tuneLayoutState = (root) => {
  const container = root?.matches?.(".tm-container") ? root : root?.querySelector?.(".tm-container");
  if (!container) return;
  const gridArea = container.querySelector(".tm-grid-area");
  const tableGrid = container.querySelector(".tm-table-grid");
  if (gridArea) gridArea.dataset.tableWorkflowMounted = "true";
  if (tableGrid) tableGrid.dataset.tableWorkflowMounted = "true";
};

const getGroupTitle = (group) =>
  group?.querySelector?.(".talite-group-header .talite-label, .talite-label")?.textContent?.trim() || "";

const titleMatches = (title, matchers = []) =>
  matchers.some((matcher) => title.toLowerCase().includes(String(matcher).toLowerCase()));

const findNavTarget = (modal, item) => {
  if (item.selector) return modal.querySelector(item.selector);
  const groups = Array.from(modal.querySelectorAll(".talite-body > .talite-group"));
  return groups.find((group) => titleMatches(getGroupTitle(group), item.match));
};

const markModalSections = (modal) => {
  const groups = Array.from(modal.querySelectorAll(".talite-body > .talite-group"));
  groups.forEach((group, index) => {
    const title = getGroupTitle(group);
    group.dataset.sectionIndex = String(index + 1).padStart(2, "0");
    SECTION_KIND_RULES.forEach(({ className, match }) => {
      if (titleMatches(title, match)) group.classList.add(className);
    });
  });
};

const scrollModalBodyTo = (modal, target) => {
  const body = modal.querySelector(".talite-body");
  if (!body || !target) return;
  const bodyRect = body.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextTop = body.scrollTop + targetRect.top - bodyRect.top - 8;
  body.scrollTo({ top: Math.max(nextTop, 0), behavior: "smooth" });
};

const updateActiveNavigatorItem = (modal) => {
  const nav = modal.querySelector(".talite-section-nav");
  const body = modal.querySelector(".talite-body");
  if (!nav || !body) return;

  let activeKey = "overview";
  MODAL_SECTION_NAV.forEach((item) => {
    const target = findNavTarget(modal, item);
    if (!target) return;
    const threshold = target.offsetTop - 20;
    if (body.scrollTop >= threshold) activeKey = item.key;
  });

  nav.querySelectorAll("button[data-section-key]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionKey === activeKey);
  });
};

const ensureModalNavigator = (modal) => {
  if (!modal || modal.dataset.observationNavReady === "true") return;
  const header = modal.querySelector(".talite-header");
  const body = modal.querySelector(".talite-body");
  if (!header || !body) return;

  const nav = document.createElement("div");
  nav.className = "talite-section-nav";
  nav.setAttribute("aria-label", "Điều hướng nhanh trong modal cấu hình bàn");

  MODAL_SECTION_NAV.forEach((item) => {
    const target = findNavTarget(modal, item);
    if (!target) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sectionKey = item.key;
    button.textContent = item.label;
    button.addEventListener("click", () => {
      scrollModalBodyTo(modal, target);
      window.requestAnimationFrame(() => updateActiveNavigatorItem(modal));
    });
    nav.appendChild(button);
  });

  if (nav.childElementCount > 1) {
    header.insertAdjacentElement("afterend", nav);
  }

  const scrollHandler = () => updateActiveNavigatorItem(modal);
  body.addEventListener("scroll", scrollHandler, { passive: true });
  modal.__taliteNavScrollHandler = scrollHandler;
  modal.dataset.observationNavReady = "true";
  window.requestAnimationFrame(() => updateActiveNavigatorItem(modal));
};

const ensureModalFooterState = (modal) => {
  const footer = modal?.querySelector?.(".talite-footer");
  const actions = footer?.querySelector?.(".actions");
  if (!footer || footer.querySelector(".talite-save-state")) return;
  const state = document.createElement("div");
  state.className = "talite-save-state";
  state.innerHTML = '<span></span><strong>Sẵn sàng cập nhật</strong><em>Bấm Lưu thay đổi để áp dụng cấu hình bàn.</em>';
  footer.insertBefore(state, actions || null);
};

const enhanceTableModalObservation = (root) => {
  if (!root?.querySelectorAll) return;
  const modals = root.matches?.(".talite-modal")
    ? [root]
    : Array.from(root.querySelectorAll(".talite-modal"));
  modals.forEach((modal) => {
    markModalSections(modal);
    ensureModalNavigator(modal);
    ensureModalFooterState(modal);
  });
};

const tuneRoot = (root = document.body) => {
  tuneText(root);
  tuneButtons(root);
  tuneFloorNames(root);
  tuneLayoutState(root);
  enhanceTableModalObservation(root);
};

export const installTableWorkflowRuntimeTuning = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__tableWorkflowRuntimeTuningInstalled) return;
  window.__tableWorkflowRuntimeTuningInstalled = true;

  const run = () => tuneRoot(document.body);
  run();

  const observer = new MutationObserver((mutations) => {
    let shouldRun = false;
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        shouldRun = true;
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (
          node.matches?.(".tm-container, .talite-modal, .tm-modal--vr, .table-3d-modal, .fp-layout") ||
          node.querySelector?.(".tm-container, .talite-modal, .tm-modal--vr, .table-3d-modal, .fp-layout")
        ) {
          shouldRun = true;
        }
      });
    });
    if (shouldRun) window.requestAnimationFrame(run);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
};
