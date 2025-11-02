// src/utils/flyToOrder.js
// Tạo hiệu ứng "bay" từ 1 element sang order panel
export function flyToOrder(fromEl, toEl) {
  if (!fromEl || !toEl) return;

  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();

  const ghost = document.createElement("div");
  ghost.className = "pos-fly-ghost";
  ghost.style.position = "fixed";
  ghost.style.left = fromRect.left + "px";
  ghost.style.top = fromRect.top + "px";
  ghost.style.width = fromRect.width + "px";
  ghost.style.height = fromRect.height + "px";
  ghost.style.zIndex = 9999;
  ghost.style.pointerEvents = "none";

  document.body.appendChild(ghost);

  // điểm đến: chỗ top của right panel + chút offset
  const dx =
    toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
  const dy = toRect.top + 48 - (fromRect.top + fromRect.height / 2);

  requestAnimationFrame(() => {
    ghost.style.transform = `translate(${dx}px, ${dy}px) scale(.25)`;
    ghost.style.opacity = "0";
  });

  setTimeout(() => {
    ghost.remove();
  }, 500);
}
