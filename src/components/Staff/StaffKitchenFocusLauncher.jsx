import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import "./StaffKitchenFocusLauncher.scss";

export const STAFF_KITCHEN_FOCUS_BODY_CLASS = "staff-kitchen-focus-active";
const FOCUS_TARGET_SELECTOR = ".staff-kitchen-page__venue";

export default function StaffKitchenFocusLauncher() {
  const location = useLocation();
  const [portalTarget, setPortalTarget] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const isKitchenRoute = location.pathname.startsWith("/staff/kitchen");

  useEffect(() => {
    if (!isKitchenRoute) {
      setPortalTarget(null);
      setFocusMode(false);
      return undefined;
    }

    const findTarget = () => {
      const nextTarget = document.querySelector(FOCUS_TARGET_SELECTOR);
      setPortalTarget((current) => (current === nextTarget ? current : nextTarget));
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isKitchenRoute]);

  useEffect(() => {
    if (!focusMode) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.classList.add(STAFF_KITCHEN_FOCUS_BODY_CLASS);
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setFocusMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove(STAFF_KITCHEN_FOCUS_BODY_CLASS);
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode]);

  if (!isKitchenRoute || !portalTarget) return null;

  const label = focusMode ? "Thoát chế độ tập trung" : "Mở chế độ tập trung";

  return createPortal(
    <button
      type="button"
      className={`staff-kitchen-page__focus-toggle ${focusMode ? "is-active" : ""}`}
      onClick={() => setFocusMode((value) => !value)}
      aria-label={label}
      aria-pressed={focusMode}
      aria-keyshortcuts={focusMode ? "Escape" : undefined}
      title={focusMode ? "Thoát màn hình tập trung (Esc)" : "Mở màn hình Bếp / Bar toàn màn hình"}
    >
      {focusMode ? (
        <Minimize2 size={18} aria-hidden="true" />
      ) : (
        <Maximize2 size={18} aria-hidden="true" />
      )}
      <span>{focusMode ? "Thoát tập trung" : "Chế độ tập trung"}</span>
    </button>,
    portalTarget,
  );
}
