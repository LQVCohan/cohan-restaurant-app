import React from "react";

const IncidentActionButtons = ({ item, isAccountant = false, onAction }) => {
  const actions = [];
  if (item?.canReview) actions.push({ key: "review", label: "Review" });
  if (item?.canWaive) actions.push({ key: "waive", label: "Waive" });
  if (item?.canMarkEligible) actions.push({ key: "eligible", label: "Mark eligible" });
  if (item?.canApplyScore) actions.push({ key: "apply", label: "Apply score" });

  if (isAccountant || actions.length === 0) {
    return <span className="incident-read-only">Bạn chỉ có quyền xem</span>;
  }

  return (
    <div className="incident-actions">
      {actions.map((action) => (
        <button key={action.key} className="btn-link" onClick={() => onAction(action.key, item)}>
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default IncidentActionButtons;
