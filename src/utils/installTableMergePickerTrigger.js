import {
  __testables as tableTransferMergeEnhancement,
  installTableTransferMergeEnhancement,
} from "./installTableTransferMergeEnhancement";

const OBSERVER_KEY = "__cohanTableMergePickerTriggerObserver";
const CLICK_HANDLER_KEY = "__cohanTableMergePickerTriggerClickHandler";
const BOUND_DATA_KEY = "tableMergePickerBound";
const TRIGGER_DATA_KEY = "tableMergePickerTrigger";
const REPLAY_DATA_KEY = "tableMergePickerReplay";

const getMergeGroup = (modal) =>
  Array.from(modal?.querySelectorAll?.(".talite-group") || []).find((group) => {
    const title = tableTransferMergeEnhancement.normalizeText(
      group.querySelector(".talite-group-header .talite-label, .talite-label")
        ?.textContent,
    );
    return title.includes("ghep") && title.includes("tach");
  });

const getMergeButton = (group) =>
  Array.from(group?.querySelectorAll?.("button") || []).find((button) => {
    const label = tableTransferMergeEnhancement.normalizeText(button.textContent);
    return (
      button.dataset[TRIGGER_DATA_KEY] === "true" ||
      label.includes("ghep ban") ||
      label.includes("chon ban")
    );
  });

const prepareTableMergePicker = (modal) => {
  const group = getMergeGroup(modal);
  const input = group?.querySelector("input.talite-input");
  let button = getMergeButton(group);
  if (!group || !input || !button) return null;

  if (button.dataset[BOUND_DATA_KEY] !== "true") {
    group.querySelectorAll(".cohan-merge-picker-hint").forEach((hint) => hint.remove());
    delete group.dataset.mergePickerReady;
    tableTransferMergeEnhancement.enhanceTableModal(modal);
    button = getMergeButton(group) || button;
    button.dataset[BOUND_DATA_KEY] = "true";
  }

  button.dataset[TRIGGER_DATA_KEY] = "true";
  const label = tableTransferMergeEnhancement.normalizeText(button.textContent);
  if (label === "ghep ban") button.textContent = "Chọn bàn";
  return button;
};

const prepareAllTableModals = () => {
  document
    .querySelectorAll(".talite-modal")
    .forEach((modal) => prepareTableMergePicker(modal));
};

export const installTableMergePickerTrigger = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  installTableTransferMergeEnhancement();
  prepareAllTableModals();

  window[OBSERVER_KEY]?.disconnect?.();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      prepareAllTableModals();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window[OBSERVER_KEY] = observer;

  const previousHandler = window[CLICK_HANDLER_KEY];
  if (previousHandler) document.removeEventListener("click", previousHandler, true);

  const handleClick = (event) => {
    const clickedButton = event.target?.closest?.("button");
    const modal = clickedButton?.closest?.(".talite-modal");
    if (!clickedButton || !modal || clickedButton.dataset.mergePickerBypass === "true") {
      return;
    }

    const group = getMergeGroup(modal);
    const trigger = getMergeButton(group);
    if (clickedButton !== trigger) return;

    const button = prepareTableMergePicker(modal) || clickedButton;
    if (button.dataset[REPLAY_DATA_KEY] === "true") {
      delete button.dataset[REPLAY_DATA_KEY];
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    button.dataset[REPLAY_DATA_KEY] = "true";
    queueMicrotask(() => button.click());
  };

  document.addEventListener("click", handleClick, true);
  window[CLICK_HANDLER_KEY] = handleClick;
};

export const __testables = {
  getMergeGroup,
  getMergeButton,
  prepareTableMergePicker,
  prepareAllTableModals,
  OBSERVER_KEY,
  CLICK_HANDLER_KEY,
};
