import React, { useMemo, useState } from "react";
import "./TablesGrid.scss";
import TableItem from "./TableItem";
import TableActions from "./TableActions";
import Input from "../../../common/Input";
import Button from "../../../common/Button";

const floorsSample = ["Tầng 1", "Tầng 2", "Khu VIP"];

export default function TableGrid({
  tables = [],
  floors = floorsSample,
  defaultFloor = 0,
  onSelectTable,
  onOpenTableInfo,
  onMoveTable,
  onMergeTable,
  onReserveTable,
  onFreeTable,
  onDeleteTableRequest,
}) {
  const [activeTab, setActiveTab] = useState(defaultFloor || 0);
  const [selectedId, setSelectedId] = useState(null);
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const f = floors[activeTab];
    return tables
      .filter((t) => (f ? t.floor === f : true))
      .filter((t) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const blob = `${t.code} ${t.customerName || ""} ${
          t.phone || ""
        }`.toLowerCase();
        return blob.includes(q);
      });
  }, [tables, activeTab, floors, search]);

  return (
    <div className="table-grid-container">
      <div className="table-grid-header">
        <div className="nav-tabs">
          {floors.map((label, idx) => (
            <button
              key={label}
              className={`nav-tab ${idx === activeTab ? "active" : ""}`}
              onClick={() => setActiveTab(idx)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="table-controls">
          <div style={{ width: 220 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm bàn / KH / SĐT…"
            />
          </div>
          <Button variant="secondary" onClick={() => setSearch("")}>
            Xóa lọc
          </Button>
        </div>
      </div>

      <div className="tables-grid">
        {filtered.map((t) => (
          <TableItem
            key={t.id}
            table={t}
            selected={t.id === selectedId}
            onClick={(tbl) => {
              setSelectedId(tbl.id);
              onSelectTable?.(tbl);
            }}
            onOpenActions={(tbl, rect) => {
              setSelectedId(tbl.id);
              setActionsAnchor({ ...rect, table: tbl });
            }}
          />
        ))}
      </div>

      <TableActions
        anchorRect={actionsAnchor}
        onClose={() => setActionsAnchor(null)}
        onOpenInfo={() => {
          onOpenTableInfo?.(actionsAnchor?.table);
          setActionsAnchor(null);
        }}
        onMoveTable={() => {
          onMoveTable?.(actionsAnchor?.table);
          setActionsAnchor(null);
        }}
        onMergeTable={() => {
          onMergeTable?.(actionsAnchor?.table);
          setActionsAnchor(null);
        }}
        onReserve={() => {
          onReserveTable?.(actionsAnchor?.table);
          setActionsAnchor(null);
        }}
        onFree={() => {
          onFreeTable?.(actionsAnchor?.table);
          setActionsAnchor(null);
        }}
        onDelete={() => {
          onDeleteTableRequest?.(actionsAnchor?.table);
          setActionsAnchor(null);
        }}
      />
    </div>
  );
}
