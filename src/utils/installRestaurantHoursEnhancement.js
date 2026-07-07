const HOURS_ROUTE_RE = /^\/(manager|admin)(?:\/|$)/;

const findFieldByLabel = (root, text) => {
  const label = Array.from(root.querySelectorAll(".ant-form-item-label label")).find(
    (node) => node.textContent?.trim() === text,
  );
  return label?.closest(".ant-form-item")?.querySelector("input") || null;
};

const setHoursError = (root, message = "") => {
  const row = root.querySelector(".restaurant-hours-grid");
  if (!row) return;

  let error = row.querySelector(".restaurant-hours-error");
  if (!message) {
    error?.remove();
    return;
  }

  if (!error) {
    error = document.createElement("div");
    error.className = "restaurant-hours-error";
    error.setAttribute("role", "alert");
    row.appendChild(error);
  }
  error.textContent = message;
};

const enhanceHours = () => {
  if (!HOURS_ROUTE_RE.test(window.location.pathname)) return;

  const root = document.querySelector(".restaurant-management-container");
  if (!root) return;

  const openingInput = findFieldByLabel(root, "Giờ mở cửa");
  const closingInput = findFieldByLabel(root, "Giờ đóng cửa");
  if (!openingInput || !closingInput) return;

  const row = openingInput.closest(".ant-row");
  if (!row || row !== closingInput.closest(".ant-row")) return;

  row.classList.add("restaurant-hours-grid");

  [
    [openingInput, "Giờ mở cửa"],
    [closingInput, "Giờ đóng cửa"],
  ].forEach(([input, label]) => {
    input.type = "time";
    input.step = "300";
    input.setAttribute("aria-label", label);
    input.setAttribute("autocomplete", "off");
    input.classList.add("restaurant-hours-time-input");
  });

  if (!row.previousElementSibling?.classList.contains("restaurant-hours-heading")) {
    const heading = document.createElement("div");
    heading.className = "restaurant-hours-heading";

    const title = document.createElement("strong");
    title.textContent = "Giờ phục vụ mặc định";

    const help = document.createElement("span");
    help.textContent = "Dùng định dạng 24 giờ. Có thể đặt ca qua đêm, ví dụ 18:00–02:00.";

    heading.append(title, help);
    row.parentElement?.insertBefore(heading, row);
  }

  const validatePair = () => {
    const opening = openingInput.value.trim();
    const closing = closingInput.value.trim();
    const valid = Boolean(opening) === Boolean(closing);
    setHoursError(
      root,
      valid ? "" : "Vui lòng nhập đầy đủ cả giờ mở cửa và giờ đóng cửa.",
    );
    return valid;
  };

  if (!root.dataset.hoursValidationBound) {
    root.dataset.hoursValidationBound = "true";
    root.addEventListener("input", (event) => {
      if (event.target === openingInput || event.target === closingInput) validatePair();
    });
    root.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        if (!button || !button.textContent?.includes("Lưu thay đổi")) return;
        if (validatePair()) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        (!openingInput.value ? openingInput : closingInput).focus();
      },
      true,
    );
  }
};

export const installRestaurantHoursEnhancement = () => {
  if (typeof window === "undefined" || window.__restaurantHoursEnhancementInstalled) return;
  window.__restaurantHoursEnhancementInstalled = true;

  const observer = new MutationObserver(enhanceHours);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", enhanceHours);
  queueMicrotask(enhanceHours);
};
