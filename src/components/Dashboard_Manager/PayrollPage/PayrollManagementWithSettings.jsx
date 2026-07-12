import React, { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import PayrollManagement from "./PayrollManagement";
import PayrollSettingsControl from "./PayrollSettingsControl";

const PayrollManagementWithSettings = () => {
  const { user } = useContext(AuthContext) || {};
  const selection = useManagerRestaurantSelection();

  return (
    <div className="payroll-settings-shell">
      <PayrollSettingsControl
        restaurantId={selection.selectedRestaurantId || null}
        restaurantName={selection.selectedRestaurant?.name || ""}
        actor={user}
      />
      <PayrollManagement />
    </div>
  );
};

export default PayrollManagementWithSettings;
