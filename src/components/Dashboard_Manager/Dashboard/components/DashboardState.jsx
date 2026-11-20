import React from "react";
import { AlertCircle, CheckCircle2, Clock3, Inbox } from "lucide-react";

const ICONS = {
  loading: Clock3,
  error: AlertCircle,
  empty: Inbox,
  clear: CheckCircle2,
};

export default function DashboardState({ state, title, children }) {
  const Icon = ICONS[state];

  return (
    <div className={`dashboard-state dashboard-state--${state}`}>
      <Icon className="dashboard-state__icon" size={18} aria-hidden="true" />
      <div className="dashboard-state__content">
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}
