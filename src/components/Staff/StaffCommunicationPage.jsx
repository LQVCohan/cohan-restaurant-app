import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { getStaffWorkspacePath } from "@/utils/frontendRoleAccess";

const StaffCommunicationPage = () => {
  const { user } = useContext(AuthContext) || {};
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const threadId = location.state?.threadId || params.get("threadId") || null;

  return (
    <Navigate
      to={getStaffWorkspacePath(user)}
      replace
      state={{
        openStaffMessenger: true,
        threadId,
      }}
    />
  );
};

export default StaffCommunicationPage;
