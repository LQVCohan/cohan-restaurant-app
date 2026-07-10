const textReplacements = [
  [/Ca thiếu người/g, "Ca cần bổ sung"],
  [/Xung đột và ca cần bổ sung/g, "Cần xử lý trước khi công bố"],
  [/(\d+) lượt xếp ca/g, "$1 phân công"],
  [/Availability tuần mục tiêu/g, "Lịch rảnh tuần tới"],
  [/Lịch rảnh đã chốt/g, "Lịch rảnh"],
  [/In lịch tuần/g, "In lịch"],
  [/Tự động xếp ca/g, "Chia ca tự động"],
  [/Đăng ký lịch nhân viên/g, "Đăng ký lịch rảnh"],
  [/Đã gửi:/g, "Đăng ký:"],
  [/Chờ duyệt:/g, "chờ duyệt:"],
  [/Mở rộng/g, "Chi tiết"],
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

const hideDuplicateHeaderAutoAction = (root) => {
  const headerButtons = Array.from(
    root.querySelectorAll(".schedule-header .header-actions button"),
  );
  headerButtons.forEach((button) => {
    const label = getText(button);
    if (label.includes("Chia ca tự động") || label.includes("Tự động xếp ca")) {
      button.classList.add("schedule-header-auto-action-duplicate");
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    }
  });
};

const normalizeToolbarCopy = (root) => {
  const navButtons = Array.from(
    root.querySelectorAll(".schedule-toolbar .date-navigation .nav-btn"),
  );

  navButtons.forEach((button) => {
    const buttonText = getText(button);
    if (buttonText.includes("Tuần trước")) {
      button.setAttribute("aria-label", "Xem tuần trước");
    }
    if (buttonText.includes("Tuần sau")) {
      button.setAttribute("aria-label", "Xem tuần sau");
    }

    Array.from(button.childNodes).forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const text = String(node.nodeValue || "");
      if (text.includes("Tuần trước")) {
        node.nodeValue = text.replace("Tuần trước", "Trước");
      }
      if (text.includes("Tuần sau")) {
        node.nodeValue = text.replace("Tuần sau", "Sau");
      }
    });
  });

  const settingsRole = root.querySelector(
    ".schedule-settings-trigger .user-info .role",
  );
  if (settingsRole && getText(settingsRole) !== "Cài đặt ca") {
    settingsRole.textContent = "Cài đặt ca";
  }
};

const markToolbarActions = (root) => {
  const actionButtons = Array.from(
    root.querySelectorAll(".schedule-toolbar .toolbar-group--actions button"),
  );
  actionButtons.forEach((button) => {
    const label = getText(button);
    if (label.includes("Lịch rảnh") || label.includes("In lịch")) {
      const shortLabel = label.includes("Lịch rảnh") ? "Lịch rảnh" : "In lịch";
      button.classList.add("schedule-toolbar-utility-action");
      button.dataset.shortLabel = shortLabel;
      button.setAttribute(
        "title",
        shortLabel === "Lịch rảnh" ? "Lịch rảnh nhân viên" : "In lịch tuần",
      );
      if (!button.getAttribute("aria-label")) {
        button.setAttribute(
          "aria-label",
          shortLabel === "Lịch rảnh"
            ? "Xem lịch rảnh nhân viên"
            : "In lịch tuần",
        );
      }
      return;
    }

    if (label.includes("Chia ca tự động")) {
      button.classList.add("schedule-toolbar-assist-action");
    }
  });
};

const markBoardEmptyState = (root) => {
  const board = root.querySelector(".schedule-board:not(.month-board)");
  if (!board) return;

  const guidance = board.querySelector(".schedule-empty-guidance");
  const shiftCards = Array.from(
    board.querySelectorAll(".shift-card, .schedule-shift-card"),
  );

  if (shiftCards.length > 0) {
    const understaffedCount = shiftCards.filter((card) =>
      card.classList.contains("critical"),
    ).length;

    if (understaffedCount <= 0) {
      guidance?.remove();
      return;
    }

    const nextGuidance = guidance || document.createElement("div");
    const message = `Tuần này đã có ${shiftCards.length} ca, trong đó ${understaffedCount} ca còn thiếu nhân sự. Mở từng ca để bổ sung.`;
    nextGuidance.className =
      "schedule-empty-guidance schedule-understaffed-guidance";
    nextGuidance.setAttribute("role", "status");
    if (nextGuidance.textContent !== message) nextGuidance.textContent = message;
    if (!guidance) board.prepend(nextGuidance);
    return;
  }

  const nextGuidance = guidance || document.createElement("div");
  const message =
    "Tuần này chưa có ca. Hãy tạo ca thủ công hoặc dùng chia ca tự động.";
  nextGuidance.className = "schedule-empty-guidance";
  nextGuidance.setAttribute("role", "status");
  if (nextGuidance.textContent !== message) nextGuidance.textContent = message;
  if (!guidance) board.prepend(nextGuidance);
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
      hideDuplicateHeaderAutoAction(root);
      normalizeToolbarCopy(root);
      markToolbarActions(root);
      markBoardEmptyState(root);
    });
  };

  const observe = () => {
    const root = findScheduleRoot();
    if (!root || observer) return false;
    observer = new MutationObserver(run);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
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
