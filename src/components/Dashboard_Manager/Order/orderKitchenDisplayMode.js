const CLASS_NAME = "kitchen-display-active";

const syncKitchenClass = () => {
  if (typeof document === "undefined") return;
  document.body.classList.toggle(
    CLASS_NAME,
    Boolean(document.querySelector(".om-container--focus")),
  );
};

let rafId = 0;
const scheduleSync = () => {
  if (