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

const FIELD_GUIDES = new Map([
  ["Mã bàn", "Mã hiển thị trên sơ đồ và danh sách bàn. Nên ngắn, dễ gọi như A1 hoặc V201."],
  ["Sức chứa", "Số khách tối đa bàn này phục vụ thoải mái. Dùng để gợi ý ghép bàn và đặt bàn."],
  ["Loại", "Phân loại vị trí bàn như trong nhà, VIP hoặc ngoài trời để khách chọn đúng nhu cầu."],
  ["Nhãn bàn", "Thêm vài nhãn ngắn để mô tả bàn, ví dụ gần cửa sổ, riêng tư hoặc view đẹp."],
  ["Khu vực", "Tên khu phục vụ của bàn, ví dụ Sảnh chính, sân vườn, tầng lửng."],
  ["Vị trí X", "Tọa độ ngang của bàn trên sơ đồ. Chỉ chỉnh khi cần căn lại vị trí thủ công."],
  ["Vị trí Y", "Tọa độ dọc của bàn trên sơ đồ. Chỉ chỉnh khi cần căn lại vị trí thủ công."],
  ["Link VR bàn", "Đường dẫn ảnh 360 hoặc trang VR riêng của bàn để khách xem trước không gian."],
  ["Tầng đích", "Chọn tầng mới khi muốn chuyển bàn sang khu vực khác. Hệ thống sẽ cố gắng giữ bố cục hợp lý."],
  ["Bàn muốn đổi vị trí", "Nhập mã bàn cùng tầng để hoán đổi vị trí hoặc mã hiển thị."],
  ["Gộp với các bàn", "Nhập các mã bàn cần ghép, cách nhau bằng dấu phẩy hoặc khoảng trắng."],
  ["Giá đặt cọc (VND)", "Số tiền khách cần đặt trước khi giữ bàn. Để trống nếu không yêu cầu cọc."],
  ["Ưu đãi từ Promotion", "Chọn các khuyến mãi sẽ hiện khi khách đặt bàn này."],
  ["Tiện ích / ưu đãi nhanh (nhập tay)", "Thêm ưu đãi riêng cho bàn mà chưa cần tạo promotion mới."],
  ["Giữ bàn (phút)", "Khoảng thời gian nhà hàng giữ bàn sau giờ đặt. Quá thời gian này có thể giải phóng bàn."],
  ["Chi tiêu tối thiểu", "Mức chi tiêu tối thiểu áp dụng cho bàn đặc biệt, phòng riêng hoặc giờ cao điểm."],
  ["Chính sách huỷ", "Quy định hủy/hoàn cọc để nhân viên và khách hiểu rõ trước khi đặt bàn."],
]);

const SECTION_GUIDES = new Map([
  ["Thông tin cơ bản", "Thiết lập dữ liệu nền của bàn: mã, sức chứa, khu vực, tọa độ và VR."],
  ["Trạng thái", "Cập nhật nhanh tình trạng vận hành hiện tại của bàn."],
  ["Chuyển tầng", "Di chuyển bàn sang tầng khác khi thay đổi bố cục nhà hàng."],
  ["Đổi vị trí với bàn khác", "Hoán đổi bàn cùng tầng để tối ưu sơ đồ mà không phải kéo thủ công."],
  ["Gộp / Tách", "Dùng khi phục vụ nhóm lớn hoặc tách bàn sau khi kết thúc phục vụ."],
  ["Đặt cọc & Ưu đãi khi đặt bàn", "Thiết lập cọc và ưu đãi hiển thị cho khách khi đặt bàn."],
  ["Chính sách đặt bàn", "Quy định thời gian giữ bàn, mức chi tiêu tối thiểu và điều kiện hủy."],
  ["Gợi ý AI cho bàn ăn", "Tạo gợi ý nhanh để tối ưu ghép bàn, ưu đãi và thời gian quay vòng."],
  ["Cấu hình VR bàn", "Gắn link VR hoặc ảnh 360 để khách xem trước không gian bàn."],
]);

const BUTTON_GUIDES = new Map([
  ["Lưu thay đổi", "Lưu toàn bộ cấu hình hiện tại của bàn."],
  ["Đóng", "Đóng modal. Nếu có bản nháp, hệ thống có thể nhắc khôi phục ở lần sau."],
  ["Thêm", "Thêm tiện ích hoặc ưu đãi nhập tay vào bàn này."],
  ["Mở VR bàn", "Mở thử link VR/ảnh 360 đã cấu hình cho bàn."],
  ["Chuyển", "Chuyển bàn sang tầng đã chọn."],
  ["Đổi chỗ", "Đổi vị trí hoặc mã với bàn đã nhập."],
  ["Gộp bàn", "Ghép bàn này với các bàn khác để phục vụ nhóm lớn."],
  ["Tách bàn này", "Tách bàn khỏi nhóm ghép hiện tại."],
  ["Xoá bàn", "Xóa bàn khỏi hệ thống nếu không còn ràng buộc vận hành."],
  ["Đề xuất ghép bàn", "Gợi ý bàn phù hợp để ghép khi cần thêm chỗ."],
  ["Đề xuất ưu đãi", "Gợi ý ưu đãi phù hợp với bàn và khuyến mãi hiện có."],
  ["AI dự đoán bàn trống", "Ước lượng thời gian bàn có thể quay lại trạng thái trống."],
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

const setGuide = (element, guide, placement = "top") => {
  if (!element || !guide) return;
  element.classList.add("talite-help-target");
  element.dataset.guide = guide;
  element.dataset.guidePlacement = placement;
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", `${element.textContent?.trim() || "Mục này"}. ${guide}`);
  element.setAttribute("title", guide);
};

const addFieldGuides = (modal) => {
  modal.querySelectorAll(".talite-label").forEach((label) => {
    const text = label.textContent?.trim();
    const guide = FIELD_GUIDES.get(text);
    if (!guide) return;
    const target = label.closest("div") || label;
    setGuide(target, guide, "top");
    const field = target.querySelector?.("input, select, textarea");
    if (field) {
      field.setAttribute("title", guide);
      field.setAttribute("aria-describedby", field.getAttribute("aria-describedby") || "table-field-guide");
    }
  });
};

const addSectionGuides = (modal) => {
  modal.querySelectorAll(".talite-group-header").forEach((header) => {
    const title = header.querySelector(".talite-label")?.textContent?.trim();
    const guide = SECTION_GUIDES.get(title);
    if (guide) setGuide(header, guide, "bottom");
  });
  const info = modal.querySelector(".talite-info");
  setGuide(info, "Xem nhanh thông tin hiện tại của bàn trước khi chỉnh cấu hình.", "bottom");
  const vrBlock = modal.querySelector(".talite-vr-block");
  setGuide(vrBlock, SECTION_GUIDES.get("Cấu hình VR bàn"), "top");
};

const addButtonGuides = (modal) => {
  modal.querySelectorAll("button").forEach((button) => {
    const text = button.textContent?.trim();
    const guide = BUTTON_GUIDES.get(text);
    if (guide) setGuide(button, guide, "top");
  });
};

const enhanceModalGuides = (modal) => {
  if (!modal || modal.dataset.hoverGuideReady === "true") return;
  addSectionGuides(modal);
  addFieldGuides(modal);
  addButtonGuides(modal);
  modal.dataset.hoverGuideReady = "true";
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
    enhanceModalGuides(modal);
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
