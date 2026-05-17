import React, { useContext, useMemo, useState } from "react";
import {
  Users,
  Star,
  ArrowRightLeft,
  Combine,
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
        <div className="floor-stats">
          <h3>Sơ đồ bàn</h3>
          <p>
            Đang phục vụ:{" "}
            <strong>
              {servingCount}/{currentFloorTables.length}
            </strong>{" "}
            bàn
          </p>
        </div>
      </div>

      <div className="floor-selector-scroll">
        {(floors || []).map((f) => (
          <button
            key={f}
            className={`floor-chip ${floor === f ? "active" : ""}`}
            onClick={() => setFloor(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {!floors?.length ? (
        <div className="staff-inline-state">Chưa có khu vực bàn đang hoạt động.</div>
      ) : null}

      <div className="table-grid">
        {currentFloorTables.map((table) => {
          const isSelected = selectedTable?.id === table.id;
          const showQuickActions = isSelected && table.status !== "empty";

          return (
            <div
              key={table.id}
              className={`table-card-wrapper ${isSelected ? "selected" : ""} status-${table.status}`}
              onClick={() => onSelect(table)}
            >
              <div className="table-card-main">
                <div className="table-header">
                  <span className="table-name">{table.name}</span>
                  <div className="status-indicator"></div>
                </div>

                <div className="table-body">
                  <div className="guest-count">
                    <Users size={14} />
                    <span>
                      {table.guests > 0 ? `${table.guests} khách` : "Bàn trống"}
                    </span>
                  </div>

                  {table.customer && (
                    <div className="customer-tag">
                      <Star size={12} className="star-icon" />
                      <span className="truncate">{table.customer.name}</span>
                    </div>
                  )}
                </div>

                <div className="table-status-text">
                  {table.status === "empty" && "Sẵn sàng"}
                  {table.status === "serving" && "Đang phục vụ"}
                  {table.status === "checkout" && "Chờ thanh toán"}
                </div>
              </div>

              <div
                className={`table-quick-actions ${showQuickActions ? "expanded" : ""}`}
              >
                <div className="actions-container">
                  {permissions.canMoveOrMerge && (
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!permissions.canMoveOrMerge) return;
                        onTableAction("move");
                      }}
                    >
                      <div className="icon-wrap">
                        <ArrowRightLeft size={16} />
                      </div>
                      <span>Chuyển</span>
                    </button>
                  )}
                  {permissions.canMoveOrMerge && (
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!permissions.canMoveOrMerge) return;
                        onTableAction("merge");
                      }}
                    >
                      <div className="icon-wrap">
                        <Combine size={16} />
                      </div>
                      <span>Gộp</span>
                    </button>
                  )}
                  {permissions.canCheckout && (
                    <button
                      className="action-btn btn-checkout"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!permissions.canCheckout) return;
                        onTableAction("checkout");
                      }}
                    >
                      <div className="icon-wrap">
                        <Receipt size={16} />
                      </div>
                      <span>Tính tiền</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
