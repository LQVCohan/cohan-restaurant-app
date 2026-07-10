const STYLE_ID = "cohan-table-360-only-style";
const OBSERVER_KEY = "__cohanTable360OnlyObserver";
const READY_ATTR = "data-table-360-ready";
const LEGACY_DRAFT_PREFIX = "cohan.modalDraft.v1:table:add-table-modal:";

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const clearLegacyAddTableDrafts = () => {
  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(LEGACY_DRAFT_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    });
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [data-table-legacy-3d="true"] {
      display: none !important;
    }

    .tm-table-card .btn-mini--360 {
      border-color: rgba(18, 109, 97, 0.28) !important;
      background: linear-gradient(180deg, #f1faf7, #e7f5f0) !important;
      color: #126d61 !important;
    }

    .tm-table-card .btn-mini--360:hover {
      border-color: rgba(18, 109, 97, 0.48) !important;
      background: #dff1eb !important;
    }

    .tm-modal--add-table.table-360-add-modal {
      width: min(720px, calc(100vw - 32px)) !important;
      max-height: min(760px, 90dvh) !important;
      overflow: hidden !important;
      border: 1px solid rgba(213, 199, 180, 0.88) !important;
      border-radius: 24px !important;
      background: linear-gradient(180deg, #fffdf8, #f8f5ee) !important;
      box-shadow: 0 30px 80px rgba(31, 42, 43, 0.28) !important;
    }

    .table-360-add-modal > .modal-header {
      padding: 15px 18px !important;
      border-bottom-color: rgba(213, 199, 180, 0.72) !important;
      background: rgba(255, 253, 248, 0.96) !important;
    }

    .table-360-add-modal .tm-form--add-table {
      gap: 14px !important;
      padding: 18px !important;
      overflow-y: auto !important;
      background:
        radial-gradient(circle at 100% 0%, rgba(18, 109, 97, 0.08), transparent 20rem),
        linear-gradient(180deg, rgba(255, 253, 248, 0.96), rgba(248, 245, 238, 0.92)) !important;
    }

    .table-360-add-modal .tm-form-header--add-table {
      display: grid !important;
      grid-template-columns: auto minmax(0, 1fr) !important;
      align-items: center !important;
      gap: 12px !important;
      margin: 0 !important;
      padding: 0 2px !important;
    }

    .table-360-add-modal .tm-add-table-intro__icon {
      display: inline-grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(18, 109, 97, 0.18);
      border-radius: 14px 14px 14px 6px;
      background: #e9f5f1;
      color: #126d61;
      font-size: 1.15rem;
    }

    .table-360-add-modal .tm-form-header--add-table h4 {
      margin: 0 !important;
      color: #24303f !important;
      font-size: 1.06rem !important;
      font-weight: 850 !important;
      letter-spacing: -0.03em !important;
    }

    .table-360-add-modal .tm-form-header--add-table p {
      margin: 3px 0 0 !important;
      max-width: 58ch;
      color: #667085 !important;
      font-size: 0.79rem !important;
      line-height: 1.45 !important;
    }

    .table-360-add-modal .tm-form-section--basic {
      padding: 15px !important;
      border: 1px solid rgba(213, 199, 180, 0.82) !important;
      border-radius: 17px !important;
      background: rgba(255, 255, 255, 0.72) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88) !important;
    }

    .table-360-add-modal .tm-form-grid {
      gap: 13px 14px !important;
    }

    .table-360-add-modal .tm-field input,
    .table-360-add-modal .tm-field select {
      min-height: 44px !important;
      border-radius: 12px !important;
      background: #fff !important;
    }

    .table-360-add-modal .tm-add-table-360-note {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 11px;
      padding: 12px 13px;
      border: 1px solid rgba(18, 109, 97, 0.18);
      border-radius: 15px;
      background: linear-gradient(135deg, #edf7f3, #fbfdfc);
    }

    .table-360-add-modal .tm-add-table-360-note__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 46px;
      min-height: 30px;
      border-radius: 9px;
      background: #126d61;
      color: #fff;
      font-size: 0.72rem;
      font-weight: 850;
      letter-spacing: 0.02em;
    }

    .table-360-add-modal .tm-add-table-360-note strong {
      display: block;
      color: #24303f;
      font-size: 0.82rem;
    }

    .table-360-add-modal .tm-add-table-360-note p {
      margin: 2px 0 0;
      color: #667085;
      font-size: 0.72rem;
      line-height: 1.4;
    }

    .table-360-add-modal .tm-add-table-footer {
      gap: 9px !important;
      padding: 13px 18px !important;
      border-top-color: rgba(213, 199, 180, 0.72) !important;
      background: rgba(255, 253, 248, 0.97) !important;
    }

    .table-360-add-modal .tm-add-table-footer button {
      min-width: 104px !important;
      min-height: 42px !important;
      border-radius: 12px !important;
    }

    @media (max-width: 640px) {
      .tm-modal--add-table.table-360-add-modal {
        width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        border: 0 !important;
        border-radius: 0 !important;
      }

      .table-360-add-modal .tm-form--add-table {
        padding: 14px 12px calc(18px + env(safe-area-inset-bottom)) !important;
      }

      .table-360-add-modal .tm-form-header--add-table {
        align-items: start !important;
      }

      .table-360-add-modal .tm-form-grid {
        grid-template-columns: 1fr !important;
      }

      .table-360-add-modal .tm-add-table-footer {
        padding: 10px 12px calc(10px + env(safe-area-inset-bottom)) !important;
      }

      .table-360-add-modal .tm-add-table-footer button {
        flex: 1 1 0 !important;
        min-height: 46px !important;
      }
    }
  `;
  document.head.appendChild(style);
};

const hideLegacyNode = (node) => {
  if (!node) return;
  node.setAttribute("data-table-legacy-3d", "true");
  node.setAttribute("aria-hidden", "true");
  if ("disabled" in node) node.disabled = true;
};

const enhanceHeaderActions = (root) => {
  root.querySelectorAll(".tm-container button").forEach((button) => {
    if (normalizeText(button.textContent) === "mô phỏng 3d") {
      hideLegacyNode(button);
    }
  });
};

const openTableDetails = (event, card) => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const detailButton = Array.from(card.querySelectorAll("button")).find((button) =>
    normalizeText(button.getAttribute("aria-label")).startsWith("mở cấu hình bàn"),
  );
  detailButton?.click();
};

const enhanceTableCards = (root) => {
  root.querySelectorAll(".tm-table-card").forEach((card) => {
    card.querySelectorAll(".tm-3d-badge").forEach(hideLegacyNode);

    const visualButton = card.querySelector(".btn-mini--3d, .btn-mini--360");
    if (!visualButton) return;

    const tableName =
      card.querySelector(".table-no")?.textContent?.trim() || "bàn hiện tại";
    const hasPanorama = Boolean(card.querySelector(".vr-badge"));
    visualButton.classList.remove("btn-mini--3d", "primary");
    visualButton.classList.add("btn-mini--360");
    visualButton.textContent = hasPanorama ? "Xem 360°" : "Thêm ảnh 360°";
    visualButton.setAttribute(
      "aria-label",
      hasPanorama
        ? `Mở không gian 360 của bàn ${tableName}`
        : `Thêm ảnh 360 cho bàn ${tableName}`,
    );
    visualButton.title = hasPanorama
      ? "Mở chi tiết để xem không gian 360° của bàn."
      : "Mở chi tiết để tải ảnh hoặc gắn liên kết 360°.";

    if (visualButton.getAttribute(READY_ATTR) !== "true") {
      visualButton.setAttribute(READY_ATTR, "true");
      visualButton.addEventListener(
        "click",
        (event) => openTableDetails(event, card),
        true,
      );
    }
  });
};

const enhanceAddTableModal = (root) => {
  const modal = root.matches?.(".tm-modal--add-table")
    ? root
    : root.querySelector(".tm-modal--add-table");
  if (!modal) return;

  modal.classList.add("table-360-add-modal");
  const modalTitle = modal.querySelector(":scope > .modal-header, .modal-header");
  if (modalTitle && normalizeText(modalTitle.textContent).includes("thêm bàn")) {
    const titleNode = modalTitle.querySelector("h1, h2, h3, h4, strong, span") || modalTitle;
    if (titleNode.childElementCount === 0) titleNode.textContent = "Thêm bàn";
  }

  const header = modal.querySelector(".tm-form-header--add-table");
  if (header) {
    const title = header.querySelector("h4");
    const description = header.querySelector("p");
    if (title) title.textContent = "Tạo vị trí phục vụ mới";
    if (description) {
      description.textContent =
        "Nhập thông tin vận hành của bàn. Ảnh không gian 360° được bổ sung sau khi tạo.";
    }
    if (!header.querySelector(".tm-add-table-intro__icon")) {
      const icon = document.createElement("span");
      icon.className = "tm-add-table-intro__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "🪑";
      header.prepend(icon);
      const copy = document.createElement("div");
      Array.from(header.children)
        .filter((child) => child !== icon)
        .forEach((child) => copy.appendChild(child));
      header.appendChild(copy);
    }
  }

  modal.querySelectorAll(".tm-template-preview").forEach(hideLegacyNode);

  const form = modal.querySelector(".tm-form--add-table");
  const section = modal.querySelector(".tm-form-section--basic");
  if (form && section && !form.querySelector(".tm-add-table-360-note")) {
    const note = document.createElement("aside");
    note.className = "tm-add-table-360-note";
    note.setAttribute("aria-label", "Thiết lập ảnh không gian 360 độ");
    note.innerHTML = `
      <span class="tm-add-table-360-note__badge">360°</span>
      <div>
        <strong>Thêm ảnh không gian sau khi tạo bàn</strong>
        <p>Mở Chi tiết bàn để tải ảnh panorama hoặc gắn liên kết xem 360°.</p>
      </div>
    `;
    section.after(note);
  }

  const saveButton = modal.querySelector(".tm-add-table-footer button:last-child");
  if (saveButton && !normalizeText(saveButton.textContent).includes("đang")) {
    saveButton.textContent = "Tạo bàn";
  }
};

const enhanceDetailModal = (root) => {
  root.querySelectorAll(".talite-visual-card").forEach(hideLegacyNode);
  root.querySelectorAll(".talite-group").forEach((group) => {
    if (normalizeText(group.textContent).includes("cấu hình mô phỏng")) {
      hideLegacyNode(group);
    }
  });
};

const enhanceCustomerPreview = (root) => {
  root.querySelectorAll(".visual-preview-trigger").forEach((button) => {
    const label = button.getAttribute("aria-label") || "";
    button.setAttribute(
      "aria-label",
      label.replace(/hình ảnh hoặc không gian 3d/gi, "ảnh hoặc không gian 360°"),
    );
  });
  root.querySelectorAll(".table-visual-preview a, .table-visual-preview p").forEach((node) => {
    if (normalizeText(node.textContent).includes("mô hình 3d")) {
      hideLegacyNode(node);
    }
  });
};

export const enhanceTable360OnlyExperience = (root = document.body) => {
  if (!root?.querySelectorAll) return;
  enhanceHeaderActions(root);
  enhanceTableCards(root);
  enhanceAddTableModal(root);
  enhanceDetailModal(root);
  enhanceCustomerPreview(root);
};

export const installTable360OnlyExperience = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[OBSERVER_KEY]) return;

  clearLegacyAddTableDrafts();
  ensureStyles();

  let scheduled = false;
  const run = () => {
    scheduled = false;
    enhanceTable360OnlyExperience(document.body);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(run);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window[OBSERVER_KEY] = observer;
  schedule();
};

export const __testables = {
  normalizeText,
  clearLegacyAddTableDrafts,
  enhanceTableCards,
  enhanceAddTableModal,
  STYLE_ID,
  OBSERVER_KEY,
};