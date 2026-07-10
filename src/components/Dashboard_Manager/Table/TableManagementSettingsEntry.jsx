import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tags } from "lucide-react";
import TableManagement from "./TableManagement";
import "./TableManagementSettingsEntry.scss";
import "./TableTypeManagementMobileFix.scss";

const TableManagementSettingsEntry = ({ onOpenTableSettings }) => {
  const rootRef = useRef(null);
  const [controlsTarget, setControlsTarget] = useState(null);

  useLayoutEffect(() => {
    setControlsTarget(
      onOpenTableSettings
        ? rootRef.current?.querySelector(
            ".management-page-header .mph-controls-row",
          ) || null
        : null,
    );
  }, [onOpenTableSettings]);

  return (
    <div className="tm-settings-page" ref={rootRef}>
      <TableManagement />
      {onOpenTableSettings &&
        controlsTarget &&
        createPortal(
          <button
            type="button"
            className="mph-btn mph-btn--secondary tm-settings-page__button"
            onClick={onOpenTableSettings}
            title="Loại bàn & không gian"
            aria-label="Loại bàn & không gian"
          >
            <Tags size={17} aria-hidden="true" />
            <span>Loại bàn &amp; không gian</span>
          </button>,
          controlsTarget,
        )}
    </div>
  );
};

export default TableManagementSettingsEntry;
