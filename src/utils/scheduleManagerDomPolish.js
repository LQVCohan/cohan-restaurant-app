const getText = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const extractMatch = (text, regex, fallback = "") => {
  const match = text.match(regex);
  return match?.[1]?.trim() || fallback;
};

const cleanValue = (value, fallback = "") =>
  String(value || fallback)
    .replace(/\s+/g, " ")
    .replace(/\s+([,:])/g, "$1")
    .trim();

const getInitials = (name) => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "!";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();
};

const SHIFT_LABELS = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  evening: "Ca tối",
  night: "Ca đêm",
  full_day: "Cả ngày",
};

const formatShiftLabel = (rawShift) => {
  const value = cleanValue(rawShift, "Ca cần xử lý");
  const match = value.match(/^([a-z_]+),\s*(.*)$/i);
  if (!match) return value;
  const type = match[1].toLowerCase();
  const rest = match[2];
  return `${SHIFT_LABELS[type] || type} · ${rest}`;
};

const normalizeStatus = (rawStatus) => {
  const status = cleanValue(rawStatus, "Cần xử lý");
  return status
    .replace(/^Đã chấp nhận lý do$/i, "Đã chấp nhận lý do")
    .replace(/^Không duyệt lý do$/i, "Không duyệt lý do");
};

const isDeclinedBlockText = (text) =>
  text.includes("Ca bị từ chối") &&
  (text.includes("Nhân viên:") || text.includes("Mở ca để xử lý"));

const findScheduleRoot = () =>
  document.querySelector(".manager-page-shell--schedules") ||
  document.querySelector(".schedule-container") ||
  null;

const findOpenShiftButton = () =>
  Array.from(document.querySelectorAll("button")).find((button) =>
    getText(button).includes("Mở ca để xử lý"),
  );

const findClosestDeclinedContainerFromButton = (button) => {
  if (!button) return null;

  let current = button.parentElement;
  let candidate = null;
  const schedule = document.querySelector(".schedule-container");

  while (current && current !== document.body && current !== schedule) {
    const text = getText(current);
    if (isDeclinedBlockText(text)) {
      candidate = current;
    }
    current = current.parentElement;
  }

  return candidate;
};

const findDeclinedBlock = () => {
  const existingSource = document.querySelector(".schedule-action-source-hidden");
  if (existingSource) return existingSource;

  const button = findOpenShiftButton();
  const fromButton = findClosestDeclinedContainerFromButton(button);
  if (fromButton) return fromButton;

  const schedule = document.querySelector(".schedule-container") || document.body;
  const candidates = Array.from(schedule.querySelectorAll("section, article, div"))
    .filter((node) => !node.closest(".schedule-action-center"))
    .filter((node) => isDeclinedBlockText(getText(node)));

  if (!candidates.length) return null;

  return candidates.sort((a, b) => getText(a).length - getText(b).length)[0];
};

const extractDeclinedInfo = (text) => {
  const count = cleanValue(
    extractMatch(text, /Ca bị từ chối\s*\((\d+)\)/i, "1"),
    "1",
  );
  const employee = cleanValue(
    extractMatch(text, /Nhân viên:\s*(.*?)(?=Ca:|Lý do:|Ghi chú:|Trạng thái xử lý:|ID:|$)/i, "Nhân viên"),
    "Nhân viên",
  );
  const shift = formatShiftLabel(
    extractMatch(text, /Ca:\s*(.*?)(?=Lý do:|Ghi chú:|Trạng thái xử lý:|ID:|$)/i, "Ca cần xử lý"),
  );
  const reason = cleanValue(
    extractMatch(text, /Lý do:\s*(.*?)(?=Ghi chú:|Trạng thái xử lý:|ID:|Lý do hợp lệ|Nhân viên vẫn|Mở ca để xử lý|$)/i, "Chưa có lý do"),
    "Chưa có lý do",
  );
  const status = normalizeStatus(
    extractMatch(text, /Trạng thái xử lý:\s*(.*?)(?=ID:|Lý do hợp lệ|Nhân viên vẫn|Mở ca để xử lý|$)/i, "Cần xử lý"),
  );

  return { count, employee, shift, reason, status };
};

const buildActionCenter = (source) => {
  const text = getText(source);
  const { count, employee, shift, reason, status } = extractDeclinedInfo(text);
  const originalButton =
    findOpenShiftButton() ||
    Array.from(source.querySelectorAll("button")).find((button) =>
      getText(button).includes("Mở ca để xử lý"),
    );

  const wrapper = document.createElement("section");
  wrapper.className = "schedule-action-center";
  wrapper.dataset.domPolish = "true";

  wrapper.innerHTML = `
    <div class="schedule-action-center__header">
      <div>
        <span class="schedule-action-center__eyebrow">Cần xử lý</span>
        <h3 class="schedule-action-center__title">Ca bị từ chối cần quản lý xem lại</h3>
        <p class="schedule-action-center__subtitle">Hiển thị gọn các yêu cầu ảnh hưởng tới lịch tuần này. Chi tiết kỹ thuật được ẩn khỏi màn hình chính.</p>
      </div>
      <span class="schedule-action-center__count">${escapeHtml(count)} yêu cầu</span>
    </div>
    <div class="schedule-action-center__body">
      <div class="schedule-action-center__primary">
        <div class="schedule-action-center__person">
          <span class="schedule-action-center__avatar">${escapeHtml(getInitials(employee))}</span>
          <div>
            <strong>${escapeHtml(employee)}</strong>
            <span>${escapeHtml(shift)}</span>
          </div>
        </div>
        <div class="schedule-action-center__meta">
          <span class="schedule-action-center__pill schedule-action-center__pill--reason">Lý do: ${escapeHtml(reason)}</span>
          <span class="schedule-action-center__pill schedule-action-center__pill--status">${escapeHtml(status)}</span>
        </div>
      </div>
      <div class="schedule-action-center__action"></div>
    </div>
  `;

  const actionSlot = wrapper.querySelector(".schedule-action-center__action");
  if (originalButton) {
    const proxy = document.createElement("button");
    proxy.type = "button";
    proxy.textContent = "Mở ca để xử lý";
    proxy.addEventListener("click", () => originalButton.click());
    actionSlot.appendChild(proxy);
  }

  return wrapper;
};

const applyScheduleActionCenter = () => {
  const source = findDeclinedBlock();
  if (!source) return;

  const existing = document.querySelector(".schedule-action-center[data-dom-polish='true']");
  if (existing && source.classList.contains("schedule-action-source-hidden")) return;
  if (existing) existing.remove();

  const actionCenter = buildActionCenter(source);
  source.parentNode?.insertBefore(actionCenter, source);
  source.classList.add("schedule-action-source-hidden");
  source.dataset.actionCenterSource = "true";
};

const getCurrentViewLabel = (root) => {
  const active = root.querySelector(".view-toggles button.active");
  const text = getText(active).toLowerCase();
  if (text.includes("ngày")) return "Ngày đang xem";
  if (text.includes("tháng")) return "Tháng đang xem";
  return "Tuần đang xem";
};

const getNavigationButton = (root, direction) => {
  const buttons = Array.from(root.querySelectorAll(".schedule-toolbar .date-navigation .nav-btn"));
  if (!buttons.length) return null;
  return direction === "prev" ? buttons[0] : buttons[buttons.length - 1];
};

const buildBoardWeekJumper = () => {
  const node = document.createElement("div");
  node.className = "schedule-board-week-jumper";
  node.dataset.domPolish = "true";
  node.innerHTML = `
    <div class="schedule-board-week-jumper__label">
      <span class="schedule-board-week-jumper__eyebrow">Điều hướng nhanh</span>
      <strong></strong>
    </div>
    <div class="schedule-board-week-jumper__actions">
      <button type="button" class="schedule-board-week-jumper__btn" data-week-jump="prev" aria-label="Xem kỳ trước">‹ Trước</button>
      <button type="button" class="schedule-board-week-jumper__btn schedule-board-week-jumper__btn--primary" data-week-jump="next" aria-label="Xem kỳ sau">Sau ›</button>
    </div>
  `;

  node.addEventListener("click", (event) => {
    const button = event.target.closest("[data-week-jump]");
    if (!button) return;
    const root = findScheduleRoot();
    if (!root) return;
    getNavigationButton(root, button.dataset.weekJump)?.click();
  });

  return node;
};

const applyScheduleBoardWeekJumper = () => {
  const root = findScheduleRoot();
  if (!root) return;

  const toolbarNav = root.querySelector(".schedule-toolbar .date-navigation");
  const scheduleBoard = root.querySelector(".schedule-board, .daily-view-horizontal");
  const legend = root.querySelector(".schedule-legend");
  const anchor = legend || scheduleBoard;
  const existing = root.querySelector(".schedule-board-week-jumper[data-dom-polish='true']");

  if (!toolbarNav || !anchor) {
    existing?.remove();
    return;
  }

  const jumper = existing || buildBoardWeekJumper();
  const label = getText(toolbarNav.querySelector(".week-label")) || "Kỳ đang xem";
  const viewLabel = getCurrentViewLabel(root);
  const title = jumper.querySelector("strong");
  const eyebrow = jumper.querySelector(".schedule-board-week-jumper__eyebrow");
  if (title) title.textContent = label;
  if (eyebrow) eyebrow.textContent = viewLabel;

  if (!existing || jumper.nextElementSibling !== anchor) {
    anchor.parentNode?.insertBefore(jumper, anchor);
  }
};

const shouldKeepAvailabilityPanelExpanded = (panel) => {
  const text = getText(panel);
  return [
    "Chưa có kỳ đăng ký",
    "Tạo kỳ đăng ký",
    "Không thể tải kỳ đăng ký",
    "Nên mở đăng ký",
    "Hôm nay nên hoàn tất",
  ].some((phrase) => text.includes(phrase));
};

const collapseOptionalSchedulePanelsOnce = () => {
  const root = findScheduleRoot();
  if (!root || root.dataset.optionalPanelsInitialCollapsed === "true") return;

  const availabilityPanel = root.querySelector(".schedule-availability-panel");
  if (!availabilityPanel) return;

  const hideSubmissionsButton = Array.from(
    availabilityPanel.querySelectorAll("button"),
  ).find((button) => getText(button).includes("Ẩn submissions"));
  hideSubmissionsButton?.click();

  const collapseButton = availabilityPanel.querySelector(".btn-collapse-panel.icon-only");
  const isAlreadyCollapsed =
    String(collapseButton?.getAttribute("aria-label") || "").includes("Mở rộng") ||
    String(collapseButton?.getAttribute("title") || "").includes("Mở rộng");

  if (
    collapseButton &&
    !isAlreadyCollapsed &&
    !shouldKeepAvailabilityPanelExpanded(availabilityPanel)
  ) {
    collapseButton.click();
  }

  root.dataset.optionalPanelsInitialCollapsed = "true";
};

export const initScheduleManagerDomPolish = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let frameId = 0;
  const run = () => {
    window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => {
      try {
        applyScheduleActionCenter();
        applyScheduleBoardWeekJumper();
        collapseOptionalSchedulePanelsOnce();
      } catch (error) {
        if (import.meta?.env?.DEV) {
          console.warn("Schedule manager DOM polish failed", error);
        }
      }
    });
  };

  run();
  window.setTimeout(run, 250);
  window.setTimeout(run, 900);
  window.setTimeout(run, 1600);

  const observer = new MutationObserver(run);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
};
