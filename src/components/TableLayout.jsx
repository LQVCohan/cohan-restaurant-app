import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import OrderModal from "./OrderModal";
import { AuthContext } from "../context/AuthContext"; // Import AuthContext to check user role

const TableLayout = () => {
  const { id: restaurantId } = useParams();
  const canvasRef = useRef(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [menu, setMenu] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [arrivalTime, setArrivalTime] = useState("");
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const socket = io("http://localhost:3001");
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  const { user } = React.useContext(AuthContext); // Get user role from AuthContext
  const isCustomer = user?.role === "customer"; // Check if current user is customer

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await axios.get(`/api/tables/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTables(res.data);
      } catch (err) {
        console.error("Lỗi khi lấy danh sách bàn:", err);
      }
    };
    if (restaurantId) fetchTables();
  }, [restaurantId, token]);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        console.log("Fetching menu from:", `/api/restaurants/menu`);
        const res = await axios.get("/api/restaurants/menu", {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("Menu fetched:", res.data);
        setMenu(res.data);
      } catch (err) {
        console.error("Lỗi khi lấy menu:", err);
      }
    };
    fetchMenu();
  }, [token]);

  useEffect(() => {
    socket.on("tableUpdate", (updatedTable) => {
      setTables((tables) =>
        tables.map((t) => (t._id === updatedTable._id ? updatedTable : t))
      );
    });
    socket.on("chatMessage", (msg) => {
      setChatMessages((msgs) => [...msgs, msg]);
    });
    socket.on("orderCancelled", (data) => {
      if (data.tableId === selectedTable?._id) setShowOrderModal(false);
    });
    socket.on("paymentRequest", (data) => {
      alert(data.message);
    });
    return () => {
      socket.off("tableUpdate");
      socket.off("chatMessage");
      socket.off("orderCancelled");
      socket.off("paymentRequest");
    };
  }, [socket, selectedTable?._id]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedTable = tables.find((table) => {
      if (table.shape === "rectangle") {
        return (
          x >= table.position.x &&
          x <= table.position.x + 50 &&
          y >= table.position.y &&
          y <= table.position.y + 50
        );
      } else {
        const dx = x - (table.position.x + 25);
        const dy = y - (table.position.y + 25);
        return Math.sqrt(dx * dx + dy * dy) <= 25;
      }
    });

    if (clickedTable && token) {
      // For customers, only allow clicks on available tables
      if (isCustomer && clickedTable.status !== "available") {
        return; // Skip if not available
      }
      if (clickedTable.status === "pendingPayment") {
        if (confirm("Bàn đang chờ thanh toán. Nhắc tôi khi bàn trống?")) {
          socket.emit("remindWhenFree", { tableId: clickedTable._id });
        }
        return;
      }
      setSelectedTable(clickedTable);
      setShowOrderModal(true);
    }
  };

  const handleAddItem = (item) => {
    setSelectedItems((prev) => [...prev, { ...item, quantity: 1 }]);
  };

  const handleRemoveItem = (index) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmOrder = async () => {
    if (!arrivalTime || selectedItems.length === 0) {
      alert("Vui lòng chọn thời gian đến và ít nhất một món ăn!");
      return;
    }
    const orderData = {
      tableId: selectedTable._id,
      restaurantId,
      items: selectedItems,
      totalAmount: selectedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
      customerId: JSON.parse(atob(token.split(".")[1])).id,
      arrivalTime,
    };
    try {
      const res = await axios.post("/api/orders/create", orderData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowOrderModal(false);
      setSelectedItems([]);
      setArrivalTime("");
      socket.emit("orderPlaced", {
        tableId: selectedTable._id,
        order: res.data,
      });
    } catch (err) {
      console.error("Lỗi khi đặt món:", err);
    }
  };

  const handleSendMessage = () => {
    if (message && selectedTable) {
      socket.emit("chatMessage", {
        tableId: selectedTable._id,
        message,
        sender: "customer",
      });
      setMessage("");
    }
  };

  const handleChangeTable = async (newTableId) => {
    if (selectedItems.length > 0) {
      const orderData = {
        tableId: newTableId,
        restaurantId,
        items: selectedItems,
        totalAmount: selectedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        ),
        customerId: JSON.parse(atob(token.split(".")[1])).id,
        arrivalTime,
      };
      try {
        await axios.put(
          `/api/orders/changeTable/${selectedTable._id}`,
          { newTableId, orderData },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSelectedTable(tables.find((t) => t._id === newTableId));
      } catch (err) {
        console.error("Lỗi khi đổi bàn:", err);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tables.forEach((table) => {
      // For customers, show all tables but color non-available in red
      ctx.beginPath();
      if (table.image) {
        const img = new Image();
        img.src = table.image;
        img.onload = () => {
          ctx.drawImage(img, table.position.x, table.position.y, 50, 50);
        };
      } else if (table.shape === "rectangle") {
        ctx.rect(table.position.x, table.position.y, 50, 50);
      } else {
        ctx.arc(
          table.position.x + 25,
          table.position.y + 25,
          25,
          0,
          Math.PI * 2
        );
      }
      ctx.fillStyle = table.status === "available" ? "green" : "red"; // For customers: available green, others red
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "white";
      ctx.font = "14px Arial";
      ctx.fillText(
        `Bàn ${table.tableNumber}`,
        table.position.x + 10,
        table.position.y + 30
      );
    });
  }, [tables]);

  return (
    <div className="table-layout" style={{ position: "relative" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
        Sơ đồ nhà hàng
      </h2>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: "1px solid #ccc", display: "block", margin: "0 auto" }}
        onClick={handleCanvasClick}
      />
      {showOrderModal && selectedTable && (
        <OrderModal
          selectedTable={selectedTable}
          menu={menu}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          arrivalTime={arrivalTime}
          setArrivalTime={setArrivalTime}
          message={message}
          setMessage={setMessage}
          chatMessages={chatMessages}
          tables={tables}
          handleAddItem={handleAddItem}
          handleRemoveItem={handleRemoveItem}
          handleConfirmOrder={handleConfirmOrder}
          handleSendMessage={handleSendMessage}
          handleChangeTable={handleChangeTable}
          setShowOrderModal={setShowOrderModal}
        />
      )}
    </div>
  );
};

export default TableLayout;
