const SECTION_LABELS = {
  restaurantProfile: "Thông tin chung của nhà hàng",
  systemSettings: "Cài đặt vận hành",
  printSettings: "Cài đặt in ấn",
  customerRankSettings: "Hạng khách hàng",
  payrollSettings: "Cài đặt lương",
  schedulingPolicy: "Quy tắc xếp ca",
  floorTableLayout: "Sơ đồ tầng và bàn",
  menuCatalog: "Thực đơn, giá và công thức",
  inventoryMaster: "Danh mục kho",
  promotionConfig: "Khuyến mãi và mã giảm giá",
  aiChatbotConfig: "Cài đặt trợ lý AI",
};

const TEXT_REPLACEMENTS = new Map([
  ["Xung đột dữ liệu", "Dữ liệu cần xác nhận"],
  ["Chọn cách xử lý", "Chọn thông tin muốn giữ"],
  [
    "Mỗi lựa chọn sẽ được gửi lại cùng thao tác khôi phục và ghi vào audit log.",
    "Một số thông tin trong file khác với dữ liệu đang dùng. Hãy chọn phương án phù hợp; hệ thống sẽ lưu lại lịch sử thay đổi.",
  ],
  ["Tổng mục", "Tổng thông tin"],
  ["Cần xử lý", "Cần chọn"],
  ["Nên kiểm tra", "Nên xem lại"],
  ["Giữ hiện tại", "Giữ dữ liệu hiện tại"],
  ["Dùng file", "Dùng dữ liệu trong file"],
  ["Gộp", "Kết hợp"],
  ["Tất cả mức độ", "Tất cả mức cần xem"],
  ["Tất cả cách xử lý", "Tất cả lựa chọn"],
  ["Dùng đề xuất", "Dùng lựa chọn được đề xuất"],
  ["Giữ bản hiện tại", "Giữ dữ liệu hiện tại"],
  ["Dùng bản trong file", "Dùng dữ liệu trong file"],
  ["Gộp mục an toàn", "Kết hợp các mục an toàn"],
  ["Gộp nếu an toàn", "Kết hợp khi không xung đột"],
  ["Tạo thêm bản mới", "Giữ cả hai bản"],
  ["Đổi tên rồi thêm mới", "Thêm bản mới với tên khác"],
  ["Bỏ qua mục này", "Không thay đổi mục này"],
  ["Thay cả hạng mục", "Thay toàn bộ hạng mục"],
  ["Xem khác biệt", "So sánh dữ liệu"],
  [
    "Tôi đã xem đúng nhà hàng đích, hạng mục và cách xử lý; đồng ý áp dụng thay đổi.",
    "Tôi đã kiểm tra đúng nhà hàng, các thông tin thay đổi và lựa chọn xử lý; tôi đồng ý tiếp tục.",
  ],
]);

const STATUS_VALUE_LABELS = {
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
  enabled: "Đang bật",
  disabled: "Đang tắt",
  available: "Đang bán",
  unavailable: "Tạm dừng",
  hidden: "Đang ẩn",
  published: "Đã công khai",
  draft: "Bản nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  true: "Có",
  false: "Không",
};

const CHOICE_HELP = {
  keep_target: "Không thay đổi dữ liệu nhà hàng đang sử dụng.",
  use_source: "Thay dữ liệu hiện tại bằng dữ liệu trong file sao lưu.",
  merge: "Kết hợp hai nguồn dữ liệu khi hệ thống xác định là an toàn.",
  create_copy: "Giữ dữ liệu hiện tại và tạo thêm một bản mới.",
  rename_source: "Thêm dữ liệu từ file dưới một tên mới để tránh trùng.",
  skip: "Bỏ qua thông tin này và không thực hiện thay đổi.",
  replace_section: "Thay toàn bộ hạng mục bằng dữ liệu trong file sao lưu.",
};

const replaceExactText = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const value = node.nodeValue?.trim();
    const replacement = TEXT_REPLACEMENTS.get(value);
    if (!replacement || replacement === value) return;
    node.nodeValue = node.nodeValue.replace(value, replacement);
  });
};

const friendlyReason = (reason = "") => {
  const text = String(reason).trim();
  if (!text) return "Thông tin này cần được xác nhận trước khi tiếp tục.";
  if (/singleton configuration differs from target/i.test(text)) {
    return "Thông tin trong file khác với thông tin nhà hàng hiện tại. Hãy chọn dữ liệu bạn muốn giữ.";
  }
  if (/same key already exists/i.test(text)) {
    return "Thông tin này đã có trong nhà hàng hiện tại. Hãy chọn giữ bản đang dùng hoặc dùng bản trong file.";
  }
  if (/not imported|could not be remapped/i.test(text)) {
    return "Một số dữ liệu liên quan chưa có trong file nên hệ thống chưa thể tự kết nối.";
  }
  if (/missing/i.test(text)) {
    return "Thiếu dữ liệu liên quan. Hãy kiểm tra trước khi áp dụng.";
  }
  if (/differs from target|different from target/i.test(text)) {
    return "Dữ liệu trong file khác với dữ liệu nhà hàng đang dùng.";
  }
  if (/^[\x00-\x7F]+$/.test(text) && /[a-z]{4,}/i.test(text)) {
    return "Dữ liệu trong file và dữ liệu hiện tại chưa giống nhau. Hãy xem phần so sánh bên dưới.";
  }
  return text;
};

const friendlyValue = (value, fieldLabel = "") => {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return "Chưa có";

  const mapped = STATUS_VALUE_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;

  if (/giá|price/i.test(fieldLabel) && /^-?\d+(?:\.\d+)?$/.test(raw)) {
    return `${Number(raw).toLocaleString("vi-VN")} đ`;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("vi-VN");
  }

  return raw;
};

const updateConflictTitle = (card) => {
  const title = card.querySelector("header strong");
  if (!title) return;

  const parts = title.textContent.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return;

  const technicalPart = parts[parts.length - 1];
  if (SECTION_LABELS[technicalPart]) {
    if (title.textContent !== SECTION_LABELS[technicalPart]) {
      title.textContent = SECTION_LABELS[technicalPart];
    }
    return;
  }

  if (/^[a-z][A-Za-z0-9_.:-]+$/.test(technicalPart)) {
    const next = parts.slice(0, -1).join(" · ");
    if (title.textContent !== next) title.textContent = next;
  }
};

const updateReason = (card) => {
  const reason = Array.from(card.children).find((child) => child.tagName === "P");
  if (!reason) return;
  const next = friendlyReason(reason.textContent);
  if (reason.textContent !== next) reason.textContent = next;
  if (!reason.classList.contains("backup-conflict-friendly-reason")) {
    reason.classList.add("backup-conflict-friendly-reason");
  }
};

const updateChoice = (card) => {
  const select = card.querySelector("label select");
  if (!select) return;

  const label = select.closest("label");
  if (
    label?.firstChild?.nodeType === Node.TEXT_NODE &&
    label.firstChild.nodeValue.trim() !== "Bạn muốn dùng dữ liệu nào?"
  ) {
    label.firstChild.nodeValue = "Bạn muốn dùng dữ liệu nào? ";
  }

  Array.from(select.options).forEach((option) => {
    const replacement = TEXT_REPLACEMENTS.get(option.textContent.trim());
    if (replacement && option.textContent !== replacement) option.textContent = replacement;
  });

  let helper = label?.querySelector(".backup-conflict-choice-help");
  if (!helper && label) {
    helper = document.createElement("small");
    helper.className = "backup-conflict-choice-help";
    label.appendChild(helper);
  }

  const refreshHelper = () => {
    const next = CHOICE_HELP[select.value] || "Chọn phương án phù hợp với dữ liệu bạn muốn giữ.";
    if (helper && helper.textContent !== next) helper.textContent = next;
  };
  refreshHelper();

  if (!select.dataset.friendlyChoiceBound) {
    select.dataset.friendlyChoiceBound = "true";
    select.addEventListener("change", refreshHelper);
  }
};

const updateDiffs = (card) => {
  const details = card.querySelector("details");
  if (!details) return;
  const summary = details.querySelector("summary");
  if (summary?.textContent.trim() === "Xem khác biệt") summary.textContent = "So sánh dữ liệu";

  details.querySelectorAll("li").forEach((item) => {
    if (item.dataset.friendlyDiff === "true") return;
    const match = item.textContent.match(/^(.+?):\s*file=(.*?)\s*\/\s*hiện tại=(.*)$/i);
    if (!match) return;

    const [, field, sourceValue, targetValue] = match;
    item.dataset.friendlyDiff = "true";
    item.classList.add("backup-conflict-diff");
    item.replaceChildren();

    const fieldName = document.createElement("strong");
    fieldName.className = "backup-conflict-diff__field";
    fieldName.textContent = field.trim();

    const makeValue = (labelText, value) => {
      const wrapper = document.createElement("span");
      wrapper.className = "backup-conflict-diff__value";
      const label = document.createElement("small");
      label.textContent = labelText;
      const content = document.createElement("span");
      content.textContent = friendlyValue(value, field);
      wrapper.append(label, content);
      return wrapper;
    };

    item.append(
      fieldName,
      makeValue("Trong file sao lưu", sourceValue),
      makeValue("Đang sử dụng", targetValue),
    );
  });
};

const updateFilters = (root) => {
  root.querySelectorAll('input[placeholder="Tìm theo tên hoặc mã"]').forEach((input) => {
    if (input.placeholder !== "Tìm theo tên thông tin") {
      input.placeholder = "Tìm theo tên thông tin";
    }
  });
};

const enhanceBackupConflicts = () => {
  const section = document.querySelector(".backup-management__conflicts");
  if (!section) return;

  if (!section.classList.contains("backup-management__conflicts--friendly")) {
    section.classList.add("backup-management__conflicts--friendly");
  }
  replaceExactText(section);
  updateFilters(section);

  section.querySelectorAll(".backup-management__conflict-list > article").forEach((card) => {
    if (!card.classList.contains("backup-conflict-friendly-card")) {
      card.classList.add("backup-conflict-friendly-card");
    }
    updateConflictTitle(card);
    updateReason(card);
    updateChoice(card);
    updateDiffs(card);
  });

  const confirmation = document.querySelector(".backup-management__confirm span");
  if (confirmation) {
    const replacement = TEXT_REPLACEMENTS.get(confirmation.textContent.trim());
    if (replacement && confirmation.textContent !== replacement) {
      confirmation.textContent = replacement;
    }
  }
};

export const installBackupConflictFriendlyLabels = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__cohanBackupConflictFriendlyLabelsInstalled) return;
  window.__cohanBackupConflictFriendlyLabelsInstalled = true;

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      enhanceBackupConflicts();
    });
  };

  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
};
