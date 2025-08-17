import React, { useState, useEffect } from "react";
import "../../Dashboard_Manager/Styles/OrderModal.scss";

const OrderModal = ({ table, onClose, onUpdateStatus }) => {
  const [activeTab, setActiveTab] = useState("info");
  const [orderItems, setOrderItems] = useState([
    { id: 1, name: "Salad Caesar", price: 120000, quantity: 2 },
    { id: 2, name: "Nước cam tươi", price: 45000, quantity: 2 },
  ]);
  const [menuItems, setMenuItems] = useState([
    {
      id: 1,
      name: "Salad Caesar",
      description: "Salad tươi với sốt Caesar đặc biệt",
      price: 120000,
      category: "appetizer",
      image: "https://via.placeholder.com/80x80",
    },
    {
      id: 2,
      name: "Súp bí đỏ",
      description: "Súp bí đỏ thơm ngon, bổ dưỡng",
      price: 80000,
      category: "appetizer",
      image: "https://via.placeholder.com/80x80",
    },
  ]);
  const [selectedCategory, setSelectedCategory] = useState("appetizer");
  const [menuSearch, setMenuSearch] = useState("");
  const [guestCount, setGuestCount] = useState(4);
  const [orderNote, setOrderNote] = useState("");
  const [showOrderNote, setShowOrderNote] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const categories = [
    { id: "appetizer", name: "🥗 Khai vị" },
    { id: "main", name: "🍖 Món chính" },
    { id: "drink", name: "🥤 Đồ uống" },
    { id: "dessert", name: "🍰 Tráng miệng" },
  ];

  const calculateBill = () => {
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const vat = subtotal * 0.1;
    const total = subtotal + vat;
    return { subtotal, vat, total };
  };

  const updateItemQuantity = (itemId, change) => {
    setOrderItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newQuantity = Math.max(0, item.quantity + change);
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (itemId) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa món này?")) {
      setOrderItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const addMenuItem = (menuItem) => {
    const existingItem = orderItems.find((item) => item.id === menuItem.id);
    if (existingItem) {
      updateItemQuantity(menuItem.id, 1);
    } else {
      setOrderItems((prev) => [...prev, { ...menuItem, quantity: 1 }]);
    }
  };

  const filteredMenuItems = menuItems.filter(
    (item) =>
      item.category === selectedCategory &&
      item.name.toLowerCase().includes(menuSearch.toLowerCase())
  );

  const handleConfirmOrder = () => {
    alert("Đơn hàng đã được xác nhận!");
    onClose();
  };

  const handlePayment = () => {
    alert("Thanh toán thành công!");
    onUpdateStatus(table.id, "available");
    onClose();
  };

  const { subtotal, vat, total } = calculateBill();

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content order-modal">
        <div className="modal-header">
          <h3 className="modal-title">Bàn {table?.id}</h3>
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeTab === "info" ? "active" : ""}`}
              onClick={() => setActiveTab("info")}
            >
              📋 Thông tin
            </button>
            <button
              className={`modal-tab ${activeTab === "menu" ? "active" : ""}`}
              onClick={() => setActiveTab("menu")}
            >
              🍽️ Gọi món
            </button>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Table Info Tab */}
        {activeTab === "info" && (
          <div className="modal-body">
            <TableInfoTab
              table={table}
              guestCount={guestCount}
              setGuestCount={setGuestCount}
              orderItems={orderItems}
              updateItemQuantity={updateItemQuantity}
              removeItem={removeItem}
              bill={{ subtotal, vat, total }}
              onPayment={handlePayment}
            />
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === "menu" && (
          <div className="modal-body">
            <MenuTab
              guestCount={guestCount}
              setGuestCount={setGuestCount}
              orderNote={orderNote}
              setOrderNote={setOrderNote}
              showOrderNote={showOrderNote}
              setShowOrderNote={setShowOrderNote}
              menuSearch={menuSearch}
              setMenuSearch={setMenuSearch}
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              menuItems={filteredMenuItems}
              onAddItem={addMenuItem}
              orderItems={orderItems}
            />
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleConfirmOrder}>
            Xác nhận đơn hàng
          </button>
        </div>
      </div>
    </div>
  );
};
const TableInfoTab = ({
  table,
  guestCount,
  setGuestCount,
  orderItems,
  updateItemQuantity,
  removeItem,
  bill,
  onPayment,
}) => {
  const getStatusBadgeClass = (status) => {
    const classes = {
      available: "available",
      occupied: "occupied",
      reserved: "reserved",
      cleaning: "cleaning",
    };
    return classes[status] || "available";
  };

  const getStatusText = (status) => {
    const texts = {
      available: "Trống",
      occupied: "Có khách",
      reserved: "Đã đặt",
      cleaning: "Dọn dẹp",
    };
    return texts[status] || "Trống";
  };

  return (
    <>
      <div className="table-info-header">
        <div
          className={`table-status-badge ${getStatusBadgeClass(table.status)}`}
        >
          {getStatusText(table.status)}
        </div>
        <div className="table-time-info">
          <span className="time-label">Thời gian:</span>
          <span className="time-value">{table.time || "0 phút"}</span>
        </div>
        <div className="guest-count">
          <span className="guest-label">Số khách:</span>
          <input
            type="number"
            className="guest-input"
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
            min="1"
            max="20"
          />
        </div>
      </div>

      <div className="current-order">
        <h4 className="section-title">Món đã gọi</h4>
        <div className="ordered-items">
          {orderItems.map((item) => (
            <div key={item.id} className="ordered-item">
              <div className="item-info">
                <h5 className="item-name">{item.name}</h5>
                <span className="item-price">
                  {item.price.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <div className="item-controls">
                <button
                  className="qty-btn minus"
                  onClick={() => updateItemQuantity(item.id, -1)}
                >
                  -
                </button>
                <span className="qty-display">{item.quantity}</span>
                <button
                  className="qty-btn plus"
                  onClick={() => updateItemQuantity(item.id, 1)}
                >
                  +
                </button>
                <button
                  className="remove-btn"
                  onClick={() => removeItem(item.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bill-summary">
        <h4 className="section-title">Tổng kết hóa đơn</h4>
        <div className="bill-details">
          <div className="bill-row">
            <span>Tạm tính:</span>
            <span>{bill.subtotal.toLocaleString("vi-VN")}đ</span>
          </div>
          <div className="bill-row">
            <span>VAT (10%):</span>
            <span>{bill.vat.toLocaleString("vi-VN")}đ</span>
          </div>
          <div className="bill-row total">
            <span>Tổng cộng:</span>
            <span>{bill.total.toLocaleString("vi-VN")}đ</span>
          </div>
        </div>
        <div className="bill-actions">
          <button className="btn btn-secondary">In hóa đơn</button>
          <button className="btn btn-success" onClick={onPayment}>
            Thanh toán
          </button>
        </div>
      </div>
    </>
  );
};

// Menu Tab Component
const MenuTab = ({
  guestCount,
  setGuestCount,
  orderNote,
  setOrderNote,
  showOrderNote,
  setShowOrderNote,
  menuSearch,
  setMenuSearch,
  categories,
  selectedCategory,
  setSelectedCategory,
  menuItems,
  onAddItem,
  orderItems,
}) => {
  const [itemNotes, setItemNotes] = useState({});
  const [showItemNotes, setShowItemNotes] = useState({});

  const toggleItemNote = (itemId) => {
    setShowItemNotes((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const updateItemNote = (itemId, note) => {
    setItemNotes((prev) => ({
      ...prev,
      [itemId]: note,
    }));
  };

  return (
    <>
      <div className="order-info">
        <div className="order-detail">
          <span className="detail-label">Số khách:</span>
          <input
            type="number"
            className="detail-input"
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
            min="1"
            max="20"
          />
        </div>
        <div className="order-detail">
          <span className="detail-label">Thời gian:</span>
          <span className="detail-value">
            {new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="order-detail">
          <button
            className={`note-btn ${showOrderNote ? "active" : ""}`}
            onClick={() => setShowOrderNote(!showOrderNote)}
          >
            📝 Ghi chú đơn hàng
          </button>
        </div>
      </div>

      {showOrderNote && (
        <div className="order-note-section">
          <textarea
            className="order-note-input"
            placeholder="Ghi chú cho bếp về đơn hàng này..."
            rows="3"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
          />
        </div>
      )}

      <div className="menu-search">
        <input
          type="text"
          className="search-input"
          placeholder="Tìm kiếm món ăn..."
          value={menuSearch}
          onChange={(e) => setMenuSearch(e.target.value)}
        />
        <span className="search-icon">🔍</span>
      </div>

      <div className="menu-categories">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`category-btn ${
              selectedCategory === category.id ? "active" : ""
            }`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="menu-items">
        {menuItems.map((item) => (
          <div key={item.id} className="menu-item">
            <img
              src={item.image}
              alt={item.name}
              className="menu-item__image"
            />
            <div className="menu-item__info">
              <h4 className="menu-item__name">{item.name}</h4>
              <p className="menu-item__desc">{item.description}</p>
              <span className="menu-item__price">
                {item.price.toLocaleString("vi-VN")}đ
              </span>
            </div>
            <div className="menu-item__actions">
              <button
                className="quantity-btn minus"
                onClick={() => {
                  /* Handle decrease */
                }}
              >
                -
              </button>
              <span className="quantity">
                {orderItems.find((orderItem) => orderItem.id === item.id)
                  ?.quantity || 0}
              </span>
              <button
                className="quantity-btn plus"
                onClick={() => onAddItem(item)}
              >
                +
              </button>
              <button
                className={`item-note-btn ${
                  showItemNotes[item.id] ? "active" : ""
                }`}
                onClick={() => toggleItemNote(item.id)}
                title="Ghi chú món"
              >
                📝
              </button>
            </div>
            {showItemNotes[item.id] && (
              <div className="item-note-section">
                <textarea
                  className="item-note-input"
                  placeholder="Ghi chú cho bếp về món này..."
                  rows="2"
                  value={itemNotes[item.id] || ""}
                  onChange={(e) => updateItemNote(item.id, e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="order-summary">
        <div className="summary-header">
          <h4>Tóm tắt đơn hàng</h4>
        </div>
        <div className="summary-items">
          {orderItems.length === 0 ? (
            <p className="empty-order">Chưa có món nào được chọn</p>
          ) : (
            orderItems.map((item) => (
              <div key={item.id} className="summary-item">
                <span className="summary-item-name">{item.name}</span>
                <span className="summary-item-qty">x{item.quantity}</span>
                <span className="summary-item-price">
                  {(item.price * item.quantity).toLocaleString("vi-VN")}đ
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default OrderModal;
