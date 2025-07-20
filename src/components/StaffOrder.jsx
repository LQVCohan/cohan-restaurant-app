import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const StaffOrder = () => {
  const { id: restaurantId } = useParams();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [image, setImage] = useState(null);
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get(`/api/orders/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOrders(
          res.data.filter((o) => o.restaurantId.toString() === restaurantId)
        );
      } catch (err) {
        console.error("Lỗi khi lấy danh sách order:", err);
      }
    };
    fetchOrders();
  }, [restaurantId, token]);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setImage(order.items.find((i) => i.image)?.image || null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    setImage(URL.createObjectURL(file));
    // Gửi hình ảnh lên server (cần API riêng)
  };

  const handleConfirmOrder = async () => {
    if (selectedOrder) {
      const hasKgItem = selectedOrder.items.some((i) =>
        i.itemName.includes("kg")
      );
      if (hasKgItem && !image) {
        alert("Vui lòng tải lên hình ảnh minh chứng!");
        return;
      }
      try {
        const updatedOrder = { ...selectedOrder, status: "confirmed", image };
        await axios.put(`/api/orders/${selectedOrder._id}`, updatedOrder, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSelectedOrder(null);
        setImage(null);
      } catch (err) {
        console.error("Lỗi khi xác nhận order:", err);
      }
    }
  };

  const handleRequestPayment50 = async () => {
    if (selectedOrder) {
      try {
        await axios.put(
          `/api/orders/pay50/${selectedOrder._id}`,
          { status: "paid50" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (err) {
        console.error("Lỗi khi yêu cầu thanh toán 50%:", err);
      }
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Danh sách Đơn hàng</h2>
      <div style={{ display: "flex", gap: "20px" }}>
        <div
          style={{
            width: "50%",
            border: "1px solid #ccc",
            padding: "10px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {orders.map((order) => (
            <div
              key={order._id}
              onClick={() => handleSelectOrder(order)}
              style={{
                cursor: "pointer",
                padding: "10px",
                borderBottom: "1px solid #ccc",
              }}
            >
              Bàn {order.tableId} - {order.status}
            </div>
          ))}
        </div>
        {selectedOrder && (
          <div
            style={{ width: "50%", border: "1px solid #ccc", padding: "10px" }}
          >
            <h3>Chi tiết Đơn hàng</h3>
            {selectedOrder.items.map((item, index) => (
              <div key={index}>
                {item.itemName} x{item.quantity} - ${item.price * item.quantity}{" "}
                <span>!</span>
              </div>
            ))}
            <p>Tổng: ${selectedOrder.totalAmount}</p>
            <p>
              Thời gian đến:{" "}
              {new Date(selectedOrder.arrivalTime).toLocaleString()}
            </p>
            {selectedOrder.items.some((i) => i.itemName.includes("kg")) && (
              <div>
                <input type="file" onChange={handleImageUpload} />
                {image && (
                  <img
                    src={image}
                    alt="Minh chứng"
                    style={{ maxWidth: "200px" }}
                  />
                )}
              </div>
            )}
            <button onClick={handleConfirmOrder} style={{ marginTop: "10px" }}>
              Xác nhận
            </button>
            <button
              onClick={handleRequestPayment50}
              style={{ marginTop: "10px" }}
            >
              Yêu cầu 50%
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffOrder;
