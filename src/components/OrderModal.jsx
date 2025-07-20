import React, { useState, useEffect } from "react";

const OrderModal = ({
  selectedTable,
  menu,
  selectedItems: initialItems,
  setSelectedItems: setParentSelectedItems,
  arrivalTime: initialArrivalTime,
  setArrivalTime: setParentArrivalTime,
  message,
  setMessage,
  chatMessages,
  tables,
  handleSendMessage,
  handleChangeTable,
  setShowOrderModal,
  usersOrdering = [],
  restaurantName = "NHÀ HÀNG ABC",
  managerName = "Quản lý XYZ",
  staffName = "Nhân viên ABC",
}) => {
  const [selectedCategory, setSelectedCategory] = useState(
    menu[0]?.category || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setLocalSelectedItems] = useState(initialItems);
  const now = new Date();
  const defaultTime = new Date(now.setHours(now.getHours() + 1))
    .toISOString()
    .slice(0, 16);
  const [arrivalTime, setLocalArrivalTime] = useState(
    initialArrivalTime || defaultTime
  );
  const [showSummary, setShowSummary] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentTimer, setPaymentTimer] = useState(600);
  const [qrCode, setQrCode] = useState("");
  const filteredMenu = menu.find(
    (cat) => cat.category === selectedCategory
  ) || { items: [] };
  const taxRate = 0.1;
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.price * (item.isFresh ? item.kg : item.quantity),
    0
  );
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  useEffect(() => {
    if (showPayment && paymentTimer > 0) {
      const interval = setInterval(
        () => setPaymentTimer((prev) => prev - 1),
        1000
      );
      return () => clearInterval(interval);
    } else if (paymentTimer === 0) {
      alert("Thời gian thanh toán hết hạn!");
      setShowPayment(false);
    }
  }, [showPayment, paymentTimer]);

  const handleAddItem = (item) => {
    setLocalSelectedItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.itemName === item.itemName);
      if (existingIndex !== -1) {
        const newItems = [...prev];
        newItems[existingIndex].quantity = newItems[existingIndex].quantity + 1;
        return newItems;
      }
      return [
        ...prev,
        { ...item, quantity: 1, kg: item.isFresh ? 1 : undefined },
      ];
    });
  };

  const handleQuantityChange = (index, delta) => {
    setLocalSelectedItems((prev) => {
      const newItems = [...prev];
      newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
      return newItems;
    });
  };

  const handleInputQuantity = (index, value) => {
    const num = parseInt(value, 10) || 1;
    setLocalSelectedItems((prev) => {
      const newItems = [...prev];
      newItems[index].quantity = Math.max(1, num);
      return newItems;
    });
  };

  const handleKgChange = (index, value) => {
    const num = parseFloat(value) || 1;
    setLocalSelectedItems((prev) => {
      const newItems = [...prev];
      newItems[index].kg = Math.max(0.1, num);
      return newItems;
    });
  };

  const handleRemoveItem = (index) => {
    setLocalSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const showPrice = (item) => {
    alert(`Giá: $${item.price}`);
  };

  const handlePreConfirm = () => {
    setParentSelectedItems(selectedItems);
    setParentArrivalTime(arrivalTime);
    setShowSummary(true);
  };

  const handleFinalConfirm = () => {
    setShowSummary(false);
    setShowPayment(true);
    setQrCode("https://example.com/qr-placeholder");
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    alert("Thanh toán thành công! Mã QR nhận bàn đã gửi.");
    setShowOrderModal(false);
  };

  const handleClose = (e) => {
    if (e.target === e.currentTarget) setShowOrderModal(false);
  };

  const sectionStyle = {
    background: "#f8f9fa",
    borderRadius: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    padding: "16px",
    marginBottom: "16px",
  };

  const filteredItems = filteredMenu.items.filter((item) =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.5)",
        zIndex: 999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
          width: "80%",
          maxWidth: "1000px",
          height: "80vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "#f0f0f0",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          <h4>Người đang order:</h4>
          {usersOrdering.map((user, idx) => (
            <p key={idx}>{user.name}</p>
          ))}
        </div>

        <h3>Đặt món cho bàn {selectedTable.tableNumber}</h3>

        {!showSummary && !showPayment && (
          <div style={{ display: "flex", height: "calc(100% - 100px)" }}>
            <div
              style={{
                width: "30%",
                borderRight: "1px solid #ccc",
                paddingRight: "10px",
                overflowY: "auto",
                ...sectionStyle,
              }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm món..."
                style={{ marginBottom: "10px", width: "100%", padding: "5px" }}
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ marginBottom: "10px", width: "100%", padding: "5px" }}
              >
                {menu.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.itemName}>
                      <td
                        onClick={() => showPrice(item)}
                        style={{ cursor: "pointer" }}
                      >
                        {item.itemName}
                      </td>
                      <td>
                        <button
                          style={{
                            borderRadius: "50%",
                            width: "30px",
                            height: "30px",
                          }}
                          onClick={() => handleAddItem(item)}
                        >
                          +
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ width: "70%", paddingLeft: "10px" }}>
              <div style={{ marginBottom: "10px", ...sectionStyle }}>
                <h4>Đổi bàn</h4>
                <select
                  value={selectedTable._id}
                  onChange={(e) => handleChangeTable(e.target.value)}
                  style={{ width: "100%", padding: "5px" }}
                >
                  <option value={selectedTable._id}>
                    Bàn {selectedTable.tableNumber}
                  </option>
                  {tables
                    .filter((t) => t._id !== selectedTable._id)
                    .map((t) => (
                      <option key={t._id} value={t._id}>
                        Bàn {t.tableNumber}
                      </option>
                    ))}
                </select>
              </div>
              <h4>Danh sách món đã chọn</h4>
              {selectedItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span
                    title={item.description}
                    style={{
                      background: "red",
                      color: "white",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: "10px",
                    }}
                  >
                    !
                  </span>
                  {item.image && (
                    <img
                      src={item.image}
                      alt="evidence"
                      style={{
                        width: "50px",
                        height: "50px",
                        marginRight: "10px",
                        border: "1px solid #ccc",
                      }}
                    />
                  )}
                  {item.itemName} - ${item.price}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginLeft: "auto",
                      gap: "5px",
                    }}
                  >
                    <button onClick={() => handleQuantityChange(index, -1)}>
                      -
                    </button>
                    {item.isFresh ? (
                      <input
                        type="number"
                        step="0.1"
                        value={item.kg}
                        onChange={(e) => handleKgChange(index, e.target.value)}
                        style={{
                          width: "60px",
                          textAlign: "center",
                          margin: "0 5px",
                        }}
                      />
                    ) : (
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleInputQuantity(index, e.target.value)
                        }
                        style={{
                          width: "40px",
                          textAlign: "center",
                          margin: "0 5px",
                        }}
                      />
                    )}
                    <button onClick={() => handleQuantityChange(index, 1)}>
                      +
                    </button>
                    <span>
                      ${item.price * (item.isFresh ? item.kg : item.quantity)}
                    </span>
                    <button onClick={() => handleRemoveItem(index)}>Xóa</button>
                  </div>
                </div>
              ))}
              <p>Thuế + VAT: ${tax}</p>
              <p>Tổng: ${total}</p>
              <input
                type="datetime-local"
                value={arrivalTime}
                onChange={(e) => setLocalArrivalTime(e.target.value)}
                style={{ marginTop: "10px", padding: "5px" }}
              />
              <button onClick={handlePreConfirm} style={{ marginTop: "10px" }}>
                Tiếp tục
              </button>
              <div style={{ ...sectionStyle }}>
                <h4>Chat</h4>
                {chatMessages.map((msg, idx) => (
                  <p key={idx}>
                    {msg.sender}: {msg.message}
                  </p>
                ))}
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Nhắn tin"
                  style={{ marginTop: "10px", padding: "5px", width: "70%" }}
                />
                <button onClick={handleSendMessage}>Gửi</button>
              </div>
            </div>
          </div>
        )}

        {showSummary && (
          <div style={{ textAlign: "center", ...sectionStyle }}>
            <h2 style={{ fontWeight: "bold", textTransform: "uppercase" }}>
              {restaurantName}
            </h2>
            <p>Quản lý: {managerName}</p>
            <p>Nhân viên nhận đơn: {staffName}</p>
            <p>Ngày nhận đơn: {new Date().toLocaleDateString()}</p>
            <p>Giờ đến: {new Date(arrivalTime).toLocaleString()}</p>
            <h4>Thống kê order</h4>
            {selectedItems.map((item) => (
              <div
                key={item.itemName}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                {item.image && item.isFresh && (
                  <img
                    src={item.image}
                    alt={item.itemName}
                    style={{
                      width: "50px",
                      height: "50px",
                      marginRight: "10px",
                    }}
                  />
                )}
                <span>
                  {item.itemName} - {item.isFresh ? item.kg : item.quantity}{" "}
                  {item.isFresh ? "KG" : ""} - ${item.price} - $
                  {item.price * (item.isFresh ? item.kg : item.quantity)}
                </span>
              </div>
            ))}
            <p>Thuế + VAT: ${tax}</p>
            <p>Số tiền cần thanh toán: ${total}</p>
            <button onClick={handleFinalConfirm}>Xác nhận đặt bàn</button>
          </div>
        )}

        {showPayment && (
          <div style={{ textAlign: "center", ...sectionStyle }}>
            <h3>
              Thanh toán 50% (${total / 2}) trong{" "}
              {Math.floor(paymentTimer / 60)}:{paymentTimer % 60} phút
            </h3>
            <img
              src={qrCode}
              alt="QR Thanh toán"
              style={{ width: "200px", height: "200px" }}
            />
            <button onClick={handlePaymentSuccess}>Xác nhận thanh toán</button>
          </div>
        )}

        <button
          onClick={() => setShowOrderModal(false)}
          style={{ marginTop: "10px" }}
        >
          Đóng
        </button>
      </div>
    </div>
  );
};

export default OrderModal;
