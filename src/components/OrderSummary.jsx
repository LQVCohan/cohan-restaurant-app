import React from "react";

const OrderSummary = ({ selectedItems, timeArrival, onConfirm }) => {
  const total = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="summary-modal">
      <h2>Xác nhận đơn hàng</h2>
      <ul>
        {selectedItems.map((item, index) => (
          <li key={index}>
            {item.itemName} x {item.quantity} - {item.price * item.quantity} VND
          </li>
        ))}
      </ul>
      <p>Tổng tiền: {total} VND</p>
      <p>Thời gian đến: {timeArrival}</p>
      <button onClick={onConfirm}>OK</button>
    </div>
  );
};

export default OrderSummary;
