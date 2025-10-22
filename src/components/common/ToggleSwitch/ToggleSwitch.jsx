import React from "react";
import "./ToggleSwitch.scss";

export default function ToggleSwitch({ checked = false, onChange }) {
  return (
    <button
      type="button"
      className={`toggle-switch ${checked ? "active" : ""}`}
      onClick={() => onChange?.(!checked)}
      aria-pressed={checked}
      aria-label="Bật/tắt"
    />
  );
}
