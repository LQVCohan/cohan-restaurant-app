const FIT_CLASS = "fp-fit-override";

const getNumberStyle = (el, prop) => {
  const value = parseFloat(el.style?.[prop] || "0");
  return Number.isFinite(value) ? value : 0;
};

const getFloorPlanRoot = () => document.querySelector(".fp-layout");
const getCanvasViewport = () => document.querySelector(".fp-canvas-viewport");
const getCanvasWorld = () => document.querySelector(".fp-canvas-world");

const getCanvasItems = () =>
  Array.from(document.querySelectorAll(".fp-canvas-world > .fp-item"));

const clearFitOverride = () => {
  const root = getFloorPlanRoot();
  root?.classList.remove(FIT_CLASS);
};

const fitFloorPlanToView = ({ notify = false } = {}) => {
  const root = getFloorPlanRoot();
  const viewport = getCanvasViewport();
  const world = getCanvasWorld();
  const items = getCanvasItems();

  if (!root || !viewport || !world || !items.length) return false;

  const bounds = items.reduce(
    (acc, item) => {
      const left = getNumberStyle(item, "left");
      const top = getNumberStyle(item, "top");
      const width = getNumberStyle(item, "width") || item.offsetWidth || 60;
      const height = getNumberStyle(item, "height") || item.offsetHeight || 60;
      return {
        minX: Math.min(acc.minX, left),
        minY: Math.min(acc.minY, top),
        maxX: Math.max(acc.maxX, left + width),
        maxY: Math.max(acc.maxY, top + height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) return false;

  const palette = document.querySelector(".fp-palette:not(.collapsed)");
  const inspector = document.querySelector(".fp-properties");
  const leftReserved = palette ? palette.getBoundingClientRect().width + 42 : 32;
  const rightReserved = inspector ? inspector.getBoundingClientRect().width + 42 : 220;
  const topReserved = 40;
  const bottomReserved = 96;
  const availableWidth = Math.max(360, viewport.clientWidth - leftReserved - rightReserved);
  const availableHeight = Math.max(260, viewport.clientHeight - topReserved - bottomReserved);
  const contentWidth = Math.max(120, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(120, bounds.maxY - bounds.minY);
  const scale = Math.max(
    0.45,
    Math.min(1.15, Math.min(availableWidth / contentWidth, availableHeight / contentHeight) * 0.78)
  );

  const contentCenterX = bounds.minX + contentWidth / 2;
  const contentCenterY = bounds.minY + contentHeight / 2;
  const targetCenterX = leftReserved + availableWidth / 2;
  const targetCenterY = topReserved + availableHeight / 2;
  const translateX = targetCenterX - contentCenterX * scale;
  const translateY = targetCenterY - contentCenterY * scale;

  root.style.setProperty("--fp-fit-transform", `translate(${Math.round(translateX)}px, ${Math.round(translateY)}px) scale(${scale.toFixed(3)})`);
  root.classList.add(FIT_CLASS);

  if (notify) {
    const badge = document.querySelector(".fp-experience-status");
    if (badge) {
      badge.textContent = "Đã căn giữa sơ đồ";
      window.setTimeout(() => {
        if (badge.textContent === "Đã căn giữa sơ đồ") badge.textContent = "Sẵn sàng thiết kế";
      }, 1800);
    }
  }

  return true;
};

const ensureQuickGuide = () => {
  const root = getFloorPlanRoot();
  const body = document.querySelector(".fp-body");
  if (!root || !body || body.querySelector(".fp-experience-guide")) return;

  const guide = document.createElement("div");
  guide.className = "fp-experience-guide";
  guide.innerHTML = `
    <div class="fp-experience-guide__main">
      <strong>Thiết kế nhanh</strong>
      <span>Kéo vật thể từ thanh công cụ · Space để kéo canvas · Ctrl+Z hoàn tác · Ctrl+S lưu</span>
    </div>
    <span class="fp-experience-status">Sẵn sàng thiết kế</span>
  `;
  body.appendChild(guide);
};

const ensureFitButton = () => {
  const controls = document.querySelector(".fp-controls");
  if (!controls || controls.querySelector(".fp-fit-view-btn")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "fp-fit-view-btn";
  button.title = "Căn giữa sơ đồ hiện tại";
  button.innerHTML = `<span aria-hidden="true">⌖</span>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    fitFloorPlanToView({ notify: true });
  });
  controls.prepend(button);
};

const ensureHeaderFitButton = () => {
  const right = document.querySelector(".fp-header .right-sect");
  if (!right || right.querySelector(".fp-header-fit-btn")) return;

  const saveButton = Array.from(right.querySelectorAll("button")).find((btn) => btn.textContent?.trim() === "Lưu");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn-secondary fp-header-fit-btn";
  button.title = "Căn giữa sơ đồ";
  button.innerHTML = `<span aria-hidden="true">⌖</span> Căn giữa`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    fitFloorPlanToView({ notify: true });
  });

  if (saveButton) right.insertBefore(button, saveButton);
  else right.appendChild(button);
};

const installInteractionGuards = () => {
  const viewport = getCanvasViewport();
  const header = document.querySelector(".fp-header");
  viewport?.addEventListener("mousedown", clearFitOverride, { passive: true });
  viewport?.addEventListener("wheel", clearFitOverride, { passive: true });
  header?.querySelectorAll(".zoom-pill button, .tool-toggle").forEach((btn) => {
    btn.addEventListener("click", clearFitOverride, { passive: true });
  });
};

const installShortcuts = () => {
  if (window.__floorPlanExperienceShortcutsInstalled) return;
  window.__floorPlanExperienceShortcutsInstalled = true;
  window.addEventListener("keydown", (event) => {
    const root = getFloorPlanRoot();
    if (!root) return;
    const tag = String(document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      const saveButton = Array.from(document.querySelectorAll(".fp-header .right-sect button"))
        .find((btn) => btn.textContent?.includes("Lưu"));
      saveButton?.click();
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      fitFloorPlanToView({ notify: true });
    }
  });
};

const tuneStaticCopy = () => {
  document.querySelectorAll(".fp-layout .file-info .title").forEach((el) => {
    if (el.textContent?.trim() === "Floor Plan Designer") el.textContent = "Thiết kế sơ đồ bàn";
  });
  document.querySelectorAll(".fp-layout .palette-header span").forEach((el) => {
    if (el.textContent?.trim() === "Bộ công cụ") el.textContent = "Công cụ thiết kế";
  });
};

const runEnhance = ({ autoFit = false } = {}) => {
  if (!getFloorPlanRoot()) return;
  ensureQuickGuide();
  ensureFitButton();
  ensureHeaderFitButton();
  installInteractionGuards();
  installShortcuts();
  tuneStaticCopy();
  if (autoFit) window.setTimeout(() => fitFloorPlanToView(), 150);
};

export const installFloorPlanDesignerExperience = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__floorPlanDesignerExperienceInstalled) return;
  window.__floorPlanDesignerExperienceInstalled = true;

  const observer = new MutationObserver((mutations) => {
    let shouldRun = false;
    let shouldAutoFit = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.(".fp-layout") || node.querySelector?.(".fp-layout")) {
          shouldRun = true;
          shouldAutoFit = true;
        }
        if (node.matches?.(".fp-item") || node.querySelector?.(".fp-item")) {
          shouldRun = true;
        }
      });
    });
    if (shouldRun) window.requestAnimationFrame(() => runEnhance({ autoFit: shouldAutoFit }));
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.requestAnimationFrame(() => runEnhance({ autoFit: true }));
};
