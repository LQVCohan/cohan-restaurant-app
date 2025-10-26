import React from "react";
import "./TableItem.scss";
import Button from "../../../common/Button";
export default function TableItem({
  table,
  selected = false,
  onClick,
  onOpenActions,
}) {
  const { code, capacity, status, customerName, phone } = table;

  return (
    <div className="table-item-container">
      <Button
        type="button"
        className={[
          "table-item",
          `table-item--${status}`,
          selected && "table-item--selected",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onClick?.(table)}
      >
        <span
          className={[
            "table-status-indicator",
            `table-status-indicator--${status}`,
          ].join(" ")}
        />
        <strong className="table-code">{code}</strong>
        <span className="table-capacity">{capacity} chỗ</span>
        {customerName ? (
          <div className="table-customer-info">
            <div>{customerName}</div>
            {phone ? <div>{phone}</div> : null}
          </div>
        ) : null}

        <button
          type="button"
          className="table-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActions?.(table, e.currentTarget.getBoundingClientRect());
          }}
          aria-label="Mở menu"
        >
          •••
        </button>
      </Button>
    </div>
  );
}
