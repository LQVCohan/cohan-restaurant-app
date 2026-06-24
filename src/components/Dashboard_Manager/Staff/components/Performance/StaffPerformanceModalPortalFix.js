const portalState = new WeakMap();

const getAppRoot = () => document.getElementById("root") || document.body;

const isBackdropEvent = (event, overlay) => event.target === overlay;

const restoreOverlay = (overlay) => {
  const state = portalState.get(overlay);
  if (!state) return;

  const { parent, placeholder } = state;
  if (parent?.isConnected && placeholder?.parentNode === parent) {
    parent.insertBefore(overlay, placeholder);
    placeholder.remove();
  }

  portalState.delete(overlay);
  overlay.classList.remove("performance-modal-overlay--portal");
};

const shouldRestoreBeforeReactUpdate = (event, overlay) => {
  const target = event.target;
  if (!(target instanceof Element)) return false;

  if (isBackdropEvent(event, overlay)) return true;
  if (target.closest(".modal-close")) return true;
  if (target.closest(".btn-secondary")) return true;
  if (target.closest(".btn-primary")) return true;
  return false;
};

const portalOverlay = (overlay) => {
  if (!overlay || portalState.has(overlay)) return;

  const appRoot = getAppRoot();
  const parent = overlay.parentNode;
  if (!appRoot || !parent || parent === appRoot) return;

  const placeholder = document.createComment("staff-performance-modal-placeholder");
  parent.insertBefore(placeholder, overlay);

  portalState.set(overlay, { parent, placeholder });
  overlay.classList.add("performance-modal-overlay--portal");
  appRoot.appendChild(overlay);

  const restoreOnCapture = (event) => {
    if (shouldRestoreBeforeReactUpdate(event, overlay)) {
      restoreOverlay(overlay);
    }
  };

  overlay.__staffPerformanceRestoreOnCapture = restoreOnCapture;
  overlay.addEventListener("mousedown", restoreOnCapture, true);
  overlay.addEventListener("click", restoreOnCapture, true);
  overlay.addEventListener("submit", restoreOnCapture, true);
};

const cleanupDisconnectedPortals = () => {
  document.querySelectorAll(".performance-modal-overlay--portal").forEach((overlay) => {
    if (!overlay.isConnected) portalState.delete(overlay);
  });
};

export const installStaffPerformanceModalPortalFix = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__staffPerformanceModalPortalFixInstalled) return;
  window.__staffPerformanceModalPortalFixInstalled = true;

  const scan = () => {
    cleanupDisconnectedPortals();
    document.querySelectorAll(".performance-modal-overlay").forEach(portalOverlay);
  };

  scan();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(scan);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};
