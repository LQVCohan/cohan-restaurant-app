const READY_ATTRIBUTE = "data-observability-ready";
const COLLAPSED_CLASS = "schedule-quality-panel--collapsed";
const TOGGLE_CLASS = "schedule-quality-panel__observability-toggle";

function setPanelCollapsed(panel, button, collapsed) {
  panel.classList.toggle(COLLAPSED_CLASS, collapsed);
  button.setAttribute("aria-expanded", String(!collapsed));
  button.textContent = collapsed ? "Mở trung tâm xử lý" : "Thu gọn xử lý";
}

function enhanceQualityPanel(panel, cleanups) {
  if (!(panel instanceof HTMLElement)) return;
  if (panel.hasAttribute(READY_ATTRIBUTE)) return;

  const header = panel.querySelector(".schedule-quality-panel__header");
  if (!(header instanceof HTMLElement)) return;

  panel.setAttribute(READY_ATTRIBUTE, "true");
  panel.classList.add("schedule-quality-panel--observability");

  const button = document.createElement("button");
  button.type = "button";
  button.className = TOGGLE_CLASS;
  button.setAttribute("aria-label", "Mở hoặc thu gọn trung tâm xử lý lịch");
  setPanelCollapsed(panel, button, true);

  const handleToggle = () => {
    setPanelCollapsed(panel, button, !panel.classList.contains(COLLAPSED_CLASS));
  };

  button.addEventListener("click", handleToggle);
  header.appendChild(button);

  cleanups.push(() => {
    button.removeEventListener("click", handleToggle);
    button.remove();
    panel.classList.remove(
      "schedule-quality-panel--observability",
      COLLAPSED_CLASS,
    );
    panel.removeAttribute(READY_ATTRIBUTE);
  });
}

function enhanceScheduleRoot(root, cleanups) {
  if (!(root instanceof HTMLElement)) return;
  root.classList.add("schedule-observability-layout");
  root
    .querySelectorAll(".schedule-quality-panel")
    .forEach((panel) => enhanceQualityPanel(panel, cleanups));
}

export function initScheduleObservabilityLayout() {
  if (typeof document === "undefined") return () => {};

  const cleanups = [];
  const apply = () => {
    document
      .querySelectorAll(".schedule-container")
      .forEach((root) => enhanceScheduleRoot(root, cleanups));
  };

  apply();

  const observer = new MutationObserver(() => apply());
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    document
      .querySelectorAll(".schedule-container.schedule-observability-layout")
      .forEach((root) => root.classList.remove("schedule-observability-layout"));
  };
}
