const REPLACEMENTS = new Map([
  ["Tags (phân tách dấu phẩy)", "Nhãn bàn"],
  ["Khu vực (zone)", "Khu vực"],
  ["Source:", "Nguồn:"],
  ["License:", "Bản quyền:"],
  ["Model URL:", "Liên kết model:"],
  ["Placement:", "Vị trí 3D:"],
  ["Đổi chỗ với bàn khác (swap code)", "Đổi vị trí với bàn khác"],
  ["Mã bàn muốn đổi", "Bàn muốn đổi vị trí"],
  ["Promotion sắp hết hạn", "Khuyến mãi sắp hết hạn"],
  ["Promotion gần hết lượt", "Khuyến mãi gần hết lượt"],
  ["Promotion nhập", "Khuyến mãi nhập tay"],
  ["Promotion giảm sâu", "Khuyến mãi giảm sâu"],
  ["Promotion sắp hết hạn", "Khuyến mãi sắp hết hạn"],
  ["Mẫu bàn 3D upload tùy chỉnh", "Mẫu bàn 3D tùy chỉnh"],
  ["Floor Plan Designer", "Thiết kế sơ đồ bàn"],
  ["Bộ công cụ", "Công cụ thiết kế"],
  ["Lối staff", "Lối nhân viên"],
]);

const INPUT_PLACEHOLDERS = new Map([
  ["VIP, sân vườn…", "VD: gần cửa sổ, riêng tư..."],
  ["VD: Sảnh chính, Sân vườn", "VD: Sảnh chính, sân vườn..."],
]);

const isWorkflowNode = (node) => {
  if (!node?.closest) return false;
  return Boolean(
    node.closest(".talite-modal") ||
    node.closest(".table-3d-modal") ||
    node.closest(".fp-layout") ||
    node.closest(".tm-modal--vr")
  );
};

const tuneTextNode = (textNode) => {
  const current = textNode.nodeValue;
  if (!current || !current.trim()) return;
  const trimmed = current.trim();
  const next = REPLACEMENTS.get(trimmed);
  if (!next || next === trimmed) return;
  textNode.nodeValue = current.replace(trimmed, next);
};

const walkText = (root) => {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  if (!isWorkflowNode(root)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    tuneTextNode(node);
    node = walker.nextNode();
  }
};

const tuneAttributes = (root) => {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll("input, textarea").forEach((el) => {
    const placeholder = el.getAttribute("placeholder");
    const next = INPUT_PLACEHOLDERS.get(placeholder);
    if (next) el.setAttribute("placeholder", next);
  });
};

const tuneElement = (root) => {
  walkText(root);
  tuneAttributes(root);
};

export const installTableWorkflowCopyTuning = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__tableWorkflowCopyTuningInstalled) return;
  window.__tableWorkflowCopyTuningInstalled = true;

  const run = () => {
    document
      .querySelectorAll(".talite-modal, .table-3d-modal, .fp-layout, .tm-modal--vr")
      .forEach(tuneElement);
  };

  run();
  const observer = new MutationObserver((mutations) => {
    let shouldRun = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (
          node.matches?.(".talite-modal, .table-3d-modal, .fp-layout, .tm-modal--vr") ||
          node.querySelector?.(".talite-modal, .table-3d-modal, .fp-layout, .tm-modal--vr")
        ) {
          shouldRun = true;
        }
      });
    });
    if (shouldRun) window.requestAnimationFrame(run);
  });

  observer.observe(document.body, { childList: true, subtree: true });
};
