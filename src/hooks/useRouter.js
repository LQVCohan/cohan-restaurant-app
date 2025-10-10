// src/hooks/useRouter.js
import { useLocation, useNavigate } from "react-router-dom";

export const useRouter = () => {
  const navigateRR = useNavigate();
  const location = useLocation();

  const navigate = (path, options = {}) => {
    localStorage.setItem("last_visited_route", location.pathname);
    navigateRR(path, options);
  };

  const goBack = () => {
    const last = localStorage.getItem("last_visited_route") || "/";
    navigateRR(last, { replace: true });
  };

  return {
    currentRoute: location.pathname,
    navigate,
    goBack,
  };
};
