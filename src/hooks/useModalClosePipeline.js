import { useCallback, useEffect } from "react";

export default function useModalClosePipeline({
  isOpen,
  onClose,
  onBeforeClose,
  closeOnEscape = true,
  closeOnOverlay = true,
}) {
  const requestClose = useCallback(
    (reason = "programmatic") => {
      if (!isOpen) return;
      if (typeof onBeforeClose === "function") {
        const canClose = onBeforeClose(reason);
        if (canClose === false) return;
      }
      onClose?.(reason);
    },
    [isOpen, onBeforeClose, onClose],
  );

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      requestClose("escape");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOnEscape, isOpen, requestClose]);

  const onBackdropMouseDown = useCallback(
    (e) => {
      if (!closeOnOverlay) return;
      if (e.target !== e.currentTarget) return;
      requestClose("overlay");
    },
    [closeOnOverlay, requestClose],
  );

  return {
    requestClose,
    onBackdropMouseDown,
  };
}
