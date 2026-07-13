const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

function polishServingVariantSection(root) {
  root.querySelectorAll("label").forEach((label) => {
    if (normalize(label.textContent) !== "Quy cách / Chế biến") return;
    label.textContent = "Cách phục vụ";
    const section = label.closest("div");
    if (!section || section.dataset.reportVariantPolished === "1") return;
    const buttons = [...section.querySelectorAll("button")];
    if (buttons.length !== 1) return;

    section.dataset.reportVariantPolished = "1";
    const modal = section.closest('[role="dialog"], [aria-modal="true"]') || root;
    const quantityLabel = [...modal.querySelectorAll("label")].find((node) =>
      normalize(node.textContent).startsWith("Số lượng"),
    );
    const mode = /kg/i.test(quantityLabel?.textContent || "")
      ? "Theo khối lượng"
      : "Theo phần";
    const hint = document.createElement("p");
    hint.className = "report-single-serving-hint";
    hint.textContent = `Đã chọn tự động · ${mode}`;
    Object.assign(hint.style, {
      margin: "8px 0 0",
      color: "#4f6a60",
      fontSize: "0.78rem",
      fontWeight: "700",
    });
    section.append(hint);
  });
}

function polishItemDetailTitle(root) {
  root.querySelectorAll("h1, h2, h3, header, [class*='title']").forEach((node) => {
    const text = normalize(node.textContent);
    if (text === "Chi tiết Order" || text === "Chi tiết order") {
      node.textContent = "Chi tiết món ăn";
    }
  });
}

function polishTechnicalCopy(root) {
  root.querySelectorAll("[role='dialog'] span, [role='dialog'] p").forEach((node) => {
    const text = normalize(node.textContent);
    if (text === "Final product") node.textContent = "Món hoàn thiện";
    if (text === "Processing") node.textContent = "Đang chế biến";
    if (text === "Completed") node.textContent = "Đã hoàn thành";
  });
}

function applyPolish() {
  polishServingVariantSection(document);
  polishItemDetailTitle(document);
  polishTechnicalCopy(document);
}

export function installReportPages26To29Ui() {
  if (typeof window === "undefined" || window.__cohanReport2629UiInstalled) return;
  window.__cohanReport2629UiInstalled = true;
  const schedule = () => window.requestAnimationFrame(applyPolish);
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
}
