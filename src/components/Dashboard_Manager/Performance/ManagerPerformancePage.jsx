import React, { useContext, useMemo } from "react";
import { AuthContext } from "@/context/AuthContext";
import ManagerPerformancePanel from "./ManagerPerformancePanel";

const ManagerPerformancePage = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const restaurantId = useMemo(() => restaurants?.[0]?.id || "", [restaurants]);

  return (
    <div className="dashboard-container fade-in">
      <ManagerPerformancePanel restaurantId={restaurantId} />
    </div>
  );
};

export default ManagerPerformancePage;
