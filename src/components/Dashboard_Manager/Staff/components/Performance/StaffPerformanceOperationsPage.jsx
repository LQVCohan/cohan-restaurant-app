import React, { useMemo, useState } from "react";
import { CircleDollarSign, ShieldCheck } from "lucide-react";
import StaffPerformancePolicyPage from "./StaffPerformancePolicyPage";
import CashierShiftReconciliationModal from "./CashierShiftReconciliationModal";
import { resolveEffectivePerformanceRestaurantId } from "./StaffPerformancePage";
import "./StaffPerformanceOperationsPage.scss";

export default function StaffPerformanceOperationsPage(props) {
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const restaurantId = resolveEffectivePerformanceRestaurantId(
    props.selectedRestaurant,
  );
  const restaurantName = useMemo(
    () =>
      props.restaurantList?.find(
        (restaurant) => String(restaurant.id) === String(restaurantId),
      )?.name || "Nhà hàng hiện tại",
    [props.restaurantList, restaurantId],
  );

  return (
    <div className="staff-performance-operations-shell">
      <section className="cashier-reconciliation-launcher">
        <div className="cashier-reconciliation-launcher__copy">
          <span className="cashier-reconciliation-launcher__icon" aria-hidden="true">
            <CircleDollarSign size={19} />
          </span>
          <div>
            <strong>Đối soát ca thu ngân</strong>
            <p>
              Mở két, theo dõi tiền mặt, chốt ca và xác minh trách nhiệm trước khi
              dùng chênh lệch làm bằng chứng hiệu suất.
            </p>
          </div>
        </div>
        <div className="cashier-reconciliation-launcher__guard">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Không tự động trừ điểm</span>
        </div>
        <button
          type="button"
          className="cashier-reconciliation-launcher__button"
          disabled={!restaurantId}
          onClick={() => setReconciliationOpen(true)}
          title={
            restaurantId
              ? "Mở quản lý đối soát ca thu ngân"
              : "Chọn một nhà hàng cụ thể trước khi đối soát"
          }
        >
          <CircleDollarSign size={17} aria-hidden="true" />
          Quản lý chốt quỹ
        </button>
      </section>

      <StaffPerformancePolicyPage {...props} />

      {reconciliationOpen ? (
        <CashierShiftReconciliationModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          employees={props.employees || []}
          onClose={() => setReconciliationOpen(false)}
        />
      ) : null}
    </div>
  );
}
