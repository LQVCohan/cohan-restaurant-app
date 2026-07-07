const HOURS_ROUTE_RE = /^\/(manager|admin)(?:\/|$)/;
const TIME_STEP_MINUTES = 30;

const normalizeLabel = (value = "") => value.replace(/\*/g, "").replace(/\s+/g, " ").trim();

const findFieldByLabel = (root, text) => {
  const label = Array.from(root.querySelectorAll(".ant-form-item-label label")).find(
    (node) => normalizeLabel(node.textContent).includes(text),
  );
  const item = label?.closest(".ant-form-item") || null;
  return { item, input: item?.querySelector("input") || null };
};

const getHoursContext = () => {
  if (!HOURS_ROUTE_RE.test(window.location.pathname)) return null;

  const root = document.querySelector(".restaurant-management-container");
  if (!root) return null;

  const opening = findFieldByLabel(root, "Giờ mở cửa");
  const closing = findFieldByLabel(root, "Giờ đóng cửa");
  if (!opening.input || !closing.input) return null;

  const row = opening.input.closest(".ant-row");
  if (!row || row !== closing.input.closest(".ant-row")) return null;

  return { root, row, opening, closing };
};

const setControlledInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const toTimeLabel = (value) => {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  if (hour === 0 && minuteText === "00") return `${value} · 12 giờ đêm`;
  if (hour === 12 && minuteText === "00") return `${value} · 12 giờ trưa`;
  if (hour < 12) return `${value} · ${hour || 12}:${minuteText} sáng`;
  return `${value} · ${hour - 12}:${minuteText} chiều/tối`;
};

export const buildRestaurantTimeOptions = (currentValue = "") => {
  const options = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += TIME_STEP_MINUTES) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    options.push(`${hour}:${minute}`);
  }
  if (/^\d{2}:\d{2}$/.test(currentValue) && !options.includes(currentValue)) {
    options.push(currentValue);
    options.sort();
  }
  return options;
};

const setHoursError = (context, message = "") => {
  let error = context.row.querySelector(".restaurant-hours-error");
  if (!message) {
    error?.remove();
    return;
  }

  if (!error) {
    error = document.createElement("div");
    error.className = "restaurant-hours-error";
    error.setAttribute("role", "alert");
    context.row.appendChild(error);
  }
  error.textContent = message;
};

const validateHoursPair = (context) => {
  const opening = context.opening.input.value.trim();
  const closing = context.closing.input.value.trim();
  const valid = Boolean(opening) === Boolean(closing);
  setHoursError(
    context,
    valid ? "" : "Vui lòng chọn đầy đủ cả giờ mở cửa và giờ đóng cửa.",
  );
  return valid;
};

const ensureTimeSelect = (context, field, role, placeholder) => {
  const source = field.input.closest(".ant-input-affix-wrapper") || field.input;
  field.item.classList.add("restaurant-hours-field");
  source.classList.add("restaurant-hours-source");
  field.input.setAttribute("aria-hidden", "true");
  field.input.tabIndex = -1;

  let select = field.item.querySelector(`.restaurant-hours-select[data-hours-role="${role}"]`);
  if (!select) {
    select = document.createElement("select");
    select.className = "restaurant-hours-select";
    select.dataset.hoursRole = role;
    select.setAttribute("aria-label", placeholder);

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = placeholder;
    select.appendChild(emptyOption);

    for (const value of buildRestaurantTimeOptions(field.input.value.trim())) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = toTimeLabel(value);
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      const latest = getHoursContext();
      if (!latest) return;
      const target = role === "opening" ? latest.opening.input : latest.closing.input;
      setControlledInputValue(target, select.value);
      validateHoursPair(latest);
      requestAnimationFrame(enhanceRestaurantHours);
    });

    source.insertAdjacentElement("afterend", select);
  }

  const value = field.input.value.trim();
  if (value && !Array.from(select.options).some((option) => option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = toTimeLabel(value);
    select.appendChild(option);
  }
  select.value = value;
};

export const enhanceRestaurantHours = () => {
  const context = getHoursContext();
  if (!context) return false;

  context.row.classList.add("restaurant-hours-grid");
  context.row.dataset.hoursTitle = "Giờ phục vụ mặc định";
  context.row.dataset.hoursHelp =
    "Chọn giờ theo định dạng 24 giờ. Ca qua đêm như 18:00–02:00 vẫn hợp lệ.";

  ensureTimeSelect(context, context.opening, "opening", "Chọn giờ mở cửa");
  ensureTimeSelect(context, context.closing, "closing", "Chọn giờ đóng cửa");
  return true;
};

export const installRestaurantHoursEnhancement = () => {
  if (typeof window === "undefined" || window.__restaurantHoursEnhancementInstalled) return;
  window.__restaurantHoursEnhancementInstalled = true;

  let scheduled = false;
  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceRestaurantHours();
    });
  };

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  document.addEventListener("click", (event) => {
    scheduleEnhance();
    const button = event.target.closest("button");
    if (!button || !button.textContent?.includes("Lưu thay đổi")) return;

    const context = getHoursContext();
    if (!context || validateHoursPair(context)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const missingSelect = context.opening.input.value
      ? context.closing.item.querySelector(".restaurant-hours-select")
      : context.opening.item.querySelector(".restaurant-hours-select");
    missingSelect?.focus();
  }, true);

  window.addEventListener("hashchange", scheduleEnhance);
  window.addEventListener("popstate", scheduleEnhance);
  queueMicrotask(scheduleEnhance);
};
