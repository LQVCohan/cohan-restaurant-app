import React from "react";
import { Tags } from "lucide-react";
import TableManagement from "./TableManagement";
import "./TableManagementSettingsEntry.scss";
import "./TableTypeManagementMobileFix.scss";

const TableManagementSettingsEntry = ({ onOpenTableSettings }) => (
  <div className="tm-settings-page">
    {onOpenTableSettings && (
      <div className="tm-settings-page__toolbar" aria-label="Thiết lập bàn ăn">
        <button
          type="button"
          className="tm-settings-page__button"
          onClick={onOpenTableSettings}
        >
          <Tags size={18} aria-hidden="true" />
          <span>Loại bàn &amp; không gian</span>
        </button>
      </div>
    )}
    <TableManagement />
  </div>
);

export default TableManagementSettingsEntry;
