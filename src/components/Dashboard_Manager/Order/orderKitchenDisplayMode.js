const KITCHEN_BODY_CLASS = "kitchen-display-active";

const syncKitchenDisplayClass = () => {
  if (typeof document === "undefined") return;

  const isActive = Boolean(document.querySelector(".om-container--focus"));
  document.body.classList.toggle(KITCHEN_BODY_CLASS, isActive);
};

let scheduled = false;
const scheduleSync = () => {
  if (scheduled) return;
 