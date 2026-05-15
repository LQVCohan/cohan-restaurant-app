const SCHEDULE_ROOT_SELECTOR = ".manager-page-shell--schedules";
const HYDRATING_CLASS = "schedule-polish-hydrating";
const FIRST_WEEK_GRACE_SESSION_KEY = "schedule.firstWeekGrace.seen";

const getText = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";

const hasScheduleCriticalShell = (root) =>
  Boolean(
    root?.querySelector(".schedule-toolbar") &&
      root?.querySelector(".schedule-availability-panel") &&
      (root?.querySelector(".schedule-board") ||
        root?.querySelector(".daily-view-horizontal")),
  );

const getScheduleReminderNodes = (root) =>
  Array.from(root?.querySelectorAll(".schedule-publish-reminder") || []);

const hideRepeatedFirstWeekGraceReminder = (root) => {
  if (!root || typeof window === "undefined") return;

  const reminders = getScheduleReminderNodes(root).filter((node) =>
    getText(node).includes("Tuần đầu sử dụng hệ thống"),
  );

  if (!reminders.length) return;

  const hasSeen = window.sessionStorage?.getItem(FIRST_WEEK_GRACE_SESSION_KEY) === "1";

  reminders.forEach((node) => {
    if (hasSeen) {
      node.classList.add("schedule-first-week-grace-hidden");
    } else {
      node.classList.remove("schedule-first-week-grace-hidden");
    }
  });

  if (!hasSeen) {
    window.sessionStorage?.setItem(FIRST_WEEK_GRACE_SESSION_KEY, "1");
  }
};

export const initScheduleHydrationPolish = ({
  minDelay = 620,
  maxDelay = 1250,
} = {}) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }

  let disposed = false;
  let minDelayPassed = false;
  let hydrationFinished = false;
  let root = null;
  const timeoutIds = [];

  const getRoot = () => {
    root = document.querySelector(SCHEDULE_ROOT_SELECTOR) || root;
    return root;
  };

  const clearHydration = () => {
    if (disposed) return;
    hydrationFinished = true;
    const currentRoot = getRoot();
    currentRoot?.classList.remove(HYDRATING_CLASS);
    currentRoot?.removeAttribute("data-schedule-hydrating");
    currentRoot?.setAttribute("data-schedule-hydrated", "true");
    hideRepeatedFirstWeekGraceReminder(currentRoot);
  };

  const tryFinish = () => {
    if (disposed || hydrationFinished || !minDelayPassed) return;
    const currentRoot = getRoot();
    if (!currentRoot) return;

    hideRepeatedFirstWeekGraceReminder(currentRoot);

    if (hasScheduleCriticalShell(currentRoot)) {
      clearHydration();
    }
  };

  const markHydrating = () => {
    if (hydrationFinished) return false;
    const currentRoot = getRoot();
    if (!currentRoot) return false;
    currentRoot.classList.add(HYDRATING_CLASS);
    currentRoot.setAttribute("data-schedule-hydrating", "true");
    hideRepeatedFirstWeekGraceReminder(currentRoot);
    return true;
  };

  const boot = () => {
    if (disposed || hydrationFinished) return;
    if (!markHydrating()) return;
    tryFinish();
  };

  boot();

  const observer = new MutationObserver(() => {
    if (hydrationFinished) {
      hideRepeatedFirstWeekGraceReminder(getRoot());
      return;
    }
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
    root?.removeAttribute("data-schedule-hydrated");
  };
};
