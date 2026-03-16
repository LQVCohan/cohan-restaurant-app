import React, { useState, useMemo, useEffect, useContext } from "react";
import {
  Search,
  Grid,
  Coffee,
  MessageSquare,
  UserCircle,
  ShoppingCart,
  Bell,
  Star,
  X,
} from "lucide-react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";

import "./StaffOrdering.scss";
import NotificationBell from "./NotificationBell";

import { MOCK_CUSTOMERS, INITIAL_TABLES } from "./data/mockData";

import TableMap from "./components/TableMap";
import MenuOrdering from "./components/MenuOrdering";
import CartBottomSheet from "./components/CartBottomSheet";
import ContactsView from "./components/ContactsView";
import NotificationsView from "./components/NotificationsView";
import StaffProfile from "./components/StaffProfile";
import { AuthContext } from "../../context/AuthContext";

const TABLES_QUERY = gql`
  query StaffTables($restaurantId: ID!, $limit: Int) {
    tables(restaurantId: $restaurantId, limit: $limit) {
      id
      code
      floorLevel
      status
      capacity
    }
  }
`;

const MENU_ITEMS_QUERY = gql`
  query StaffMenuItems($restaurantId: ID!, $limit: Int) {
    menuItems(restaurantId: $restaurantId, limit: $limit) {
      id
      menuId
      categoryId
      name
      basePrice
      defaultServingKey
      status
      thumbImage
      servingVariants {
        key
        name
        mode
        price
      }
    }
  }
`;

const ORDERS_GROUPED_BY_TABLE = gql`
  query StaffOrdersGroupedByTable($restaurantId: ID!, $tableCode: String) {
    ordersGroupedByTable(restaurantId: $restaurantId, tableCode: $tableCode) {
      orderCode
      tableCode
      orders {
        id
        orderCode
        currentStatus
        items {
          _id
          dishId
          menuId
          categoryId
          name
          note
          priority
          quantity
          status
          unitPrice
          basePrice
          servingKey
        }
      }
    }
  }
`;

const CREATE_ORDER_FOR_TABLE = gql`
  mutation StaffCreateOrderForTable($input: CreateOrderForTableInput!) {
    createOrderForTable(input: $input) {
      isNewOrder
      order {
        id
        orderCode
      }
    }
  }
`;

const mapTableStatusToUi = (status) => {
  if (["available"].includes(status)) return "empty";
  if (["occupied"].includes(status)) return "checkout";
  return "serving";
};

const mapItemPriorityFromServeOrder = (serveOrder) => {
  if (serveOrder?.includes("Khai vị")) return "HIGH";
  if (serveOrder?.includes("Tráng miệng")) return "LOW";
  return "MEDIUM";
};

const buildCartFromServerOrders = (orders = []) => {
  const result = [];
  for (const order of orders) {
    for (const item of order.items || []) {
      result.push({
        id: String(item._id || `${order.id}_${item.dishId || item.name}`),
        itemId: item.dishId,
        menuId: item.menuId,
        categoryId: item.categoryId,
        name: item.name,
        prep: item.note || "Mặc định",
        serveOrder:
          item.priority === "HIGH"
            ? "Khai vị (Mang ra trước)"
            : item.priority === "LOW"
              ? "Tráng miệng (Mang ra sau)"
              : "Mang ra cùng lúc",
        priority: item.priority || "MEDIUM",
        quantity: Number(item.quantity || 1),
        price: Number(item.unitPrice || item.basePrice || 0),
        status: item.status || "pending",
        printed: true,
        hasPhoto: false,
        persisted: true,
        servingKey: item.servingKey || null,
      });
    }
  }
  return result;
};

export default function StaffOrdering() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const restaurantId =
    user?.restaurantForStaff ||
    user?.primaryRestaurant?.id ||
    restaurants?.[0]?.id ||
    null;

  const [activeTab, setActiveTab] = useState("tables");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartByTable, setCartByTable] = useState({});
  const [orderCodeByTable, setOrderCodeByTable] = useState({});

  const [createOrderForTable, { loading: savingOrder }] = useMutation(CREATE_ORDER_FOR_TABLE);
  const [loadOrdersForTable] = useLazyQuery(ORDERS_GROUPED_BY_TABLE, {
    fetchPolicy: "network-only",
  });

  const { data: tablesData } = useQuery(TABLES_QUERY, {
    variables: { restaurantId, limit: 200 },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const { data: menuData } = useQuery(MENU_ITEMS_QUERY, {
    variables: { restaurantId, limit: 300 },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (!tablesData?.tables?.length) return;
    const mapped = tablesData.tables.map((t) => ({
      id: t.id,
      tableCode: t.code,
      name: t.code,
      floor: `Tầng ${t.floorLevel || 1}`,
      status: mapTableStatusToUi(t.status),
      guests: 0,
      customer: null,
    }));
    setTables(mapped);
  }, [tablesData]);

  const floors = useMemo(() => {
    const set = new Set((tables || []).map((t) => t.floor).filter(Boolean));
    return set.size ? Array.from(set) : ["Tầng 1"];
  }, [tables]);

  const menuItems = useMemo(() => {
    const rows = menuData?.menuItems || [];
    return rows.map((m) => {
      const variants = Array.isArray(m.servingVariants) ? m.servingVariants : [];
      const firstVariant = variants[0] || null;
      const defaultVariant = variants.find((v) => v?.key === m.defaultServingKey) || firstVariant;
      return {
        id: m.id,
        dishId: m.id,
        menuId: m.menuId,
        categoryId: m.categoryId,
        name: m.name,
        price: Number(defaultVariant?.price ?? m.basePrice ?? 0),
        stock: m.status === "active" ? 99 : 0,
        category: m.categoryId ? `Danh mục ${String(m.categoryId).slice(-4)}` : "Khác",
        prep: variants.length ? variants.map((v) => v.name).filter(Boolean) : ["Mặc định"],
        servingKey: m.defaultServingKey || defaultVariant?.key || "portion",
        thumbImage: m.thumbImage || null,
      };
    });
  }, [menuData]);

  const dynamicCategories = useMemo(() => {
    const set = new Set(["Tất cả"]);
    menuItems.forEach((m) => set.add(m.category || "Khác"));
    return Array.from(set);
  }, [menuItems]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId),
    [tables, selectedTableId],
  );

  const cart = selectedTable ? cartByTable[selectedTable.id] || [] : [];

  useEffect(() => {
    if (!selectedTable || !restaurantId) return;
    const hasDraft = Array.isArray(cartByTable[selectedTable.id]) && cartByTable[selectedTable.id].some((x) => !x.persisted);
    if (hasDraft) return;

    loadOrdersForTable({
      variables: { restaurantId, tableCode: selectedTable.tableCode || selectedTable.name },
    })
      .then(({ data }) => {
        const groups = data?.ordersGroupedByTable || [];
        const latest = groups[0] || null;
        setOrderCodeByTable((prev) => ({
          ...prev,
          [selectedTable.id]: latest?.orderCode || prev[selectedTable.id] || null,
        }));
        setCartByTable((prev) => ({
          ...prev,
          [selectedTable.id]: buildCartFromServerOrders(latest?.orders || []),
        }));
      })
      .catch(() => {});
  }, [selectedTable?.id, selectedTable?.tableCode, selectedTable?.name, restaurantId]);

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

  const setCartForSelectedTable = (updater) => {
    if (!selectedTable?.id) return;
    setCartByTable((prev) => {
      const prevCart = prev[selectedTable.id] || [];
      const nextCart = typeof updater === "function" ? updater(prevCart) : updater;
      return { ...prev, [selectedTable.id]: nextCart };
    });
  };

  const handleAddToCart = (item, prep, serveOrder) => {
    if (item.stock <= 0) return alert("Món này đã hết hàng!");
    if (!selectedTable?.id) return alert("Vui lòng chọn bàn trước khi thêm món");

    const nextPriority = mapItemPriorityFromServeOrder(serveOrder);
    const signature = `${item.id}__${prep || ""}__${serveOrder || ""}`;

    setCartForSelectedTable((prev) => {
      const idx = prev.findIndex((x) => x.signature === signature && x.status === "pending" && !x.persisted);
      if (idx >= 0) {
        return prev.map((x, i) =>
          i === idx
            ? {
                ...x,
                quantity: Number(x.quantity || 1) + 1,
                priority: nextPriority,
              }
            : x,
        );
      }

      const newItem = {
        id: "C" + Date.now(),
        signature,
        itemId: item.id,
        dishId: item.dishId || item.id,
        menuId: item.menuId,
        categoryId: item.categoryId,
        servingKey: item.servingKey || "portion",
        name: item.name,
        prep: prep || "Mặc định",
        serveOrder,
        priority: nextPriority,
        quantity: 1,
        price: item.price,
        status: "pending",
        printed: false,
        hasPhoto: false,
        persisted: false,
      };
      return [newItem, ...prev];
    });
  };

  const handleSendKitchen = async () => {
    if (!selectedTable?.id || !restaurantId) {
      alert("Thiếu thông tin nhà hàng hoặc bàn.");
      return;
    }

    const currentCart = cartByTable[selectedTable.id] || [];
    const pendingItems = currentCart.filter((x) => x.status === "pending" && !x.persisted);
    if (!pendingItems.length) {
      alert("Không có món mới để gửi bếp.");
      return;
    }

    const payloadItems = pendingItems.map((item) => ({
      dishId: item.dishId,
      menuId: item.menuId,
      categoryId: item.categoryId,
      name: item.name,
      unit: "portion",
      basePrice: Number(item.price || 0),
      servingKey: item.servingKey || "portion",
      quantity: Number(item.quantity || 1),
      note: [item.prep, item.serveOrder].filter(Boolean).join(" • "),
      priority: item.priority || "MEDIUM",
    }));

    try {
      const { data } = await createOrderForTable({
        variables: {
          input: {
            restaurantId,
            tableCode: selectedTable.tableCode || selectedTable.name,
            orderCode: orderCodeByTable[selectedTable.id] || null,
            items: payloadItems,
          },
        },
      });

      const orderCode = data?.createOrderForTable?.order?.orderCode || null;
      if (orderCode) {
        setOrderCodeByTable((prev) => ({ ...prev, [selectedTable.id]: orderCode }));
      }

      const refreshed = await loadOrdersForTable({
        variables: { restaurantId, tableCode: selectedTable.tableCode || selectedTable.name },
        fetchPolicy: "network-only",
      });
      const groups = refreshed?.data?.ordersGroupedByTable || [];
      const latest = groups[0] || null;
      setCartByTable((prev) => ({
        ...prev,
        [selectedTable.id]: buildCartFromServerOrders(latest?.orders || []),
      }));
      alert("Đã gửi bếp và lưu order vào hệ thống.");
    } catch (err) {
      alert(err?.message || "Gửi bếp thất bại");
    }
  };

  const handleTableAction = (action) => {
    if (!selectedTable) return;
    if (action === "move")
      alert(`Đang chuyển bàn cho ${selectedTable.name}...`);
    if (action === "merge") alert(`Đang gộp bàn cho ${selectedTable.name}...`);
    if (action === "checkout") setIsCartOpen(true);
  };

  const pendingCount = cart.filter((c) => c.status === "pending").length;

  return (
    <div className="staff-pos-layout">
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

        <div className="header-actions">
          <NotificationBell onViewAll={() => setActiveTab("notifications")} />
        </div>
      </header>

      {showSearchResults && (
        <div
          className="search-overlay"
          onClick={() => setShowSearchResults(false)}
        ></div>
      )}

      <main className="staff-pos-main">
        {activeTab === "tables" && (
          <TableMap
            tables={tables}
            floors={floors}
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
            menuItems={menuItems}
            categories={dynamicCategories}
          />
        )}
        {activeTab === "contacts" && <ContactsView />}
        {activeTab === "notifications" && <NotificationsView />}
        {activeTab === "profile" && <StaffProfile />}
      </main>

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

      {isCartOpen && (
        <CartBottomSheet
          cart={cart}
          setCart={setCartForSelectedTable}
          onClose={() => setIsCartOpen(false)}
          table={selectedTable}
          onSendKitchen={handleSendKitchen}
          sending={savingOrder}
        />
      )}
    </div>
  );
}
