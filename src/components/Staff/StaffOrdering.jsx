import React, { useState, useMemo } from "react";
import {
  Search,
  Grid,
  Coffee,
  MessageSquare,
  UserCircle,
  ShoppingCart,
  Bell,
  Star,
  UserPlus,
  X,
} from "lucide-react";

import "./StaffOrdering.scss";
// Giữ nguyên import của bạn
import NotificationBell from "./NotificationBell";

import { MOCK_CUSTOMERS, INITIAL_TABLES } from "../data/mockData";

// Components con
import TableMap from "./TableMap";
import MenuOrdering from "./MenuOrdering";
import CartBottomSheet from "./CartBottomSheet";
import ContactsView from "./ContactsView";
import NotificationsView from "./NotificationsView";
import StaffProfile from "./StaffProfile";

export default function StaffOrdering() {
  const [activeTab, setActiveTab] = useState("tables");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId],
  );

  const [cart, setCart] = useState([
    {
      id: "C1",
      itemId: "M2",
      name: "Lẩu Thái Tomyum",
      prep: "Ít cay",
      serveOrder: "Mang ra cùng lúc",
      quantity: 1,
      price: 350000,
      status: "cooking",
      printed: true,
      hasPhoto: true,
    },
    {
      id: "C2",
      itemId: "M4",
      name: "Salad Cá Hồi",
      prep: "Sốt chanh dây",
      serveOrder: "Khai vị (Mang ra trước)",
      quantity: 1,
      price: 120000,
      status: "pending",
      printed: false,
      hasPhoto: false,
    },
  ]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const customerResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return MOCK_CUSTOMERS.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery),
    );
  }, [searchQuery]);

  const handleAssignCustomer = (customer) => {
    if (!selectedTableId)
      return alert("Vui lòng chọn 1 bàn trước khi gán khách!");
    setTables((prev) =>
      prev.map((t) =>
        t.id === selectedTableId
          ? {
              ...t,
              customer,
              status: t.status === "empty" ? "serving" : t.status,
            }
          : t,
      ),
    );
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleRemoveCustomer = () => {
    if (window.confirm("Bỏ gán khách hàng khỏi bàn này?")) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId ? { ...t, customer: null } : t,
        ),
      );
    }
  };

  const handleAddToCart = (item, prep, serveOrder) => {
    if (item.stock <= 0) return alert("Món này đã hết hàng!");
    const newItem = {
      id: "C" + Date.now(),
      itemId: item.id,
      name: item.name,
      prep: prep || "Mặc định",
      serveOrder,
      quantity: 1,
      price: item.price,
      status: "pending",
      printed: false,
      hasPhoto: false,
    };
    setCart([newItem, ...cart]);
  };

  const handleTableAction = (action) => {
    if (action === "move")
      alert(`Đang chuyển bàn cho ${selectedTable.name}...`);
    if (action === "merge") alert(`Đang gộp bàn cho ${selectedTable.name}...`);
    if (action === "checkout") setIsCartOpen(true);
  };

  const pendingCount = cart.filter((c) => c.status === "pending").length;

  return (
    <div className="staff-pos-layout">
      {/* HEADER TÌM KIẾM */}
      <header className="staff-pos-header">
        <div
          className={`search-container ${showSearchResults ? "active" : ""}`}
        >
          <div className="search-input-wrapper">
            <Search size={20} className="icon-search" />
            <input
              type="text"
              placeholder="Tìm khách (Tên/SĐT), món..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
            />
            {searchQuery && (
              <button className="btn-clear" onClick={() => setSearchQuery("")}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Kết quả tìm kiếm dạng Dropdown hiện đại */}
          {showSearchResults && customerResults.length > 0 && (
            <div className="search-results-dropdown">
              <div className="dropdown-title">Khách hàng thành viên</div>
              <div className="results-list">
                {customerResults.map((cus) => (
                  <div
                    key={cus.id}
                    className="search-result-item"
                    onClick={() => handleAssignCustomer(cus)}
                  >
                    <div className="cus-avatar">
                      <UserCircle size={24} />
                    </div>
                    <div className="cus-info">
                      <span className="cus-name">{cus.name}</span>
                      <span className="cus-phone">{cus.phone}</span>
                    </div>
                    <div className="cus-rank-badge">
                      <Star size={10} className="icon-star" /> Hạng {cus.rank}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nút chuông thông báo */}
        <div className="header-actions">
          {/* Giả sử component NotificationBell của bạn render một icon chuông, nếu không có bạn có thể thay bằng thẻ <button> */}
          <NotificationBell onViewAll={() => setActiveTab("notifications")} />
        </div>
      </header>

      {/* OVERLAY KHI TÌM KIẾM */}
      {showSearchResults && (
        <div
          className="search-overlay"
          onClick={() => setShowSearchResults(false)}
        ></div>
      )}

      {/* VÙNG NỘI DUNG CHÍNH (Scrollable) */}
      <main className="staff-pos-main">
        {activeTab === "tables" && (
          <TableMap
            tables={tables}
            onSelect={(t) => setSelectedTableId(t.id)}
            selectedTable={selectedTable}
            onTableAction={handleTableAction}
          />
        )}
        {activeTab === "menu" && (
          <MenuOrdering
            onAdd={handleAddToCart}
            searchQuery={searchQuery}
            selectedTable={selectedTable}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onRemoveCustomer={handleRemoveCustomer}
          />
        )}
        {activeTab === "contacts" && <ContactsView />}
        {activeTab === "notifications" && <NotificationsView />}
        {activeTab === "profile" && <StaffProfile />}
      </main>

      {/* GIỎ HÀNG NỔI (FLOATING CART BAR) */}
      {(activeTab === "menu" || activeTab === "tables") && selectedTable && (
        <div className="floating-cart-wrapper">
          <button
            className="btn-floating-cart"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="cart-left">
              <div className="icon-cart-wrap">
                <ShoppingCart size={20} />
                {cart.length > 0 && (
                  <span className="cart-badge">{cart.length}</span>
                )}
              </div>
              <div className="cart-text">
                <span className="table-info">
                  {selectedTable.name}{" "}
                  {selectedTable.customer && `• ${selectedTable.customer.name}`}
                </span>
                <span className="status-info">
                  {pendingCount > 0
                    ? `${pendingCount} món đang chờ`
                    : "Xem Order / Tính tiền"}
                </span>
              </div>
            </div>
            <div className="cart-right">
              <span className="total-text">Xem</span>
            </div>
          </button>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="staff-pos-bottom-nav">
        <button
          className={`nav-item ${activeTab === "tables" ? "active" : ""}`}
          onClick={() => setActiveTab("tables")}
        >
          <div className="nav-icon-wrap">
            <Grid size={22} />
          </div>
          <span>Bàn</span>
        </button>
        <button
          className={`nav-item ${activeTab === "menu" ? "active" : ""}`}
          onClick={() => setActiveTab("menu")}
        >
          <div className="nav-icon-wrap">
            <Coffee size={22} />
          </div>
          <span>Menu</span>
        </button>
        <button
          className={`nav-item ${activeTab === "contacts" ? "active" : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          <div className="nav-icon-wrap">
            <MessageSquare size={22} />
          </div>
          <span>Liên lạc</span>
        </button>
        <button
          className={`nav-item ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          <div className="nav-icon-wrap">
            <Bell size={22} />
          </div>
          <span>Thông báo</span>
        </button>
        <button
          className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <div className="nav-icon-wrap">
            <UserCircle size={22} />
          </div>
          <span>Cá nhân</span>
        </button>
      </nav>

      {/* BOTTOM SHEET GIỎ HÀNG */}
      {isCartOpen && (
        <CartBottomSheet
          cart={cart}
          setCart={setCart}
          onClose={() => setIsCartOpen(false)}
          table={selectedTable}
        />
      )}
    </div>
  );
}
