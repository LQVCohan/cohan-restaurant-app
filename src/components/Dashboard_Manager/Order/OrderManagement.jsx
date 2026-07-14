import React from "react";
import OrderManagementCore from "./OrderManagementCore";
import OrderFutureOrdersDock from "./components/OrderFutureOrdersDock";

export default function OrderManagement() {
  return (
    <>
      <OrderManagementCore />
      <OrderFutureOrdersDock />
    </>
  );
}
