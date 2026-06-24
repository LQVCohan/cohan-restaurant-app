const WORKFLOW_TEXT_REPLACEMENTS = new Map([
  ["T.Toán", "Thu tiền"],
  ["Thanh toán", "Thu tiền"],
  ["Tags (phân tách dấu phẩy)", "Nhãn bàn"],
  ["Khu vực (zone)", "Khu vực"],
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

const tuneRoot = (root = document.body) => {
  tuneText(root);
  tuneButtons(root);
  tuneFloorNames(root);
  tuneLayoutState(root);
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
