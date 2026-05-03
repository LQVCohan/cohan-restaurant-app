import React, { useContext, useMemo } from "react";
import { useManagerPerformanceDashboard } from "@/hooks/useManagerPerformanceDashboard";
import IncidentReviewQueue from "./IncidentReviewQueue";
import { AuthContext } from "@/context/AuthContext";
import ManagerPerformancePanel from "./ManagerPerformancePanel";
import AppealReviewPanel from "./AppealReviewPanel";

const ManagerPerformancePage = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const restaurantId = useMemo(() => restaurants?.[0]?.id || "", [restaurants]);

  const { refetch } = useManagerPerformanceDashboard({ restaurantId, enabled: !!restaurantId });

  return (
    <div className="dashboard-container fade-in">
      <ManagerPerformancePanel restaurantId={restaurantId} />
      <IncidentReviewQueue restaurantId={restaurantId} onMutationSuccess={refetch} />
      <AppealReviewPanel restaurantId={restaurantId} canReview />
    </div>
  );
};

export default ManagerPerformancePage;
