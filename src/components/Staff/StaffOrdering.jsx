import React, { useState, useMemo } from "react";
import {
  Search,
  Grid,
  Coffee,
  MessageSquare,
  UserCircle,
  ShoppingCart,
  Camera,
  Printer,
  CheckCircle2,
  Clock,
  MapPin,
  LogOut,
  RefreshCw,
  Banknote,
  X,
  Plus,
  Minus,
  ChefHat,
  ChevronRight,
  UserPlus,
  Star,
  AlertTriangle,
  ArrowRightLeft,
  Combine,
  Receipt,
  Scissors,
  Trash2,
  Tag,
  Bell,
  PhoneCall,
  MessageCircle,
} from "lucide-react";
import "./StaffOrdering.scss";
import NotificationBell from "./NotificationBell";

// --- MOCK DATA ---
const MOCK_FLOORS = ["Tầng 1", "Tầng 2", "Sân Vườn", "Phòng VIP"];
const MENU_CATEGORIES = [
  "Tất cả",
  "🔥 Phổ biến",
  "🥩 Món Nướng",
  "🍲 Lẩu",
  "🍹 Nước uống",
  "🍰 Tráng miệng",
];

const MOCK_CUSTOMERS = [
  {
    id: "CUS1",
    name: "Trần Văn Khách",
    phone: "0901234567",
    rank: "Vàng",
    points: 1250,
    note: "Dị ứng đậu phộng",
  },
  {
    id: "CUS2",
    name: "Lê Thị Khách Víp",
    phone: "0987654321",
    rank: "Kim Cương",
    points: 5400,
    note: "Thích ăn nhạt",
  },
];

const INITIAL_TABLES = [
  {
    id: "T1",
    name: "Bàn 01",
    floor: "Tầng 1",
    status: "serving",
    guests: 4,
    customer: MOCK_CUSTOMERS[0],
  },
  {
    id: "T2",
    name: "Bàn 02",
    floor: "Tầng 1",
    status: "empty",
    guests: 0,
    customer: null,
  },
  {
    id: "T3",
    name: "Bàn 03",
    floor: "Tầng 1",
    status: "waiting_pay",
    guests: 2,
    customer: null,
  },
  {
    id: "V1",
    name: "VIP 01",
    floor: "Phòng VIP",
    status: "empty",
    guests: 0,
    customer: null,
  },
];

const MOCK_MENU = [
  {
    id: "M1",
    name: "Bò Wagyu Nướng Đá",
    price: 550000,
    stock: 12,
    category: "🥩 Món Nướng",
    prep: ["Chín vừa", "Chín kỹ", "Tái"],
  },
  {
    id: "M2",
    name: "Lẩu Thái Tomyum",
    price: 350000,
    stock: 5,
    category: "🍲 Lẩu",
    prep: ["Ít cay", "Cay nhiều"],
  },
  {
    id: "M3",
    name: "Nước Ép Dưa Hấu",
    price: 45000,
    stock: 0,
    category: "🍹 Nước uống",
    prep: ["Ít đá", "Không đường"],
  },
  {
    id: "M4",
    name: "Salad Cá Hồi",
    price: 120000,
    stock: 8,
    category: "🔥 Phổ biến",
    prep: ["Sốt mè rang", "Sốt chanh dây"],
  },
];

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
    alert(`Đã gán khách ${customer.name} vào ${selectedTable.name}`);
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
    alert(`Đã thêm ${item.name} vào giỏ!`);
  };

  const handleTableAction = (action) => {
    if (action === "move")
      alert(
        `Đang chuyển bàn cho ${selectedTable.name}... Vui lòng chọn bàn đích.`,
      );
    if (action === "merge")
      alert(
        `Đang gộp bàn cho ${selectedTable.name}... Vui lòng chọn bàn muốn gộp chung.`,
      );
    if (action === "checkout") {
      setIsCartOpen(true);
      alert(`Đang tạo yêu cầu thanh toán cho ${selectedTable.name}.`);
    }
  };

  const pendingCount = cart.filter((c) => c.status === "pending").length;

  return (
    <div className="staff-pos-wrapper">
      <header className="staff-pos-header">
        <div className="search-box">
          <Search size={20} className="icon-search" />
          <input
            type="text"
            placeholder="Tìm khách (Tên/SĐT), món ăn..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />
          {showSearchResults && customerResults.length > 0 && (
            <div className="search-dropdown">
              <div className="dropdown-title">Khách hàng thành viên</div>
              {customerResults.map((cus) => (
                <div
                  key={cus.id}
                  className="search-item"
                  onClick={() => handleAssignCustomer(cus)}
                >
                  <div className="cus-info">
                    <span className="cus-name">
                      {cus.name} - {cus.phone}
                    </span>
                    <span className="cus-rank">
                      <Star size={12} /> Hạng {cus.rank}
                    </span>
                  </div>
                  <button className="btn-assign">
                    <UserPlus size={16} /> Gán vào bàn
                  </button>
                </div>
              ))}
            </div>
          )}
          {showSearchResults && searchQuery && (
            <div
              className="search-overlay"
              onClick={() => setShowSearchResults(false)}
            ></div>
          )}
        </div>

        {/* Nút chuông chuyển tab */}
        <NotificationBell onViewAll={() => setActiveTab("notifications")} />
      </header>

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

      {(activeTab === "menu" || activeTab === "tables") && selectedTable && (
        <button
          className="staff-pos-cart-fab"
          onClick={() => setIsCartOpen(true)}
        >
          <div className="fab-info">
            <ShoppingCart size={24} />
            <div className="fab-text">
              <span className="table-name">
                {selectedTable.name}{" "}
                {selectedTable.customer
                  ? `- ${selectedTable.customer.name}`
                  : ""}
              </span>
              <span className="items-count">
                {cart.length} món ({pendingCount} chờ)
              </span>
            </div>
          </div>
          <span className="btn-checkout">Xem Order / T.Toán</span>
        </button>
      )}

      {/* BOTTOM NAV - 5 Tabs */}
      <nav className="staff-pos-bottom-nav">
        <button
          className={`nav-item ${activeTab === "tables" ? "active" : ""}`}
          onClick={() => setActiveTab("tables")}
        >
          <Grid size={24} /> <span>Bàn</span>
        </button>
        <button
          className={`nav-item ${activeTab === "menu" ? "active" : ""}`}
          onClick={() => setActiveTab("menu")}
        >
          <Coffee size={24} /> <span>Gọi món</span>
        </button>
        <button
          className={`nav-item ${activeTab === "contacts" ? "active" : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          <MessageSquare size={24} /> <span>Liên lạc</span>
        </button>
        <button
          className={`nav-item ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          <Bell size={24} /> <span>Thông báo</span>
        </button>
        <button
          className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <UserCircle size={24} /> <span>Cá nhân</span>
        </button>
      </nav>

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

/* ================== CÁC COMPONENTS PHỤ ================== */

function TableMap({ tables, onSelect, selectedTable, onTableAction }) {
  const [floor, setFloor] = useState(MOCK_FLOORS[0]);
  return (
    <div className="staff-pos-tables">
      <div className="floor-selector">
        {MOCK_FLOORS.map((f) => (
          <button
            key={f}
            className={`floor-btn ${floor === f ? "active" : ""}`}
            onClick={() => setFloor(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="table-grid">
        {tables
          .filter((t) => t.floor === floor)
          .map((table) => {
            const isSelected = selectedTable?.id === table.id;
            return (
              <div
                key={table.id}
                className={`table-card-wrapper ${isSelected ? "selected" : ""}`}
              >
                <div
                  className={`table-card ${table.status}`}
                  onClick={() => onSelect(table)}
                >
                  <div className="table-header">
                    <span className="name">{table.name}</span>
                    <span className="guests">
                      <UserCircle size={14} /> {table.guests}
                    </span>
                  </div>
                  {table.customer && (
                    <div className="table-customer-tag">
                      <Star size={10} /> {table.customer.name}
                    </div>
                  )}
                  <div className="table-status">
                    {table.status === "empty"
                      ? "Trống"
                      : table.status === "serving"
                        ? "Đang phục vụ"
                        : "Chờ thanh toán"}
                  </div>
                </div>
                {isSelected && table.status !== "empty" && (
                  <div className="table-quick-actions">
                    <button onClick={() => onTableAction("move")}>
                      <ArrowRightLeft size={16} /> Chuyển
                    </button>
                    <button onClick={() => onTableAction("merge")}>
                      <Combine size={16} /> Gộp
                    </button>
                    <button
                      className="btn-pay"
                      onClick={() => onTableAction("checkout")}
                    >
                      <Receipt size={16} /> Tính tiền
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function MenuOrdering({
  onAdd,
  searchQuery,
  selectedTable,
  selectedCategory,
  setSelectedCategory,
  onRemoveCustomer,
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [prepChoice, setPrepChoice] = useState("");
  const [serveOrder, setServeOrder] = useState("Mang ra cùng lúc");

  if (!selectedTable)
    return (
      <div className="staff-pos-empty">
        <MapPin size={48} />
        <p>Vui lòng chọn một bàn trước khi gọi món</p>
      </div>
    );

  const filteredMenu = MOCK_MENU.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategory === "Tất cả" || m.category === selectedCategory),
  );

  const handleConfirmAdd = () => {
    onAdd(selectedItem, prepChoice, serveOrder);
    setSelectedItem(null);
    setPrepChoice("");
    setServeOrder("Mang ra cùng lúc");
  };

  return (
    <div className="staff-pos-menu">
      <div className="category-tabs">
        {MENU_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`cat-btn ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="menu-status-bar">
        Order cho: <strong>{selectedTable.name}</strong>
      </div>

      {selectedTable.customer ? (
        <div className="customer-info-card">
          <div className="cus-header">
            <div className="cus-avatar">
              <UserCircle size={32} />
            </div>
            <div className="cus-details">
              <h4>
                {selectedTable.customer.name}{" "}
                <span className="rank-badge">
                  {selectedTable.customer.rank}
                </span>
              </h4>
              <p>
                {selectedTable.customer.phone} • Tích lũy:{" "}
                {selectedTable.customer.points}đ
              </p>
            </div>
            <button className="btn-remove-cus" onClick={onRemoveCustomer}>
              <X size={18} />
            </button>
          </div>
          {selectedTable.customer.note && (
            <div className="cus-warning">
              <AlertTriangle size={14} /> Lưu ý: {selectedTable.customer.note}
            </div>
          )}
        </div>
      ) : (
        <div className="customer-empty-hint">
          <Search size={16} /> Hãy tìm kiếm SĐT để tải thông tin thành viên
        </div>
      )}

      <div className="menu-list mt-3">
        {filteredMenu.map((item) => (
          <div
            key={item.id}
            className={`menu-item-card ${item.stock <= 0 ? "out-of-stock" : ""}`}
            onClick={() => item.stock > 0 && setSelectedItem(item)}
          >
            <div className="item-info">
              <h4>{item.name}</h4>
              <p className="price">{item.price.toLocaleString()}đ</p>
            </div>
            <div className="item-stock">
              {item.stock > 0 ? (
                <span className="in-stock">Kho: {item.stock}</span>
              ) : (
                <span className="out">Hết món</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="staff-pos-modal-overlay">
          <div className="staff-pos-modal">
            <div className="modal-header">
              <h3>{selectedItem.name}</h3>
              <button onClick={() => setSelectedItem(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>1. Cách chế biến / Ghi chú</label>
                <div className="prep-options">
                  {selectedItem.prep.map((p) => (
                    <button
                      key={p}
                      className={`prep-btn ${prepChoice === p ? "selected" : ""}`}
                      onClick={() => setPrepChoice(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group mt-3">
                <label>2. Thứ tự lên món</label>
                <div className="serve-options">
                  {[
                    "Khai vị (Mang ra trước)",
                    "Mang ra cùng lúc",
                    "Tráng miệng (Mang ra sau)",
                  ].map((s) => (
                    <button
                      key={s}
                      className={`serve-btn ${serveOrder === s ? "selected" : ""}`}
                      onClick={() => setServeOrder(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-confirm" onClick={handleConfirmAdd}>
                Thêm vào giỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CartBottomSheet({ cart, setCart, onClose, table }) {
  const handleRequestVoid = (item) => {
    const reason = window.prompt(`Nhập lý do hủy món [${item.name}]:`);
    if (reason) {
      setCart(
        cart.map((c) =>
          c.id === item.id ? { ...c, status: "void_pending" } : c,
        ),
      );
      alert("Đã gửi yêu cầu hủy món!");
    }
  };
  return (
    <div className="staff-pos-cart-overlay">
      <div className="staff-pos-cart-sheet">
        <div className="sheet-header">
          <div>
            <h3>Chi tiết Order - {table?.name}</h3>
            <p className="subtitle">{cart.length} món đang chọn</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="sheet-body">
          {cart.map((item) => (
            <div key={item.id} className={`cart-item ${item.status}`}>
              <div className="item-main">
                <div className="item-name-row">
                  <span className="qty">{item.quantity}x</span>
                  <span className="name">{item.name}</span>
                </div>
                <div className="item-meta">
                  <span className="prep-text">
                    Note: {item.prep} • {item.serveOrder}
                  </span>
                  <span className="price">
                    {(item.price * item.quantity).toLocaleString()}đ
                  </span>
                </div>
              </div>
              <div className="item-tools">
                <div className="status-badges">
                  {item.status === "pending" && (
                    <span className="badge-warning">
                      <Clock size={12} /> Chưa gửi bếp
                    </span>
                  )}
                  {item.status === "cooking" && (
                    <span className="badge-cooking">
                      <ChefHat size={12} /> Đang nấu
                    </span>
                  )}
                  {item.status === "void_pending" && (
                    <span className="badge-void">
                      <AlertTriangle size={12} /> Đang chờ duyệt hủy
                    </span>
                  )}
                  {item.printed && (
                    <span className="badge-printed">
                      <Printer size={12} /> Đã in
                    </span>
                  )}
                </div>
                <div className="actions">
                  <button className="btn-cam">
                    <Camera
                      size={16}
                      color={item.hasPhoto ? "#10b981" : "#9ca3af"}
                    />
                  </button>
                  {item.status === "pending" ? (
                    <button
                      className="btn-del"
                      onClick={() =>
                        setCart(cart.filter((c) => c.id !== item.id))
                      }
                    >
                      <Minus size={16} />
                    </button>
                  ) : item.status !== "void_pending" ? (
                    <button
                      className="btn-void"
                      onClick={() => handleRequestVoid(item)}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="sheet-footer">
          <div className="billing-actions">
            <button className="btn-sub">
              <Tag size={18} /> Thêm Ưu Đãi
            </button>
            <button className="btn-sub">
              <Scissors size={18} /> Tách Bill
            </button>
            <button className="btn-sub">
              <Printer size={18} /> In Tạm Tính
            </button>
          </div>
          <div className="main-actions">
            <button className="btn-checkout">
              <Banknote size={20} /> Thanh Toán
            </button>
            <button className="btn-send-kitchen">
              <CheckCircle2 size={20} /> Gửi Bếp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactsView() {
  const staffContacts = [
    {
      id: 1,
      role: "Quản lý",
      name: "Anh Tuấn",
      status: "online",
      lastMsg: "Khách VIP sắp tới nhé.",
    },
    {
      id: 2,
      role: "Bếp trưởng",
      name: "Chú Hải",
      status: "busy",
      lastMsg: "Đang kẹt 5 bill lẩu.",
    },
    {
      id: 3,
      role: "Thu ngân",
      name: "Chị Mai",
      status: "online",
      lastMsg: "Đã nhận tiền bàn 03.",
    },
    {
      id: 4,
      role: "Bảo vệ",
      name: "Chú Dũng",
      status: "offline",
      lastMsg: "Xe khách hết chỗ.",
    },
  ];
  return (
    <div className="staff-pos-contacts">
      <div className="search-contact">
        <input type="text" placeholder="Tìm nhân viên / bộ phận..." />
      </div>
      <div className="contact-list">
        {staffContacts.map((c) => (
          <div key={c.id} className="contact-card">
            <div className="contact-info">
              <div className={`status-dot ${c.status}`}></div>
              <div>
                <h4>
                  {c.role} - {c.name}
                </h4>
                <p>{c.lastMsg}</p>
              </div>
            </div>
            <div className="contact-actions">
              <button className="btn-chat">
                <MessageCircle size={18} />
              </button>
              <button className="btn-call">
                <PhoneCall size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsView() {
  const [filter, setFilter] = useState("all");
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "Quản lý",
      text: "Bàn VIP 1 khách VIP chuẩn bị tới, set up kỹ nhé.",
      time: "10:30",
      isRead: false,
    },
    {
      id: 2,
      from: "Bếp",
      text: "Bò Wagyu hiện tại hết size lớn, báo khách giúp bếp.",
      time: "11:15",
      isRead: false,
    },
    {
      id: 3,
      from: "Hệ thống",
      text: "Cập nhật menu thành công. Đã thêm 2 món mới.",
      time: "09:00",
      isRead: true,
    },
  ]);

  const unreadCount = messages.filter((m) => !m.isRead).length;
  const displayedMessages =
    filter === "unread" ? messages.filter((m) => !m.isRead) : messages;

  return (
    <div className="staff-pos-messages">
      <div className="msg-toolbar">
        <div className="msg-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={filter === "unread" ? "active" : ""}
            onClick={() => setFilter("unread")}
          >
            Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
        <button
          className="btn-mark-all"
          onClick={() =>
            setMessages(messages.map((m) => ({ ...m, isRead: true })))
          }
        >
          <CheckCircle2 size={16} /> Đã đọc hết
        </button>
      </div>
      <div className="msg-list">
        {displayedMessages.length === 0 ? (
          <div className="empty-msg">
            <Bell size={32} color="#4b5563" />
            <p>Không có thông báo nào</p>
          </div>
        ) : (
          displayedMessages.map((m) => (
            <div
              key={m.id}
              className={`msg-card ${!m.isRead ? "unread" : ""}`}
              onClick={() =>
                setMessages(
                  messages.map((msg) =>
                    msg.id === m.id ? { ...msg, isRead: true } : msg,
                  ),
                )
              }
            >
              <div className="msg-header">
                <span className="from">{m.from}</span>
                <span className="time">{m.time}</span>
              </div>
              <p className="msg-text">{m.text}</p>
              {!m.isRead && <div className="dot-unread"></div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StaffProfile() {
  return (
    <div className="staff-pos-profile">
      <div className="profile-header">
        <div className="avatar">
          <ChefHat size={40} />
        </div>
        <div className="info">
          <h2>Nguyễn Văn B</h2>
          <p>Nhân viên Order - Ca Sáng</p>
        </div>
      </div>
      <div className="profile-stats">
        <div className="stat-box">
          <span className="label">Đơn đã phục vụ</span>
          <span className="val">24</span>
        </div>
        <div className="stat-box">
          <span className="label">Doanh số ca</span>
          <span className="val text-orange">4.5M</span>
        </div>
      </div>
      <div className="profile-menu">
        <button className="menu-btn">
          <Banknote size={20} /> Tình trạng Lương / Thưởng{" "}
          <ChevronRight size={16} />
        </button>
        <button className="menu-btn">
          <RefreshCw size={20} /> Đổi tài khoản <ChevronRight size={16} />
        </button>
        <button className="menu-btn text-red">
          <LogOut size={20} /> Đăng xuất
        </button>
      </div>
    </div>
  );
}
