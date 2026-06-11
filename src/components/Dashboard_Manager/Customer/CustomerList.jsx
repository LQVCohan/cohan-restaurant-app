import React from "react";
import { SearchX } from "lucide-react";
import CustomerCard from "./CustomerCard";
import "./CustomerList.scss";
import "./CustomerWorkspacePolish.scss";

const CustomerList = ({ customers, loading, onCustomerClick }) => {
  if (loading) {
    return <div className="cl-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="cl-skeleton-card"><div className="cl-sk-header"><