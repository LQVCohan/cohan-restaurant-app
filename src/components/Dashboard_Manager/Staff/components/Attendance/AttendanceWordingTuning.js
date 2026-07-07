const STYLE_ID = "cohan-attendance-wording-tuning";
const OBSERVER_KEY = "__cohanAttendanceWordingObserver";
const MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;

// Long, context-specific phrases come first; generic English terms are last.
const TEXT_REPLACEMENTS = [
  [
    "Theo dõi công thực tế, xử lý chỉnh công có kiểm soát và đối chiếu trước kỳ lương.",
    "Theo dõi giờ làm thực tế, xử lý điều chỉnh và kiểm tra dữ liệu trước khi tính lương.",
  ],
  [
    "Dùng cho thao tác tại quầy quản lý ca. Trường hợp sai giờ, quên thẻ hoặc máy lỗi thì tạo yêu cầu chỉnh công để duyệt sau.",
    "Ghi nhận giờ vào ca hoặc tan ca tại quầy quản lý. Nếu giờ công chưa đúng, hãy tạo yêu cầu điều chỉnh để duyệt.",
  ],
  [
    "So sánh ca dự kiến với giờ vào/ra thực tế trong ngày đã chọn.",
    "So sánh ca đã xếp với giờ vào và giờ ra thực tế trong ngày.",
  ],
  [
    "Yêu cầu này cần được duyệt trước khi ảnh hưởng đến dữ liệu công.",
    "Yêu cầu phải được duyệt trước khi cập nhật bảng công.",
  ],
  [
    "Kiểm tra lại giờ vào/ra trước khi gửi yêu cầu chỉnh công.",
    "Kiểm tra giờ vào và giờ ra trước khi gửi yêu cầu.",
  ],
  [
    "Sau khi duyệt, yêu cầu có thể ảnh hưởng đến dữ liệu công thực tế.",
    "Sau khi duyệt, hệ thống sẽ cập nhật dữ liệu chấm công.",
  ],
  [
    "Yêu cầu sẽ không được áp dụng. Vui lòng nhập lý do từ chối rõ ràng.",
    "Yêu cầu sẽ không được áp dụng. Hãy nêu rõ lý do từ chối.",
  ],
  [
    "Yêu cầu này sẽ bị hủy và không còn khả dụng để duyệt.",
    "Yêu cầu sẽ bị hủy và không thể tiếp tục duyệt.",
  ],
  [
    "Chưa tìm thấy bản ghi chấm công khớp nhân viên này trong ngày đã chọn.",
    "Chưa có bản ghi chấm công phù hợp trong ngày đã chọn.",
  ],
  [
    "Có thể nhân viên chưa check-in hoặc bộ lọc nhà hàng/ngày chưa đúng.",
    "Kiểm tra lại ngày, nhân viên hoặc nhà hàng trước khi tạo chỉnh công.",
  ],
  [
    "Có nhiều bản ghi khớp. Hãy chọn dòng cụ thể trong bảng công.",
    "Có nhiều dòng phù hợp. Hãy chọn đúng dòng trong bảng chấm công.",
  ],
  [
    "Có nhiều bản ghi khớp, chọn dòng bên dưới để tạo chỉnh công.",
    "Có nhiều dòng phù hợp. Hãy chọn đúng dòng để tạo chỉnh công.",
  ],
  [
    "Đang hiển thị ngữ cảnh chung theo ngày/nhà hàng từ lịch làm việc.",
    "Đang lọc theo ngày hoặc nhà hàng được chuyển từ lịch làm.",
  ],
  [
    "Timesheet có overtime trong ngày",
    "Số ca có phát sinh tăng ca trong ngày",
  ],
  [
    "Admin, Manager hoặc HR xử lý",
    "Quản trị viên, quản lý hoặc nhân sự xử lý",
  ],
  [
    "Dựa trên planned end và check-out thực tế",
    "Tính từ giờ kết thúc ca đến giờ ra thực tế",
  ],
  [
    "Payroll chỉ dùng số phút đã duyệt",
    "Bảng lương chỉ tính thời gian đã duyệt",
  ],
  [
    "Bản ghi tăng ca này đã được review trước đó. Vui lòng tải lại danh sách.",
    "Bản ghi tăng ca đã được xử lý. Vui lòng tải lại danh sách.",
  ],
  [
    "Số phút duyệt không được vượt quá overtime thực tế.",
    "Thời gian duyệt không được vượt quá thời gian tăng ca thực tế.",
  ],
  ["Đang xử lý bất thường từ lịch làm việc", "Đang xem dữ liệu từ lịch làm"],
  ["Lọc bảng công", "Xem bảng chấm công"],
  ["Tạo yêu cầu chỉnh công", "Tạo yêu cầu chỉnh công"],
  ["Xem yêu cầu chỉnh công", "Xem yêu cầu chỉnh công"],
  ["Xoá bộ lọc từ lịch", "Bỏ lọc từ lịch"],
  ["Tổng nhân sự (ca/ngày)", "Nhân sự trong ngày"],
  ["Đang/đã đi làm", "Có mặt"],
  ["Đi muộn / Về sớm", "Đi muộn hoặc về sớm"],
  ["Chờ duyệt chỉnh công", "Yêu cầu chỉnh công"],
  ["Ghi nhận vào ca / tan ca", "Chấm công nhanh"],
  ["Chọn nhân viên đang có mặt tại ca...", "Chọn nhân viên..."],
  ["Chọn nhân viên:", "Nhân viên"],
  ["Lý do / ghi chú ca trực:", "Ghi chú ca"],
  ["Đã lưu chấm công VÀO CA thành công.", "Đã ghi nhận giờ vào ca."],
  ["Đã lưu chấm công TAN CA thành công.", "Đã ghi nhận giờ tan ca."],
  ["Lưu chấm công thất bại:", "Không thể lưu chấm công:"],
  ["Bảng công", "Bảng chấm công"],
  ["Đối chiếu lịch & công thực tế", "Đối chiếu lịch làm và chấm công"],
  ["Điểm cần rà soát nhanh", "Trường hợp cần kiểm tra"],
  ["Ca dự kiến:", "Theo lịch:"],
  ["Lọc để xem", "Xem bản ghi"],
  ["Đúng lịch", "Đúng giờ"],
  ["No-show / Vắng lịch", "Vắng ca"],
  ["Vắng lịch", "Vắng ca"],
  ["Thiếu check-out", "Quên tan ca"],
  ["Đang trong ca", "Đang làm việc"],
  ["Đang làm", "Đang làm việc"],
  ["Muộn & về sớm", "Đi muộn và về sớm"],
  ["Vào ca ngoài lịch", "Đang làm ngoài lịch"],
  ["Hoàn tất ngoài lịch", "Đã làm ngoài lịch"],
  ["Ngoài lịch", "Làm ngoài lịch"],
  ["Quên check-in", "Thiếu giờ vào"],
  ["Quên check-out", "Thiếu giờ ra"],
  ["Sai giờ check-in", "Sai giờ vào"],
  ["Sai giờ check-out", "Sai giờ ra"],
  ["Sai cả check-in/out", "Sai cả giờ vào và giờ ra"],
  ["Giờ hiện tại", "Dữ liệu hiện tại"],
  ["Giờ đề xuất", "Dữ liệu đề nghị"],
  ["Check-in hiện tại", "Giờ vào hiện tại"],
  ["Check-out hiện tại", "Giờ ra hiện tại"],
  ["Giờ thực tế đề xuất", "Giờ đề nghị"],
  ["Check-in đề xuất", "Giờ vào đề nghị"],
  ["Check-out đề xuất", "Giờ ra đề nghị"],
  ["Người review", "Người duyệt"],
  ["Review lúc", "Duyệt lúc"],
  ["Ghi chú review", "Ghi chú duyệt"],
  ["Ghi chú bằng chứng", "Ghi chú minh chứng"],
  ["Link bằng chứng, mỗi dòng một link", "Liên kết minh chứng, mỗi dòng một liên kết"],
  ["Link bằng chứng", "Liên kết minh chứng"],
  ["Lý do & bằng chứng", "Lý do và minh chứng"],
  ["Từ chối / Hủy", "Từ chối hoặc đã hủy"],
  ["Overtime thực tế", "Thời gian tăng ca"],
  ["Tăng ca phát sinh từ bảng công", "Tăng ca ghi nhận từ bảng chấm công"],
  ["Số phút được duyệt", "Thời gian được duyệt"],
  ["Số phút", "Thời lượng"],
  ["Được duyệt", "Đã duyệt"],
  ["scheduled_absent", "Vắng ca"],
  ["unscheduled_checkin", "Làm ngoài lịch"],
  ["Timesheet", "Bảng công"],
  ["timesheet", "bảng công"],
  ["Overtime", "Tăng ca"],
  ["overtime", "tăng ca"],
  ["Payroll", "Bảng lương"],
  ["payroll", "bảng lương"],
  ["Check-in", "Giờ vào"],
  ["Check-out", "Giờ ra"],
  ["check-in", "giờ vào"],
  ["check-out", "giờ ra"],
  ["review", "duyệt"],
  ["VÀO CA", "Vào ca"],
  ["TAN CA", "Tan ca"],
];

const ATTRIBUTE_REPLACEMENTS = [
  ["VD: Quên thẻ, đổi ca, máy vân tay lỗi...", "Ví dụ: quên thẻ, đổi ca, máy chấm công lỗi..."],
  ["🔍 Tìm nhân viên / lý do...", "Tìm nhân viên hoặc lý do..."],
  ["🔍 Tìm nhân viên...", "Tìm nhân viên..."],
  [
    "VD: Nhân viên quên check-out, quản lý đã xác nhận qua camera...",
    "Ví dụ: nhân viên quên tan ca, quản lý đã đối chiếu camera...",
  ],
  [
    "VD: Camera khu vực bếp, xác nhận từ trưởng ca...",
    "Ví dụ: camera khu vực bếp hoặc xác nhận của trưởng ca...",
  ],
  [
    "Ghi chú xác nhận hoặc bối cảnh review...",
    "Ghi chú xác nhận hoặc nội dung đã đối chiếu...",
  ],
];

const CSS = `
.attendance-readiness-focus-banner {
  position: relative;
  gap: 10px !important;
  padding: 14px 16px 14px 48px !important;
  border-radius: 16px !important;
  border: 1px solid rgba(15, 118, 110, 0.18) !important;
  background: linear-gradient(135deg, rgba(240, 253, 250, 0.95), rgba(255, 250, 240, 0.96)) !important;
  color: #1f3f3a !important;
  box-shadow: 0 12px 28px rgba(84, 55, 30, 0.07) !important;
}
.attendance-readiness-focus-banner::before {
  content: "↳";
  position: absolute;
  left: 16px;
  top: 14px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #dff4ee;
  border: 1px solid rgba(15, 118, 110, 0.18);
  color: #0f766e;
  font-size: 15px;
  font-weight: 900;
}
.attendance-readiness-focus-banner strong {
  color: #173d37 !important;
  font-size: 0.92rem !important;
  font-weight: 850 !important;
  letter-spacing: -0.01em;
}
.attendance-readiness-focus-banner .focus-summary-copy {
  margin: -2px 0 0;
  color: #55706b;
  font-size: 0.83rem;
  line-height: 1.45;
  max-width: 880px;
}
.attendance-readiness-focus-banner .focus-meta-grid {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 7px !important;
}
.attendance-readiness-focus-banner .focus-meta-grid:empty {
  display: none !important;
}
.attendance-readiness-focus-banner .focus-meta-grid span {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(15, 118, 110, 0.14);
  color: #36544f;
  font-size: 0.78rem;
  font-weight: 750;
}
.attendance-readiness-focus-banner .focus-hint {
  color: #5c6f69 !important;
  font-size: 0.82rem !important;
  line-height: 1.42;
}
.attendance-readiness-focus-banner .focus-actions {
  gap: 8px !important;
  margin-top: 2px;
}
.attendance-readiness-focus-banner .focus-actions .staff-secondary-btn {
  min-height: 34px;
  border-radius: 999px !important;
  border: 1px solid rgba(15, 118, 110, 0.18) !important;
  background: rgba(255, 255, 255, 0.86) !important;
  color: #23524b !important;
  font-size: 0.8rem !important;
  font-weight: 800 !important;
  padding: 7px 12px !important;
  box-shadow: none !important;
}
.attendance-management-page .page-subtitle,
.attendance-management-page .quick-header .text p,
.attendance-management-page .inline-state,
.attendance-management-page .empty-state,
.attendance-management-page .small-muted {
  word-break: normal;
}
`;

const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

const applyReplacements = (value, replacements = TEXT_REPLACEMENTS) =>
  replacements.reduce((result, [current, next]) => {
    if (!result.includes(current)) return result;
    return result.split(current).join(next);
  }, String(value ?? ""));

const toDisplayDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const isTechnicalId = (value) => MONGO_ID_PATTERN.test(String(value || "").trim());

const setText = (element, value) => {
  if (element && element.textContent !== value) element.textContent = value;
};

const injectStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
};

const patchTextNodes = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const next = applyReplacements(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  });
};

const patchAttributes = (root) => {
  root
    .querySelectorAll("[placeholder], [title], [aria-label]")
    .forEach((element) => {
      ["placeholder", "title", "aria-label"].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const current = element.getAttribute(attribute) || "";
        const next = applyReplacements(
          applyReplacements(current, ATTRIBUTE_REPLACEMENTS),
        );
        if (current !== next) element.setAttribute(attribute, next);
      });
    });
};

const patchFocusMeta = (banner) => {
  const metaGrid = banner.querySelector(".focus-meta-grid");
  if (!metaGrid) return;

  metaGrid.querySelectorAll("span").forEach((item) => {
    const text = normalize(item.textContent);

    if (text.startsWith("Ngày:")) {
      const value = text.replace("Ngày:", "").trim();
      setText(item, `Ngày công: ${toDisplayDate(value)}`);
      return;
    }

    if (text.startsWith("Nhân viên:")) {
      const value = text.replace("Nhân viên:", "").trim();
      if (!value || value === "--" || isTechnicalId(value)) {
        item.remove();
      }
      return;
    }

    if (text.startsWith("Nhà hàng:")) {
      const value = text.replace("Nhà hàng:", "").trim();
      if (!value || isTechnicalId(value)) {
        setText(item, "Nhà hàng: Theo chi nhánh đang chọn");
      }
      return;
    }

    if (text.startsWith("Số bản ghi khớp:")) {
      setText(item, text.replace("Số bản ghi khớp:", "Bản ghi tìm thấy:"));
    }
  });
};

const patchFocusHints = (banner) => {
  const seen = new Set();
  banner.querySelectorAll(".focus-hint").forEach((hint) => {
    const text = normalize(hint.textContent);
    if (seen.has(text)) {
      hint.remove();
    } else {
      seen.add(text);
    }
  });
};

const patchFocusBanner = (root) => {
  root.querySelectorAll(".attendance-readiness-focus-banner").forEach((banner) => {
    const title = banner.querySelector("strong");
    setText(title, "Đang xem dữ liệu từ lịch làm");

    if (!banner.querySelector(".focus-summary-copy")) {
      const summary = document.createElement("p");
      summary.className = "focus-summary-copy";
      summary.textContent =
        "Hệ thống đã lọc theo ngày, nhân viên hoặc nhà hàng để bạn kiểm tra ca cần xử lý.";
      title?.insertAdjacentElement("afterend", summary);
    }

    patchFocusMeta(banner);
    patchFocusHints(banner);
  });
};

const patchAttendancePage = () => {
  const root = document.querySelector(".attendance-management-page");
  if (!root) return;

  patchTextNodes(root);
  patchAttributes(root);
  patchFocusBanner(root);
};

const schedulePatch = () => {
  const run = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
  run(patchAttendancePage);
};

export const installAttendanceWordingTuning = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  injectStyle();
  patchAttendancePage();

  if (window[OBSERVER_KEY]) return;
  const observer = new MutationObserver(schedulePatch);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window[OBSERVER_KEY] = observer;
};
