const textReplacements = [
  [/Ca thiếu người/g, "Ca cần bổ sung"],
  [/Xung đột và ca cần bổ sung/g, "Cần xử lý trước khi công bố"],
  [/(\d+) lượt xếp ca/g, "$1 phân công"],
  [/Availability tuần mục tiêu/g, "Lịch rảnh tuần tới"],
];

const getText = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";

const findScheduleRoot = () =>
  document.querySelector(".manager-page-shell--schedules") ||
  document.querySelector(".schedule-container") ||
  null;

const replaceInTextNode = (node) => {
  let nextValue = node.nodeValue;
  textReplacements.forEach(([pattern, replacement]) => {
    nextValue = nextValue.replace(pattern, replacement);
  });
  if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
};

const normalizeTextLabels = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("script, style, textarea")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(replaceInTextNode);
};

const normalizeToolbarCopy = (root) => {
  const navButtons = Array.from(
    root.querySelectorAll(".schedule-toolbar .date-navigation .nav-btn"),
  );

  navButtons.forEach((button) => {
    const buttonText = getText(button);
    if (buttonText.includes("Tuần trước")) button.setAttribute("aria-label", "Xem tuần trước");
    if (buttonText.includes("Tuần sau")) button.setAttribute("aria-label", "Xem tuần sau");

    Array.from(button.childNodes).forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const text = String(node.nodeValue || "");
      if (text.includes("Tuần trước")) node.nodeValue = text.replace("Tuần trước", "Trước");
      if (text.includes("Tuần sau")) node.nodeValue = text.replace("Tuần sau", "Sau");
    });
  });

  const settingsRole = root.querySelector(".schedule-settings-trigger .user-info .role");
  if (settingsRole && getText(settingsRole) !== "Cài đặt ca") {
    settingsRole.textContent = "Cài đặt ca";
  }
};

const markToolbarActions = (root) => {
  const actionButtons = Array.from(root.querySelectorAll(".schedule-toolbar .toolbar-group--actions button"));
  actionButtons.forEach((button) => {
    const label = getText(button);
    if (label.includes("Lịch rảnh đã chốt") || label.includes("In lịch tuần")) {
      const shortLabel = label.includes("Lịch rảnh") ? "Lịch rảnh" : "In lịch";
      button.classList.add("schedule-toolbar-utility-action");
      button.dataset.shortLabel = shortLabel;
      button.setAttribute("title", label);
      if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", label);
      return;
    }

    if (label.includes("Chia ca tự động")) {
      button.classList.add("schedule-toolbar-assist-action");
    }
  });
};

const collapseAvailabilityPanelOnce = (root) => {
  if (root.dataset.adminAvailabilityInitialCollapsed === "true") return;

  const panel = root.querySelector(".schedule-availability-panel");
  if (!panel) return;

  const collapseButton = panel.querySelector(".btn-collapse-panel.icon-only");
  const isExpanded = String(collapseButton?.getAttribute("aria-label") || "").includes("Thu gọn");
  const hasBlockingError = getText(panel).includes("Không thể tải kỳ đăng ký");

  if (collapseButton && isExpanded && !hasBlockingError) {
    collapseButton.click();
  }

  root.dataset.adminAvailabilityInitialCollapsed = "true";
};

const markBoardEmptyState = (root) => {
  const board = root.querySelector(".schedule-board:not(.month-board)");
  if (!board || board.querySelector(".schedule-empty-guidance")) return;

  const hasAnyShiftCard = Boolean(board.querySelector(".shift-card, .schedule-shift-card"));
  if (hasAnyShiftCard) return;

  const guidance = document.createElement("div");
  guidance.className = "schedule-empty-guidance";
  guidance.textContent = "Tuần này chưa có ca. Hãy tạo ca thủ công hoặc dùng Chia ca tự động.";
  board.prepend(guidance);
};

let cleanupRef = null;

export const initScheduleManagerAdminPolish = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }

  cleanupRef?.();

  let disposed = false;
  let frameId = 0;
  let observer = null;
  const timers = [];

  const run = () => {
    if (disposed) return;
    window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => {
      if (disposed) return;
      const root = findScheduleRoot();
      if (!root) return;
      normalizeTextLabels(root);
      normalizeToolbarCopy(root);
      markToolbarActions(root);
      collapseAvailabilityPanelOnce(root);
      markBoardEmptyState(root);
    });
  };

  const observe = () => {
    const root = findScheduleRoot();
    if (!root || observer) return false;
    observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return true;
  };

  if (!observe()) {
    const id = window.setTimeout(() => {
      observe();
      run();
    }, 400);
    timers.push(id);
  }

  run();
  timers.push(window.setTimeout(run, 900));
  timers.push(window.setTimeout(run, 1600));

  const cleanup = () => {
    disposed = true;
    window.cancelAnimationFrame(frameId);
    timers.forEach((id) => window.clearTimeout(id));
    observer?.disconnect();
    cleanupRef = null;
  };

  cleanupRef = cleanup;
  return cleanup;
};
