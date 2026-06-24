const STYLE_ID = "cohan-attendance-wording-tuning";
const OBSERVER_KEY = "__cohanAttendanceWordingObserver";
const MONGO_ID_PATTERN = /^[a-f0-9]{24}$/i;

const WORDING_REPLACEMENTS = new Map([
  ["Đang xử lý bất thường từ lịch làm việc", "Đang xem dữ liệu chấm công từ lịch làm việc"],
  ["Lọc bảng công", "Xem bảng công"],
  ["Tạo yêu cầu chỉnh công", "Tạo chỉnh công"],
  ["Xem yêu cầu chỉnh công", "Yêu cầu đang chờ"],
  ["Xoá bộ lọc từ lịch", "Bỏ lọc từ lịch"],
  ["Tổng nhân sự (ca/ngày)", "Nhân sự trong ngày"],
  ["Đang/đã đi làm", "Có mặt"],
  ["Đi muộn / Về sớm", "Muộn / về sớm"],
  ["Chờ duyệt chỉnh công", "Chờ duyệt"],
  ["Ghi nhận vào ca / tan ca", "Chấm công nhanh"],
  ["Lý do / ghi chú ca trực:", "Ghi chú ca:"],
  ["No-show / Vắng lịch", "Vắng ca"],
  ["Thiếu check-out", "Quên tan ca"],
  ["scheduled_absent", "Vắng ca"],
  ["unscheduled_checkin", "Vào ca ngoài lịch"],
]);

const HINT_REPLACEMENTS = [
  {
    test: "Chưa tìm thấy bản ghi chấm công khớp nhân viên này trong ngày đã chọn.",
    text: "Chưa có bản ghi chấm công phù hợp trong ngày đã chọn.",
  },
  {
    test: "Có thể nhân viên chưa check-in hoặc bộ lọc nhà hàng/ngày chưa đúng.",
    text: "Kiểm tra lại ngày, nhân viên hoặc nhà hàng trước khi tạo chỉnh công.",
  },
  {
    test: "Có nhiều bản ghi khớp. Hãy chọn dòng cụ thể trong bảng công.",
    text: "Có nhiều dòng phù hợp. Hãy chọn đúng dòng trong bảng công bên dưới.",
  },
  {
    test: "Có nhiều bản ghi khớp, chọn dòng bên dưới để tạo chỉnh công.",
    text: "Có nhiều dòng phù hợp. Hãy chọn đúng dòng trong bảng công bên dưới.",
  },
  {
    test: "Chưa có bản ghi chấm công để tạo chỉnh công.",
    text: "Chưa có dữ liệu chấm công để tạo chỉnh công.",
  },
  {
    test: "Đang hiển thị ngữ cảnh chung theo ngày/nhà hàng từ lịch làm việc.",
    text: "Đang lọc theo ngày hoặc nhà hàng được chuyển từ lịch làm việc.",
  },
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
.attendance-readiness-focus-banner .focus-actions .staff-secondary-btn:hover:not(:disabled) {
  background: #e5f6f1 !important;
  border-color: rgba(15, 118, 110, 0.34) !important;
}
.attendance-readiness-focus-banner .focus-actions .staff-secondary-btn:disabled {
  opacity: 0.48 !important;
  cursor: not-allowed !important;
}
.attendance-readiness-focus-banner .focus-pending-badge {
  background: #fff7ed !important;
  border-color: #fed7aa !important;
  color: #9a5b16 !important;
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

const toDisplayDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const isTechnicalId = (value) => MONGO_ID_PATTERN.test(String(value || "").trim());

const setText = (element, value) => {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
};

const injectStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
};

const patchPlainWording = (root) => {
  WORDING_REPLACEMENTS.forEach((next, current) => {
    root.querySelectorAll("button, span, label, h2, h3, h4, p, th, td, option").forEach((element) => {
      const text = normalize(element.textContent);
      if (text === current) {
        setText(element, next);
      }
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
        return;
      }
      setText(item, `Nhân viên: ${value}`);
      return;
    }

    if (text.startsWith("Nhà hàng:")) {
      const value = text.replace("Nhà hàng:", "").trim();
      if (!value || isTechnicalId(value)) {
        setText(item, "Nhà hàng: Đang áp dụng theo chi nhánh đã chọn");
        return;
      }
      setText(item, `Nhà hàng: ${value}`);
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
    const replacement = HINT_REPLACEMENTS.find((item) => text === item.test);
    if (replacement) {
      setText(hint, replacement.text);
    }

    const finalText = normalize(hint.textContent);
    if (seen.has(finalText)) {
      hint.remove();
    } else {
      seen.add(finalText);
    }
  });
};

const patchFocusBanner = (root) => {
  root.querySelectorAll(".attendance-readiness-focus-banner").forEach((banner) => {
    const title = banner.querySelector("strong");
    setText(title, "Đang xem dữ liệu chấm công từ lịch làm việc");

    if (!banner.querySelector(".focus-summary-copy")) {
      const summary = document.createElement("p");
      summary.className = "focus-summary-copy";
      summary.textContent =
        "Khu vực này chỉ xuất hiện khi bạn mở Chấm công từ Lịch làm. Hệ thống tự lọc theo ngày, nhân viên hoặc nhà hàng để bạn kiểm tra nhanh ca cần xử lý.";
      title?.insertAdjacentElement("afterend", summary);
    }

    patchFocusMeta(banner);
    patchFocusHints(banner);

    banner.querySelectorAll(".focus-actions .staff-secondary-btn").forEach((button) => {
      const text = normalize(button.textContent);
      const next = WORDING_REPLACEMENTS.get(text);
      if (next) setText(button, next);
    });
  });
};

const patchAttendancePage = () => {
  const root = document.querySelector(".attendance-management-page");
  if (!root) return;

  patchPlainWording(root);
  patchFocusBanner(root);
};

export const installAttendanceWordingTuning = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  injectStyle();
  patchAttendancePage();

  if (window[OBSERVER_KEY]) return;
  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(patchAttendancePage);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window[OBSERVER_KEY] = observer;
};
