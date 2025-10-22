import { useContext } from "react";
import { NotificationContext } from "../context/NotificationProvider";

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Dễ debug khi quên bọc Provider
    throw new Error(
      "useNotification must be used within <NotificationProvider />"
    );
  }
  return ctx;
};
