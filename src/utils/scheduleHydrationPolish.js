const SCHEDULE_ROOT_SELECTOR = ".manager-page-shell--schedules";
const HYDRATING_CLASS = "schedule-polish-hydrating";

const hasScheduleCriticalShell = (root) =>
  Boolean(
    root?.querySelector(".schedule-toolbar") &&
      root?.querySelector(".schedule-availability-panel") &&
      (root?.querySelector(".schedule-board") ||
        root?.querySelector(".daily-view-horizontal")),
  );

export const initScheduleHydrationPolish = ({
  minDelay = 720,
  maxDelay = 1400,
} = {}) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }

  let disposed = false;
  let minDelayPassed = false;
  let root = null;
  const timeoutIds = [];

  const getRoot = () => {
    root = document.querySelector(SCHEDULE_ROOT_SELECTOR) || root;
    return root;
  };

  const clearHydration = () => {
    if (disposed) return;
    const currentRoot = getRoot();
    currentRoot?.classList.remove(HYDRATING_CLASS);
    currentRoot?.removeAttribute("data-schedule-hydrating");
  };

  const tryFinish = () => {
    if (disposed || !minDelayPassed) return;
    const currentRoot = getRoot();
    if (!currentRoot) return;

    if (hasScheduleCriticalShell(currentRoot)) {
      clearHydration();
    }
  };

  const markHydrating = () => {
    const currentRoot = getRoot();
    if (!currentRoot) return false;
    currentRoot.classList.add(HYDRATING_CLASS);
    currentRoot.setAttribute("data-schedule-hydrating", "true");
    return true;
  };

  const boot = () => {
    if (disposed) return;
    if (!markHydrating()) return;
    tryFinish();
  };

  boot();

  const observer = new MutationObserver(() => {
    boot();
    tryFinish();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  timeoutIds.push(
    window.setTimeout(() => {
      minDelayPassed = true;
      tryFinish();
    }, minDelay),
  );

  timeoutIds.push(
    window.setTimeout(() => {
      minDelayPassed = true;
      clearHydration();
    }, maxDelay),
  );

  return () => {
    disposed = true;
    timeoutIds.forEach((id) => window.clearTimeout(id));
    observer.disconnect();
    root?.classList.remove(HYDRATING_CLASS);
    root?.removeAttribute("data-schedule-hydrating");
  };
};
