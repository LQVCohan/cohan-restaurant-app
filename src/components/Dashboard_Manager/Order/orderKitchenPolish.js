const CHIP_SIZE_OPTIONS = [
  { value: "s", label: "Nhỏ" },
  { value: "m", label: "Vừa" },
  { value: "l", label: "Lớn" },
];

const GUIDE_MARKUP = `
  <span class="om-kitchen-guide__eyebrow">Ca bếp đang nhẹ</span>
  <h2>Ít đơn đang chờ xử lý</h2>
  <p>Theo dõi thời gian chờ, ưu tiên nhận đơn mới và đánh dấu món hoàn thành ngay khi bếp ra món.</p>
  <ul>
    <li>F: bật/tắt Chế độ Bếp</li>
    <li>Esc: thoát Chế độ Bếp</li>
    <li>Chọn món ở thanh tóm tắt để cuộn đến đơn liên quan</li>
  </ul>
`;

const isKitchenMode = () => Boolean(document.querySelector(".om-container--focus"));

const setNativeSelectValue = (select, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set;

  if (setter) setter.call(select, value);
  else select.value = value;

  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const updateSegmentedState = (control) => {
  const select = control.querySelector("select");
  if (!select) return;

  control.querySelectorAll(".om-size-segmented__btn").forEach((button) => {
    const active = button.dataset.value === select.value;
    button.classList.toggle("om-size-segmented__btn--active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
};

const enhanceSizeControl = () => {
  const control = document.querySelector(".om-container--focus .om-size-control");
  if (!control) return;

  const select = control.querySelector("select");
  if (!select) return;

  control.classList.add("om-size-control--segmented");
  select.classList.add("om-size-control__native-select");
  select.setAttribute("tabindex", "-1");

  let segmented = control.querySelector(".om-size-segmented");
  if (!segmented) {
    segmented = document.createElement("div");
    segmented.className = "om-size-segmented";
    segmented.setAttribute("role", "group");
    segmented.setAttribute("aria-label", "Cỡ thẻ món");
    control.appendChild(segmented);
  }

  if (segmented.dataset.ready !== "true") {
    segmented.innerHTML = "";

    CHIP_SIZE_OPTIONS.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "om-size-segmented__btn";
      button.dataset.value = option.value;
      button.textContent = option.label;
      button.addEventListener("click", () => {
        setNativeSelectValue(select, option.value);
        updateSegmentedState(control);
        window.requestAnimationFrame(() => {
          enhanceSizeControl();
          enhanceSparseKitchenLayout();
        });
      });
      segmented.appendChild(button);
    });

    segmented.dataset.ready = "true";
  }

  updateSegmentedState(control);
};

const enhanceSparseKitchenLayout = () => {
  const container = document.querySelector(".om-container--focus");
  const content = container?.querySelector(".om-content");
  const grid = content?.querySelector(".om-grid");

  if (!container || !content || !grid) return;

  const orderCards = Array.from(grid.querySelectorAll(":scope > .om-card-wrapper"));
  const sparse = orderCards.length > 0 && orderCards.length <= 2;

  grid.classList.toggle("om-grid--sparse", sparse);
  content.classList.toggle("om-content--kitchen-sparse", sparse);

  let guide = content.querySelector(":scope > .om-kitchen-guide");

  if (!sparse) {
    guide?.remove();
    return;
  }

  if (!guide) {
    guide = document.createElement("aside");
    guide.className = "om-kitchen-guide";
    guide.setAttribute("aria-label", "Gợi ý vận hành bếp");
    guide.innerHTML = GUIDE_MARKUP;
    content.appendChild(guide);
  }
};

const cleanupWhenLeavingKitchen = () => {
  if (isKitchenMode()) return;

  document.querySelectorAll(".om-size-control--segmented").forEach((control) => {
    control.classList.remove("om-size-control--segmented");
    control.querySelector("select")?.classList.remove("om-size-control__native-select");
    control.querySelector(".om-size-segmented")?.remove();
  });

  document.querySelectorAll(".om-grid--sparse").forEach((grid) => {
    grid.classList.remove("om-grid--sparse");
  });

  document.querySelectorAll(".om-content--kitchen-sparse").forEach((content) => {
    content.classList.remove("om-content--kitchen-sparse");
  });

  document.querySelectorAll(".om-kitchen-guide").forEach((guide) => guide.remove());
};

const enhanceKitchenDisplay = () => {
  if (!isKitchenMode()) {
    cleanupWhenLeavingKitchen();
    return;
  }

  enhanceSizeControl();
  enhanceSparseKitchenLayout();
};

let scheduled = false;
const scheduleEnhancement = () => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhanceKitchenDisplay();
  });
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", scheduleEnhancement);
  window.addEventListener("hashchange", scheduleEnhancement);

  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "value"],
  });
}
