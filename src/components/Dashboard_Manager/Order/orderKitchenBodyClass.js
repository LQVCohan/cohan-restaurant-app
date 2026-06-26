const KITCHEN_BODY_CLASS = "kitchen-display-active";

const syncKitchenDisplayClass = () => {
  if (typeof document === "undefined") return;
  const active = Boolean(document.querySelector(".om-container--focus"));
  document.body.classList.toggle(KITCHEN_BODY_CLASS, active);
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", syncKitchenDisplayClass);
  window.addEventListener("hashchange", syncKitchenDisplayClass);

  const observer = new MutationObserver(syncKitchenDisplayClass);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  syncKitchenDisplayClass();
}

export default syncKitchenDisplayClass;
