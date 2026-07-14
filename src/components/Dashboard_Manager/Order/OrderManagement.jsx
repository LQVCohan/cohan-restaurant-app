import React from "react";
import OrderManagementCore from "./OrderManagementCore";
import OrderFutureOrdersDock from "./components/OrderFutureOrdersDock";

export * from "./OrderManagementCore";

export default function OrderManagement() {
  return (
    <>
      <OrderManagementCore />
      <OrderFutureOrdersDock />
    </>
  );
}
