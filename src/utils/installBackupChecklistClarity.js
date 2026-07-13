const PAGE_SELECTOR = ".backup-management";
const OBSERVER_KEY = "__cohanBackupChecklistClarityObserver";

const REQUIRED_LABELS = new Map([
  ["Kiểm tra báo cáo cuối ngày", "Bắt buộc trước khi tải file"],
  ["Đối soát giao dịch", "Bắt buộc trước khi tải file"],
  ["Rà soát cấu hình quan trọng", "Bắt buộc trước khi tải file"],
]);

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const findFieldset = (page, legendTexts) =>
  [...page.querySelectorAll(".backup-management__check-scope-grid fieldset")].find(
    (fieldset) => legendTexts.includes(normalizeText(fieldset.querySelector("legend")?.textContent)),
  );

const findLabel = (fieldset, candidates) =>
  [...(fieldset?.querySelectorAll("label") || [])].find((label) => {
    const text = normalizeText(label.querySelector("span")?.childNodes?.[0]?.textContent || label.textContent);
    return candidates.includes(text);
  });

const replacePrimaryLabelText = (label, nextText) => {
  const span = label?.querySelector("span");
  if (!span) return;

  const textNode = [...span.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    if (textNode.textContent !== nextText) textNode.textContent = nextText;
    return;
  }

  span.prepend(document.createTextNode(nextText));
};

const ensureSmall = (label, text, className) => {
  const span = label?.querySelector("span");
  if (!span) return;

  let small = className ? span.querySelector(`small.${className}`) : null;
  if (!small) {
    small = [...span.querySelectorAll("small")].find(
      (candidate) => normalizeText(candidate.textContent) === normalizeText(text),
    );
  }
  if (!small) {
    small = document.createElement("small");
    span.appendChild(small);
  }
  if (className) small.classList.add(className);
  if (small.textContent !== text) small.textContent = text;
};

const ensureHelp = (fieldset, className, text) => {
  let help = fieldset.querySelector(`:scope > .${className}`);
  if (!help) {
    help = document.createElement("p");
    help.className = className;
    const firstLabel = fieldset.querySelector("label");
    fieldset.insertBefore(help, firstLabel || null);
  }
  if (help.textContent !== text) help.textContent = text;
};

const setManagedInputState = (label, { disabled, title }) => {
  const input = label?.querySelector('input[type="checkbox"]');
  if (!input) return;

  if (!input.dataset.backupBaseDisabled) {
    input.dataset.backupBaseDisabled = String(input.disabled);
  }

  const baseDisabled = input.dataset.backupBaseDisabled === "true";
  input.disabled = baseDisabled || disabled;
  input.title = title;
  label.classList.toggle("is-managed", disabled);
  label.setAttribute("aria-disabled", String(baseDisabled || disabled));
};

export const applyBackupChecklistClarity = (root = document) => {
  const page = root.querySelector(PAGE_SELECTOR);
  if (!page) return false;

  const checklistFieldset = findFieldset(page, ["Việc cần xác nhận", "Tiến độ sao lưu"]);
  const scopeFieldset = findFieldset(page, ["Phạm vi file cấu hình", "Phạm vi dự kiến"]);

  if (checklistFieldset) {
    const legend = checklistFieldset.querySelector("legend");
    if (legend && legend.textContent !== "Tiến độ sao lưu") {
      legend.textContent = "Tiến độ sao lưu";
    }

    ensureHelp(
      checklistFieldset,
      "backup-management__checklist-help",
      "Có thể lưu từng phần để ghi nhận tiến độ. Chỉ 3 bước bắt buộc phải được chọn và lưu trước khi tải file.",
    );

    for (const [labelText, helpText] of REQUIRED_LABELS) {
      const label = findLabel(checklistFieldset, [labelText]);
      if (!label) continue;
      label.classList.add("is-required-before-export");
      ensureSmall(label, helpText, "backup-checklist-required-note");
    }

    const exportedLabel = findLabel(checklistFieldset, [
      "Chuẩn bị file sao lưu",
      "File sao lưu đã được tạo",
    ]);
    if (exportedLabel) {
      replacePrimaryLabelText(exportedLabel, "File sao lưu đã được tạo");
      ensureSmall(
        exportedLabel,
        "Hệ thống tự đánh dấu sau khi tải file",
        "backup-checklist-managed-note",
      );
      setManagedInputState(exportedLabel, {
        disabled: true,
        title: "Mục này được hệ thống tự động cập nhật sau khi tạo file.",
      });
    }

    const operatorLabel = findLabel(checklistFieldset, [
      "Ghi nhận người thực hiện",
      "Đã ghi nhận người tải file",
    ]);
    if (operatorLabel) {
      replacePrimaryLabelText(operatorLabel, "Đã ghi nhận người tải file");
      ensureSmall(
        operatorLabel,
        "Hệ thống tự ghi nhận tài khoản tải file",
        "backup-checklist-managed-note",
      );
      setManagedInputState(operatorLabel, {
        disabled: true,
        title: "Mục này được hệ thống tự động ghi nhận theo tài khoản tải file.",
      });
    }

    const safeCopyLabel = findLabel(checklistFieldset, ["Lưu file ở nơi an toàn"]);
    if (safeCopyLabel) {
      ensureSmall(
        safeCopyLabel,
        "Xác nhận thủ công sau khi file đã được tạo",
        "backup-checklist-post-export-note",
      );
      const exportedInput = exportedLabel?.querySelector('input[type="checkbox"]');
      setManagedInputState(safeCopyLabel, {
        disabled: !exportedInput?.checked,
        title: exportedInput?.checked
          ? "Đánh dấu sau khi bạn đã lưu file vào nơi an toàn."
          : "Chỉ có thể xác nhận sau khi hệ thống đã tạo file sao lưu.",
      });
    }
  }

  if (scopeFieldset) {
    const legend = scopeFieldset.querySelector("legend");
    if (legend && legend.textContent !== "Phạm vi dự kiến") {
      legend.textContent = "Phạm vi dự kiến";
    }
    ensureHelp(
      scopeFieldset,
      "backup-management__scope-help",
      "Không cần chọn hết. Đây là nhóm dữ liệu dự kiến; hạng mục thực tế đưa vào file được chọn ở bước 02.",
    );
  }

  const saveButton = [...page.querySelectorAll("button")].find((button) =>
    normalizeText(button.textContent).includes("Lưu checklist hiện tại")
      || normalizeText(button.textContent).includes("Lưu tiến độ hiện tại"),
  );
  if (saveButton) {
    const textNode = [...saveButton.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode && textNode.textContent !== "Lưu tiến độ hiện tại") {
      textNode.textContent = "Lưu tiến độ hiện tại";
    }
    saveButton.title = "Lưu phần đã kiểm tra; chưa cần hoàn tất toàn bộ checklist.";
  }

  const actionHelp = page.querySelector(".backup-management__run-action-help");
  if (actionHelp) {
    actionHelp.textContent =
      "Bắt đầu tạo lần kiểm tra mới; Lưu chỉ ghi nhận tiến độ hiện tại; Tải file chỉ mở sau khi 3 bước bắt buộc đã được lưu. Hai mục hệ thống sẽ tự hoàn tất sau khi tạo file.";
  }

  return true;
};

export const installBackupChecklistClarity = ({ root = document } = {}) => {
  if (!root || typeof MutationObserver === "undefined") return () => {};

  if (typeof window !== "undefined") {
    window[OBSERVER_KEY]?.disconnect?.();
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      applyBackupChecklistClarity(root);
    };
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  };

  applyBackupChecklistClarity(root);

  const observer = new MutationObserver(schedule);
  observer.observe(root.body || root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  if (typeof window !== "undefined") {
    window[OBSERVER_KEY] = observer;
  }

  return () => {
    observer.disconnect();
    if (typeof window !== "undefined" && window[OBSERVER_KEY] === observer) {
      delete window[OBSERVER_KEY];
    }
  };
};

export const __testables = { OBSERVER_KEY };

export default installBackupChecklistClarity;
