import React from "react";
import { SearchX } from "lucide-react";
import CustomerCard from "./CustomerCard";
import "./CustomerList.scss";

const CustomerList = ({ customers, loading, onCustomerClick }) => {
  if (loading) {
    return React.createElement(
      "div",
      { className: "cl-grid" },
      Array.from({ length: 