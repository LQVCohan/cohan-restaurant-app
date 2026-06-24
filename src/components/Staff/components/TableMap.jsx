import React, { useContext, useMemo, useState } from "react";
import {
  Users,
  Star,
  ArrowRight as ArrowRightLeft,
  Grid2X2 as Combine,
  Receipt,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { getStaffOrderingPermissions } from "../staffOrderingPermissions";
import "./TableMap.scss";

export default function TableMap({
  tables,
  onSelect,
  selectedTable,
  onTableAction,
  floors = [],
}) {
  const { user } = useContext(AuthContext) || {};
  const permissions = useMemo(() => {
    return getStaffOrderingPermissions(user);
  }, [user]);

  const [floor, setFloor] = useState((floors && floors[0]) || "");

  React.useEffect(() => {
    if (!floor && floors?.length) setFloor(floors[0]);
    if (floor && floors?.length && !floors.includes(floor)) setFloor(floors[0]);
  }, [floors, floor]);

  const currentFloorTables = tables.filter((t) => t.floor === floor);

  const servingCount = currentFloorTables.filter(
    (t) => t.status !== "empty",
  ).length;

  return (
    <div className="staff-pos-tables">
      <div className="floor-header">
        <div>
          <p className="floor-eyebrow">Sơ đồ phục vụ</p>
          <h2>Chọn bàn / khu vực</h2>
        </div>
        <div className="floor-actions">
          <div className="floor-summary">
            <Users size={16} />
            <span>
              {servingCount}/{currentFloorTables.length} bàn đang phục vụ
            </span>
          </div>
          <div className="floor-tabs">
            {floors.map((f) => (
              <button
                key={f}
                className={f === floor ? "active" : ""}
                type="button"
                onClick={() => setFloor(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-grid">
        {currentFloorTables.map((table) => {
          const isSelected = selectedTable?.id === table.id;
          const canQuickOrder = permissions.canCreateOrder || permissions.canManageOrders;
          const canRequestPayment = permissions.canRequestPayment || permissions.canManagePayments;
          const canMergeSplit = permissions.canMergeSplitTables || permissions.canManageTables;

          return (
            <button
              key={table.id}
              type="button"
              className={`table-card status-${table.status} ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(table)}
            >
              <div className="table-card__top">
                <span className="table-code">{table.code}</span>
                <span className="table-status">{table.statusLabel || table.status}</span>
              </div>
              <div className="table-card__body">
                <div className="table-shape">
                  <Star size={18} />
                </div>
                <div>
                  <strong>{table.capacity || 4} khách</strong>
                  <p>{table.serverName || "Chưa gán nhân viên"}</p>
                </div>
              </div>
              <div className="table-card__actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => onTableAction?.("order", table)} disabled={!canQuickOrder}>
                  <Receipt size={14} />
                  Gọi món
                </button>
                <button type="button" onClick={() => onTableAction?.("payment", table)} disabled={!canRequestPayment}>
                  <ArrowRightLeft size={14} />
                  Thanh toán
                </button>
                <button type="button" onClick={() => onTableAction?.("merge", table)} disabled={!canMergeSplit}>
                  <Combine size={14} />
                  Ghép/tách
                </button>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
