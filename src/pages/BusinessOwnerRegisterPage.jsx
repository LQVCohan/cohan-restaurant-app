import React from "react";
import { Navigate } from "react-router-dom";

export default function BusinessOwnerRegisterPage() {
  return <Navigate to="/login" replace state={{ authMode: "register", registerMode: "brand" }} />;
}
