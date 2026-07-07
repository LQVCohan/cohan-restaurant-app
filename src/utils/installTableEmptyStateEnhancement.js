const OBSERVER_KEY = "__cohanTableEmptyStateObserver";
const CLICK_HANDLER_KEY = "__cohanTableEmptyStateClickHandler";
const NO_FLOORS_CLASS = "tm-container--no-floors";
const SETUP_CLASS = "tm-empty--setup";
const HEADER_ACTION_CLASS = "tm-first-floor-action";

const getDirectChild = (element, predicate) =>
  Array.from(element?.children || []).find(predicate) || null;

const getActualFloorCount = (container) => {
  const floorItemCount =
    container?.querySelectorAll?.(".tm-floor-list > .tm-floor-item")?.length ?? 0;
  return Math.max(0, floorItemCount - 1);
};

const hasStoredText = (element, key) =>
  Boolean(element?.dataset) &&
  Object.prototype.hasOwnProperty.call(element.dataset, key);

const restoreText = (element, key) => {
  if (!hasStoredText(element, key)) return;
  element.textContent = element.dataset[key];
  delete element.dataset[key];
};

const setEnhancedText = (element, key, value) => {
  if (!element) return;
  if (!hasStoredText(element, key)) {
    element.dataset[key] = element.textContent || "";
  }
  if (element.textContent !== value) element.textContent = value;
};

const restoreEmptyState = (container) => {
  container?.querySelector(".tm-setup-note")?.remove();

  const empty = container?.querySelector(`.${SETUP_CLASS}`);
  if (empty) {
    empty.classList.remove(SETUP_CLASS);
    empty.removeAttribute("role");
    empty.removeAttribute("aria-live");
    empty.querySelector(".tm-empty__eyebrow")?.remove();
    empty.querySelector(".tm-empty__title")?.remove();
    empty.querySelector(".tm-empty__steps")?.remove();

    const icon = getDirectChild(
      empty,
      (child) => child.matches?.("span[aria-hidden='true']"),
    );
    icon?.classList.remove("tm-empty__icon");

    const message = getDirectChild(empty, (child) => child.tagName === "P");
    message?.classList.remove("tm-empty__message");
    restoreText(message, "tableEmptyOriginalText");

    const action = getDirectChild(empty, (child) => child.tagName === "BUTTON");
    action?.classList.remove("tm-empty__action");
    restoreText(action?.querySelector(".btn__text"), "tableEmptyOriginalText");
  }

  const headerAction = container?.querySelector(
    `.management-page-header .${HEADER_ACTION_CLASS}`,
  );
  if (headerAction) {
    headerAction.classList.remove(HEADER_ACTION_CLASS);
    restoreText(
      headerAction.querySelector("span"),
      "tableEmptyOriginalText",
    );
  }
};

const ensureSetupNote = (container) => {
  const sidebar = container.querySelector(".tm-sidebar");
  const filters = sidebar?.querySelector(".tm-filter-box");
  if (!sidebar || !filters || sidebar.querySelector(".tm-setup-note")) return;

  const note = document.createElement("section");
  note.className = "tm-setup-note";
  note.setAttribute("aria-label", "Hướng dẫn thiết lập tầng đầu tiên");
  note.innerHTML = `
    <span class="tm-setup-note__eyebrow">Bước đầu tiên</span>
    <strong>Tạo tầng trước khi thêm bàn</strong>
    <p>Mỗi bàn cần thuộc một tầng hoặc khu vực để theo dõi và thiết kế sơ đồ.</p>
  `;
  filters.insertAdjacentElement("beforebegin", note);
};

const ensureSetupSteps = (empty) => {
  if (empty.querySelector(".tm-empty__steps")) return;
  const steps = document.createElement("ol");
  steps.className = "tm-empty__steps";
  steps.setAttribute("aria-label", "Ba bước thiết lập khu vực bàn");
  steps.innerHTML = `
    <li>
      <span class="tm-empty__step-number">01</span>
      <div><strong>Tạo tầng</strong><small>Đặt tên tầng hoặc khu vực phục vụ.</small></div>
    </li>
    <li>
      <span class="tm-empty__step-number">02</span>
      <div><strong>Thêm bàn</strong><small>Khai báo mã bàn, số ghế và loại bàn.</small></div>
    </li>
    <li>
      <span class="tm-empty__step-number">03</span>
      <div><strong>Sắp xếp sơ đồ</strong><small>Đặt vị trí bàn theo mặt bằng thực tế.</small></div>
    </li>
  `;

  const action = getDirectChild(empty, (child) => child.tagName === "BUTTON");
  if (action) action.insertAdjacentElement("beforebegin", steps);
  else empty.appendChild(steps);
};

const ensureSetupEmptyState = (container) => {
  const empty = container.querySelector(
    ".tm-grid-area > .tm-empty:not(.tm-empty--error)",
  );
  if (!empty) return;

  empty.classList.add(SETUP_CLASS);
  empty.setAttribute("role", "status");
  empty.setAttribute("aria-live", "polite");

  const icon = getDirectChild(
    empty,
    (child) => child.matches?.("span[aria-hidden='true']"),
  );
  icon?.classList.add("tm-empty__icon");

  let eyebrow = empty.querySelector(".tm-empty__eyebrow");
  if (!eyebrow) {
    eyebrow = document.createElement("span");
    eyebrow.className = "tm-empty__eyebrow";
    eyebrow.textContent = "Thiết lập khu vực phục vụ";
    icon?.insertAdjacentElement("afterend", eyebrow);
  }

  let title = empty.querySelector(".tm-empty__title");
  if (!title) {
    title = document.createElement("h3");
    title.className = "tm-empty__title";
    title.textContent = "Bắt đầu từ cấu trúc tầng";
    eyebrow.insertAdjacentElement("afterend", title);
  }

  const message = getDirectChild(empty, (child) => child.tagName === "P");
  if (message) {
    message.classList.add("tm-empty__message");
    setEnhancedText(
      message,
      "tableEmptyOriginalText",
      "Tạo tầng đầu tiên, sau đó thêm bàn và sắp xếp sơ đồ theo mặt bằng thực tế của chi nhánh.",
    );
  }

  ensureSetupSteps(empty);

  const action = getDirectChild(empty, (child) => child.tagName === "BUTTON");
  if (action) {
    action.classList.add("tm-empty__action");
    setEnhancedText(
      action.querySelector(".btn__text"),
      "tableEmptyOriginalText",
      "Tạo tầng đầu tiên",
    );
  }
};

const ensureHeaderAction = (container) => {
  const action = container.querySelector(
    ".management-page-header .mph-btn--primary",
  );
  if (!action) return;
  action.classList.add(HEADER_ACTION_CLASS);
  setEnhancedText(
    action.querySelector("span"),
    "tableEmptyOriginalText",
    "Tạo tầng đầu tiên",
  );
};

const prepareTableEmptyState = () => {
  const container = document.querySelector(
    ".manager-layout--tables .tm-container",
  );
  if (!container) return null;

  const noFloors = getActualFloorCount(container) === 0;
  container.classList.toggle(NO_FLOORS_CLASS, noFloors);

  if (!noFloors) {
    restoreEmptyState(container);
    return container;
  }

  ensureSetupNote(container);
  ensureSetupEmptyState(container);
  ensureHeaderAction(container);
  return container;
};

const handleFirstFloorAction = (event) => {
  const action = event.target?.closest?.(`.${HEADER_ACTION_CLASS}`);
  if (!action) return;
  const container = action.closest(`.${NO_FLOORS_CLASS}`);
  const addFloorButton = container?.querySelector(".tm-add-floor-btn");
  if (!addFloorButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  addFloorButton.click();
};

export const installTableEmptyStateEnhancement = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  prepareTableEmptyState();

  window[OBSERVER_KEY]?.disconnect?.();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    const run =
      window.requestAnimationFrame ||
      ((callback) => window.setTimeout(callback, 0));
    run(() => {
      scheduled = false;
      prepareTableEmptyState();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window[OBSERVER_KEY] = observer;

  const previousHandler = window[CLICK_HANDLER_KEY];
  if (previousHandler) document.removeEventListener("click", previousHandler, true);
  document.addEventListener("click", handleFirstFloorAction, true);
  window[CLICK_HANDLER_KEY] = handleFirstFloorAction;
};

export const __testables = {
  OBSERVER_KEY,
  CLICK_HANDLER_KEY,
  NO_FLOORS_CLASS,
  SETUP_CLASS,
  HEADER_ACTION_CLASS,
  getActualFloorCount,
  prepareTableEmptyState,
  handleFirstFloorAction,
};
