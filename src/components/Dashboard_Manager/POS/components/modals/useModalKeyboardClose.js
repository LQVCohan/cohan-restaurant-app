import { useEffect } from "react";

export default function useModalKeyboardClose({
  isOpen,
  onClose,
  disabled = false,
}) {
  useEffect(() => {
    if (!isOpen || disabled) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, isOpen, onClose]);
}
