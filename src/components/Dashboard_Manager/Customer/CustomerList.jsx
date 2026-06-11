// src/pages/CustomerManagement/CustomerList.jsx
import React from "react";
import { SearchX } from "lucide-react";
import CustomerCard from "./CustomerCard";
import "./CustomerList.scss";
import "./CustomerWorkspaceDensity.scss";

const CustomerList = ({ customers, loading, onCustomerClick }) => {
  if (loading) {
    return (
      <div className="cl-grid">
        {Array.from