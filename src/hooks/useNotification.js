import { useContext } from "react";
import { NotificationContext } from "../context/NotificationContext";

// Custom hook to use notifications context
export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Easy debug when forgetting to wrap with NotificationProvider
    throw new Error(
      "useNotification must be used within <NotificationProvider />"
    );
  }
  return ctx;
};
