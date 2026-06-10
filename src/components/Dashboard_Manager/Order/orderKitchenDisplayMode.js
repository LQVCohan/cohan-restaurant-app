const syncKitchenDisplayMode = () => {
  if (typeof document === "undefined") return;
  const active = Boolean(document.querySelector(".om-container--focus"));
  document.body.classList.toggle("kitchen-display-active", active);
};

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", syncKitchenDisplayMode);
  window.setInterval