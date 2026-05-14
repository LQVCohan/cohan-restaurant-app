const getText = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";

const extractMatch = (text, regex, fallback = "") => {
  const match = text.match(regex);
  return match?.[1]?.trim() || fallback;
};

const getInitials = (name) => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "!";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();
};

const findDeclinedBlock = () => {
  const schedule = document.querySelector(".schedule-container");
  if (!schedule) return null;

  return Array.from(schedule.querySelectorAll("div"))
    .filter((node) => !node.closest(".schedule-action-center"))
    .find((node) => {
      const text = getText(node);
      return (
        text.includes("Ca bị từ chối") &&
        text.includes("Mở ca để xử lý") &&
        text.includes("Nhân viên:")
      );
    });
};

const buildActionCenter = (source) => {
  const text = getText(source);
  const count = extractMatch(text, /Ca bị từ chối\s*\((\d+)\)/i, "0");
  const employee = extractMatch(text, /Nhân viên:\s*(.*?)(?:\s+Ca:|\s+Lý do:|$)/i, "Nhân viên");
  const shift = extractMatch(text, /Ca:\s*(.*?)(?:\s+Lý do:|\s+Ghi chú:|$)/i, "Ca cần xử lý");
  const reason = extractMatch(text, /Lý do:\s*(.*?)(?:\s+Ghi chú:|\s+Trạng thái xử lý:|$)/i, "Chưa có lý do");
  const status = extractMatch(text, /Trạng thái xử lý:\s*(.*?)(?:\s+ID:|\s+Lý do hợp lệ|\s+Nhân viên|$)/i, "Cần xử lý");
  const originalButton = Array.from(source.querySelectorAll("button")).find((button) =>
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
      <span class="schedule-action-center__count">${count} yêu cầu</span>
    </div>
    <div class="schedule-action-center__body">
      <div class="schedule-action-center__primary">
        <div class="schedule-action-center__person">
          <span class="schedule-action-center__avatar">${getInitials(employee)}</span>
          <div>
            <strong>${employee}</strong>
            <span>${shift}</span>
          </div>
        </div>
        <div class="schedule-action-center__meta">
          <span class="schedule-action-center__pill schedule-action-center__pill--reason">Lý do: ${reason}</span>
          <span class="schedule-action-center__pill schedule-action-center__pill--status">${status}</span>
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
  if (!source || source.dataset.actionCenterSource === "true") return;

  const existing = document.querySelector(".schedule-action-center[data-dom-polish='true']");
  if (existing) existing.remove();

  const actionCenter = buildActionCenter(source);
  source.parentNode?.insertBefore(actionCenter, source);
  source.dataset.actionCenterSource = "true";
  source.classList.add("schedule-action-source-hidden");
};

export const initScheduleManagerDomPolish = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const run = () => {
    try {
      applyScheduleActionCenter();
    } catch (error) {
      if (import.meta?.env?.DEV) {
        console.warn("Schedule manager DOM polish failed", error);
      }
    }
  };

  run();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(run);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};
