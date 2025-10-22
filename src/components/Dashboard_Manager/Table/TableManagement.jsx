import React, { useState, useEffect, useCallback } from "react";
import Modal from "../../../components/common/Modal";
import Button from "../../../components/common/Button";
import Card from "../../../components/common/Card";
// ❌ Bỏ Notification component cũ
// import Notification from "../../../components/common/Notification";
import OrderModal from "./OrderModal";
import "./TableManagement.scss";

// ✅ Dùng hook global notification
import { useNotification } from "../../../hooks/useNotification";

const TableManagement = () => {
  // ✅ Lấy showNotification từ global provider
  const { showNotification } = useNotification();

  // State management
  const [floors, setFloors] = useState([
    {
      id: 1,
      name: "Tầng trệt",
      icon: "🏢",
      description: "Khu vực chính",
      active: true,
    },
    {
      id: 2,
      name: "Tầng 1",
      icon: "1️⃣",
      description: "Khu vực VIP",
      active: false,
    },
    {
      id: 3,
      name: "Sân thượng",
      icon: "🌳",
      description: "Khu vực ngoài trời",
      active: false,
    },
    {
      id: 4,
      name: "Mang về",
      icon: "📦",
      description: "Đơn hàng mang về",
      active: false,
    },
  ]);

  const [tables, setTables] = useState([
    {
      id: 1,
      number: "B01",
      seats: 4,
      status: "available",
      floorId: 1,
      area: "indoor",
      customer: null,
      orderTime: null,
      total: 0,
      orders: [],
      entryTime: null,
      guestCount: 0,
      x: 100,
      y: 100,
    },
    {
      id: 2,
      number: "B02",
      seats: 2,
      status: "occupied",
      floorId: 1,
      area: "indoor",
      customer: "Nguyễn Văn A",
      orderTime: "19:30",
      total: 450000,
      orders: [
        {
          item: "Phở Bò Tái",
          quantity: 2,
          price: 65000,
          subtotal: 130000,
          cookingMethod: "Tái chín",
          customMethod: "",
        },
        {
          item: "Trà Đá",
          quantity: 2,
          price: 5000,
          subtotal: 10000,
          cookingMethod: "",
          customMethod: "",
        },
      ],
      entryTime: "19:15",
      guestCount: 2,
      x: 250,
      y: 100,
    },
    {
      id: 3,
      number: "B03",
      seats: 6,
      status: "reserved",
      floorId: 1,
      area: "indoor",
      customer: "Trần Thị B",
      orderTime: "20:00",
      total: 0,
      orders: [],
      entryTime: null,
      guestCount: 4,
      x: 400,
      y: 100,
    },
    {
      id: 4,
      number: "B04",
      seats: 4,
      status: "cleaning",
      floorId: 1,
      area: "indoor",
      customer: null,
      orderTime: null,
      total: 0,
      orders: [],
      entryTime: null,
      guestCount: 0,
      x: 100,
      y: 250,
    },
    {
      id: 5,
      number: "B05",
      seats: 8,
      status: "available",
      floorId: 1,
      area: "vip",
      customer: null,
      orderTime: null,
      total: 0,
      orders: [],
      entryTime: null,
      guestCount: 0,
      x: 250,
      y: 250,
    },
    {
      id: 6,
      number: "V01",
      seats: 2,
      status: "occupied",
      floorId: 2,
      area: "vip",
      customer: "Lê Văn C",
      orderTime: "18:45",
      total: 850000,
      orders: [
        {
          item: "Bò Wagyu Nướng",
          quantity: 1,
          price: 500000,
          subtotal: 500000,
          cookingMethod: "Medium",
          customMethod: "Ít muối",
        },
        {
          item: "Rượu Vang Đỏ",
          quantity: 1,
          price: 350000,
          subtotal: 350000,
          cookingMethod: "",
          customMethod: "",
        },
      ],
      entryTime: "18:30",
      guestCount: 2,
      x: 150,
      y: 150,
    },
    {
      id: 7,
      name: "ST01",
      seats: 4,
      status: "available",
      floorId: 3,
      area: "outdoor",
      customer: null,
      orderTime: null,
      total: 0,
      orders: [],
      entryTime: null,
      guestCount: 0,
      x: 200,
      y: 200,
    },
    {
      id: 8,
      name: "TO01",
      seats: 0,
      status: "occupied",
      floorId: 4,
      area: "takeaway",
      customer: "Phạm Văn D",
      orderTime: "19:45",
      total: 125000,
      orders: [
        {
          item: "Cơm Gà Xối Mỡ",
          quantity: 2,
          price: 45000,
          subtotal: 90000,
          cookingMethod: "Cay vừa",
          customMethod: "",
        },
        {
          item: "Nước Ngọt",
          quantity: 2,
          price: 15000,
          subtotal: 30000,
          cookingMethod: "",
          customMethod: "",
        },
      ],
      entryTime: "19:45",
      guestCount: 0,
      x: 0,
      y: 0,
    },
  ]);

  const [deliveryPartners] = useState([
    {
      id: 1,
      name: "Grab Food",
      logo: "🟢",
      status: "online",
      commission: "20%",
      currentOrders: 3,
      totalOrders: 45,
      rating: 4.8,
      description: "Nền tảng giao hàng hàng đầu",
    },
    {
      id: 2,
      name: "Shopee Food",
      logo: "🔶",
      status: "online",
      commission: "18%",
      currentOrders: 2,
      totalOrders: 32,
      rating: 4.6,
      description: "Giao hàng nhanh, nhiều ưu đãi",
    },
    {
      id: 3,
      name: "Baemin",
      logo: "🔴",
      status: "offline",
      commission: "22%",
      currentOrders: 0,
      totalOrders: 28,
      rating: 4.5,
      description: "Dịch vụ giao hàng Hàn Quốc",
    },
    {
      id: 4,
      name: "GoFood",
      logo: "🟡",
      status: "online",
      commission: "19%",
      currentOrders: 1,
      totalOrders: 38,
      rating: 4.7,
      description: "Giao hàng từ Gojek",
    },
  ]);

  const [menuItems] = useState({
    main: [
      {
        id: 1,
        name: "Phở Bò Tái",
        price: 65000,
        category: "main",
        description: "Phở bò truyền thống với thịt bò tái",
        cookingMethods: [
          { name: "Tái", price: 65000, description: "Thịt bò tái mềm" },
          {
            name: "Tái chín",
            price: 70000,
            description: "Thịt bò tái và chín",
          },
          { name: "Chín", price: 68000, description: "Thịt bò chín hoàn toàn" },
          { name: "Tái gân", price: 75000, description: "Thịt bò tái với gân" },
        ],
        hasWeight: false,
      },
      {
        id: 2,
        name: "Bún Bò Huế",
        price: 55000,
        category: "main",
        description: "Bún bò Huế cay nồng đặc trưng",
        cookingMethods: [
          { name: "Cay vừa", price: 55000, description: "Độ cay vừa phải" },
          { name: "Cay nhiều", price: 55000, description: "Cay đậm đà" },
          {
            name: "Không cay",
            price: 55000,
            description: "Dành cho người không ăn cay",
          },
        ],
        hasWeight: false,
      },
      {
        id: 3,
        name: "Cơm Gà Xối Mỡ",
        price: 45000,
        category: "main",
        description: "Cơm gà Hải Nam truyền thống",
        cookingMethods: [
          {
            name: "Gà luộc",
            price: 45000,
            description: "Gà luộc truyền thống",
          },
          { name: "Gà nướng", price: 50000, description: "Gà nướng thơm lừng" },
          { name: "Gà chiên", price: 48000, description: "Gà chiên giòn rụm" },
        ],
        hasWeight: false,
      },
      {
        id: 4,
        name: "Bò Wagyu Nướng",
        price: 500000,
        category: "main",
        description: "Thịt bò Wagyu cao cấp nướng than hoa",
        cookingMethods: [
          { name: "Rare", price: 500000, description: "Tái gần như sống" },
          { name: "Medium Rare", price: 500000, description: "Tái vừa" },
          { name: "Medium", price: 500000, description: "Chín vừa" },
          { name: "Well Done", price: 500000, description: "Chín kỹ" },
        ],
        hasWeight: true,
        unit: "g",
        baseWeight: 200,
        pricePerGram: 2500,
      },
      {
        id: 5,
        name: "Tôm Hùm Nướng",
        price: 800000,
        category: "main",
        description: "Tôm hùm tươi nướng bơ tỏi",
        cookingMethods: [
          {
            name: "Nướng bơ tỏi",
            price: 800000,
            description: "Nướng với bơ tỏi thơm",
          },
          {
            name: "Nướng phô mai",
            price: 850000,
            description: "Nướng với phô mai tan chảy",
          },
          {
            name: "Nướng muối ớt",
            price: 800000,
            description: "Nướng muối ớt cay nồng",
          },
        ],
        hasWeight: true,
        unit: "kg",
        baseWeight: 0.5,
        pricePerGram: 1600,
      },
    ],
    beverages: [
      {
        id: 9,
        name: "Trà Đá",
        price: 5000,
        category: "beverage",
        description: "Trà đá truyền thống",
        cookingMethods: [
          { name: "Đá nhiều", price: 5000, description: "Nhiều đá mát lạnh" },
          { name: "Đá ít", price: 5000, description: "Ít đá, đậm đà" },
          { name: "Không đá", price: 5000, description: "Trà nóng" },
        ],
        hasWeight: false,
      },
      {
        id: 10,
        name: "Nước Ngọt",
        price: 15000,
        category: "beverage",
        description: "Coca Cola, Pepsi, Sprite",
        cookingMethods: [
          {
            name: "Coca Cola",
            price: 15000,
            description: "Coca Cola nguyên chất",
          },
          { name: "Pepsi", price: 15000, description: "Pepsi Cola" },
          { name: "Sprite", price: 15000, description: "Sprite chanh" },
          { name: "7Up", price: 15000, description: "7Up chanh" },
        ],
        hasWeight: false,
      },
      {
        id: 11,
        name: "Bia Sài Gòn",
        price: 25000,
        category: "beverage",
        description: "Bia Sài Gòn đỏ, xanh",
        cookingMethods: [
          { name: "Bia đỏ", price: 25000, description: "Bia Sài Gòn đỏ" },
          { name: "Bia xanh", price: 25000, description: "Bia Sài Gòn xanh" },
        ],
        hasWeight: false,
      },
      {
        id: 12,
        name: "Rượu Vang Đỏ",
        price: 350000,
        category: "beverage",
        description: "Rượu vang đỏ cao cấp",
        cookingMethods: [
          {
            name: "Dalat Wine",
            price: 350000,
            description: "Rượu vang Đà Lạt",
          },
          {
            name: "Imported Wine",
            price: 450000,
            description: "Rượu vang nhập khẩu",
          },
        ],
        hasWeight: false,
      },
    ],
  });

  // Modal states
  const [showTableDiagram, setShowTableDiagram] = useState(false);
  const [showTableDetail, setShowTableDetail] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCookingMethodModal, setShowCookingMethodModal] = useState(false);

  // Current selections
  const [currentTable, setCurrentTable] = useState(null);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [selectedTableDetail, setSelectedTableDetail] = useState(null);
  const [currentOrder, setCurrentOrder] = useState({});
  const [selectedDeliveryPartner, setSelectedDeliveryPartner] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [currentCookingItem, setCurrentCookingItem] = useState(null);
  const [selectedCookingMethod, setSelectedCookingMethod] = useState(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [diagramSearchQuery, setDiagramSearchQuery] = useState("");
  const [currentFilters, setCurrentFilters] = useState({
    status: "",
    area: "",
    seats: "",
  });
  const [currentSort, setCurrentSort] = useState("number");
  const [diagramFloorFilter, setDiagramFloorFilter] = useState("");
  const [diagramStatusFilter, setDiagramStatusFilter] = useState("");

  // Form states
  const [floorForm, setFloorForm] = useState({
    name: "",
    icon: "",
    description: "",
  });
  const [tableForm, setTableForm] = useState({
    number: "",
    seats: 4,
    floorId: "",
    area: "indoor",
  });
  const [customerPaid, setCustomerPaid] = useState("");
  const [editingFloor, setEditingFloor] = useState(null);

  // Utility functions
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);

  const calculateDuration = (startTime) => {
    if (!startTime) return "Chưa vào";
    const now = new Date();
    const start = new Date();
    const [hours, minutes] = startTime.split(":");
    start.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} phút`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}p`;
  };

  const getStatusText = (status) => {
    const statusMap = {
      available: "Trống",
      occupied: "Có khách",
      reserved: "Đã đặt",
      cleaning: "Dọn dẹp",
    };
    return statusMap[status] || status;
  };

  const getAreaText = (area) => {
    const areaMap = {
      indoor: "Trong nhà",
      outdoor: "Ngoài trời",
      takeaway: "Mang về",
      vip: "VIP",
    };
    return areaMap[area] || area;
  };

  // Chart calculation
  const getTableStats = () => {
    const stats = tables.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    return {
      total: tables.length,
      available: stats.available || 0,
      occupied: stats.occupied || 0,
      reserved: stats.reserved || 0,
      cleaning: stats.cleaning || 0,
    };
  };

  const getFloorTableCount = (floorId) =>
    tables.filter((t) => t.floorId === floorId).length;

  // Table operations
  const changeTableStatus = (tableId, newStatus) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const updated = { ...t, status: newStatus };
        if (newStatus === "available") {
          Object.assign(updated, {
            customer: null,
            orderTime: null,
            total: 0,
            orders: [],
            entryTime: null,
            guestCount: 0,
          });
        }
        if (newStatus === "occupied" && !t.customer) {
          Object.assign(updated, {
            customer: "Khách hàng mới",
            orderTime: new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            entryTime: new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            guestCount: Math.min(t.seats, 2),
          });
        }
        return updated;
      })
    );
  };

  const handleTableClick = (tableId) => {
    const table = tables.find((t) => t.id === tableId);
    if (table.status === "occupied" || table.status === "reserved") {
      setSelectedTableDetail(table);
      setShowTableDetail(true);
    }
  };

  // Floor operations
  const selectFloor = (floorId) => {
    setFloors((prev) => prev.map((f) => ({ ...f, active: f.id === floorId })));
    setCurrentFloor(floorId);
  };

  const saveFloor = () => {
    if (!floorForm.name.trim()) {
      showNotification("Vui lòng nhập tên tầng!", "error");
      return;
    }
    if (editingFloor) {
      setFloors((prev) =>
        prev.map((f) =>
          f.id === editingFloor.id
            ? { ...f, ...floorForm, icon: floorForm.icon || "🏢" }
            : f
        )
      );
      showNotification("Đã cập nhật thông tin tầng!", "success");
    } else {
      const newFloor = {
        id: Math.max(...floors.map((f) => f.id)) + 1,
        ...floorForm,
        icon: floorForm.icon || "🏢",
        active: false,
      };
      setFloors((prev) => [...prev, newFloor]);
      showNotification("Đã thêm tầng mới!", "success");
    }
    setShowFloorModal(false);
    setFloorForm({ name: "", icon: "", description: "" });
    setEditingFloor(null);
  };

  const editFloor = (floorId) => {
    const floor = floors.find((f) => f.id === floorId);
    setEditingFloor(floor);
    setFloorForm({
      name: floor.name,
      icon: floor.icon,
      description: floor.description,
    });
    setShowFloorModal(true);
  };

  const deleteFloor = (floorId) => {
    const floor = floors.find((f) => f.id === floorId);
    const count = getFloorTableCount(floorId);
    if (count > 0) {
      showNotification(
        `Không thể xóa tầng "${floor.name}" vì còn ${count} bàn!`,
        "error"
      );
      return;
    }
    if (window.confirm(`Bạn có chắc muốn xóa tầng "${floor.name}"?`)) {
      setFloors((prev) => prev.filter((f) => f.id !== floorId));
      if (currentFloor === floorId) setCurrentFloor(null);
      showNotification("Đã xóa tầng!", "success");
    }
  };

  // Table management
  const saveTable = () => {
    const { number, seats, floorId, area } = tableForm;
    if (!number || !seats || !floorId || !area) {
      showNotification("Vui lòng điền đầy đủ thông tin!", "error");
      return;
    }
    if (
      tables.some(
        (t) => (t.number || "").toLowerCase() === number.toLowerCase()
      )
    ) {
      showNotification("Số bàn đã tồn tại!", "error");
      return;
    }
    const newTable = {
      id: Math.max(...tables.map((t) => t.id)) + 1,
      number,
      seats: parseInt(seats),
      status: "available",
      floorId: parseInt(floorId),
      area,
      customer: null,
      orderTime: null,
      total: 0,
      orders: [],
      entryTime: null,
      guestCount: 0,
      x: Math.random() * 400 + 50,
      y: Math.random() * 300 + 50,
    };
    setTables((prev) => [...prev, newTable]);
    setShowAddTableModal(false);
    setTableForm({ number: "", seats: 4, floorId: "", area: "indoor" });
    showNotification("Đã thêm bàn mới!", "success");
  };

  // Order operations
  const openOrderModal = (tableId) => {
    const table = tables.find((t) => t.id === tableId);
    setCurrentTable(table);
    setCurrentOrder({});
    setMenuSearchQuery("");
    setSelectedDeliveryPartner(null);
    setShowOrderModal(true);
  };

  const selectCookingMethod = (itemId, method) => {
    setCurrentOrder((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        cookingMethod: method.name,
        price: method.price,
        quantity: prev[itemId]?.quantity || 0,
      },
    }));
    setShowCookingMethodModal(false);
  };

  const updateQuantity = (itemId, change) => {
    const currentQty = currentOrder[itemId]?.quantity || 0;
    let newQty = change === 0 ? currentQty : Math.max(0, currentQty + change);
    if (newQty > 0) {
      if (!currentOrder[itemId] || !currentOrder[itemId].cookingMethod) {
        const item = [...menuItems.main, ...menuItems.beverages].find(
          (i) => i.id == itemId
        );
        setCurrentCookingItem(item);
        setShowCookingMethodModal(true);
        return;
      }
      setCurrentOrder((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], quantity: newQty },
      }));
    } else {
      setCurrentOrder((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], quantity: 0 },
      }));
    }
  };

  const submitOrder = () => {
    const orderItems = Object.keys(currentOrder).filter(
      (id) => currentOrder[id].quantity > 0
    );
    if (orderItems.length === 0) {
      showNotification("Vui lòng chọn ít nhất một món!", "error");
      return;
    }
    if (currentTable.area === "takeaway" && !selectedDeliveryPartner) {
      showNotification(
        "Vui lòng chọn đối tác giao hàng cho đơn mang về!",
        "error"
      );
      return;
    }
    const newOrders = orderItems.map((itemId) => {
      const item = [...menuItems.main, ...menuItems.beverages].find(
        (i) => i.id == itemId
      );
      const orderItem = currentOrder[itemId];
      const itemPrice = orderItem.price || item.price;
      const subtotal = itemPrice * orderItem.quantity;
      let itemName = item.name;
      if (orderItem.weight && orderItem.weight > 0) {
        itemName += ` (${orderItem.weight}${item.unit || "kg"})`;
      }
      return {
        item: itemName,
        quantity: orderItem.quantity,
        price: itemPrice,
        subtotal,
        cookingMethod: orderItem.cookingMethod || "",
        customMethod: orderItem.customMethod || "",
        weight: orderItem.weight || 0,
      };
    });

    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== currentTable.id) return t;
        const updatedOrders = [...(t.orders || []), ...newOrders];
        return {
          ...t,
          orders: updatedOrders,
          total: updatedOrders.reduce((sum, o) => sum + o.subtotal, 0),
          status: "occupied",
          customer: t.customer || "Khách hàng mới",
          orderTime:
            t.orderTime ||
            new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          entryTime:
            t.entryTime ||
            new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
        };
      })
    );
    setShowOrderModal(false);
    showNotification("✅ Đã thêm đơn hàng thành công!", "success");
  };

  // Payment
  const openPaymentModal = () => {
    if (!selectedTableDetail || selectedTableDetail.total <= 0) {
      showNotification("Bàn này chưa có đơn hàng để thanh toán!", "error");
      return;
    }
    setShowPaymentModal(true);
  };

  const calculateChange = () => {
    const paid = parseFloat(customerPaid) || 0;
    const subtotal = selectedTableDetail?.total || 0;
    const tax = Math.round(subtotal * 0.1);
    return paid - (subtotal + tax);
  };

  const processPaymentConfirm = () => {
    const subtotal = selectedTableDetail.total;
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;

    if (selectedPaymentMethod === "cash") {
      const paid = parseFloat(customerPaid) || 0;
      if (paid < total) {
        showNotification("Số tiền khách đưa không đủ!", "error");
        return;
      }
    }

    if (
      window.confirm("Thanh toán thành công! Bạn có muốn in hóa đơn không?")
    ) {
      printInvoice();
    }

    changeTableStatus(selectedTableDetail.id, "cleaning");
    setShowPaymentModal(false);
    setShowTableDetail(false);
    setCustomerPaid("");

    const methodText = {
      cash: "tiền mặt",
      card: "thẻ ngân hàng",
      transfer: "chuyển khoản",
    };
    showNotification(
      `✅ Thanh toán thành công bằng ${methodText[selectedPaymentMethod]}!`,
      "success"
    );
  };

  const printInvoice = () => {
    console.log("Printing invoice for table:", selectedTableDetail.number);
    showNotification("🖨️ Đã gửi lệnh in hóa đơn!", "info");
  };

  // Filters
  const getFilteredTables = () => {
    let filtered = [...tables];
    if (currentFloor)
      filtered = filtered.filter((t) => t.floorId === currentFloor);
    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          (t.number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.customer &&
            t.customer.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    if (currentFilters.status)
      filtered = filtered.filter((t) => t.status === currentFilters.status);
    if (currentFilters.area)
      filtered = filtered.filter((t) => t.area === currentFilters.area);

    filtered.sort((a, b) => {
      switch (currentSort) {
        case "number":
          return (a.number || "").localeCompare(b.number || "");
        case "status": {
          const order = { occupied: 0, reserved: 1, cleaning: 2, available: 3 };
          return (order[a.status] ?? 4) - (order[b.status] ?? 4);
        }
        case "total-desc":
          return b.total - a.total;
        default:
          return 0;
      }
    });
    return filtered;
  };

  const getFilteredMenuItems = () => {
    const all = [...menuItems.main, ...menuItems.beverages];
    if (!menuSearchQuery) return all;
    return all.filter(
      (i) =>
        i.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
        i.description.toLowerCase().includes(menuSearchQuery.toLowerCase())
    );
  };

  const getDiagramFilteredTables = () => {
    let filtered = [...tables];
    if (diagramFloorFilter)
      filtered = filtered.filter(
        (t) => t.floorId === parseInt(diagramFloorFilter)
      );
    if (diagramStatusFilter)
      filtered = filtered.filter((t) => t.status === diagramStatusFilter);
    if (diagramSearchQuery) {
      filtered = filtered.filter(
        (t) =>
          (t.number || "")
            .toLowerCase()
            .includes(diagramSearchQuery.toLowerCase()) ||
          (t.customer &&
            t.customer.toLowerCase().includes(diagramSearchQuery.toLowerCase()))
      );
    }
    return filtered;
  };

  // Render helpers
  const renderCircularChart = () => {
    const { total, available, occupied, reserved, cleaning } = getTableStats();
    if (total === 0) {
      return (
        <div className="chart-container">
          <div className="chart-wrapper">
            <div className="chart-center">
              <div className="chart-total">0</div>
              <div className="chart-label">Chưa có bàn</div>
            </div>
          </div>
        </div>
      );
    }

    const radius = 55;
    const circumference = 2 * Math.PI * radius;
    const pct = (v) => (v / total) * circumference;

    let offset = 0;
    const parts = [
      { val: available, color: "#10b981" },
      { val: occupied, color: "#f59e0b" },
      { val: reserved, color: "#3b82f6" },
      { val: cleaning, color: "#8b5cf6" },
    ];

    return (
      <div className="chart-container">
        <div className="chart-wrapper">
          <svg className="chart-svg" width="140" height="140">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="16"
            />
            {parts.map((p, idx) => {
              if (p.val <= 0) return null;
              const dash = `${pct(p.val)} ${circumference}`;
              const el = (
                <circle
                  key={idx}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="16"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                />
              );
              offset += pct(p.val);
              return el;
            })}
          </svg>
          <div className="chart-center">
            <div className="chart-total">{total}</div>
            <div className="chart-label">Tổng bàn</div>
          </div>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color available"></div>
            <span>Trống ({available})</span>
          </div>
          <div className="legend-item">
            <div className="legend-color occupied"></div>
            <span>Có khách ({occupied})</span>
          </div>
          <div className="legend-item">
            <div className="legend-color reserved"></div>
            <span>Đã đặt ({reserved})</span>
          </div>
          <div className="legend-item">
            <div className="legend-color cleaning"></div>
            <span>Dọn dẹp ({cleaning})</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTableActions = (table) => {
    switch (table.status) {
      case "available":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="success"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "occupied");
              }}
            >
              🍽️ Nhận
            </Button>
            <Button
              size="sm"
              variant="info"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "reserved");
              }}
            >
              📅 Đặt
            </Button>
          </div>
        );
      case "occupied":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="warning"
              onClick={(e) => {
                e.stopPropagation();
                openOrderModal(table.id);
              }}
            >
              📝 Order
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTableDetail(table);
                setShowPaymentModal(true);
              }}
            >
              💰 TT
            </Button>
          </div>
        );
      case "reserved":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="success"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "occupied");
              }}
            >
              ✅ Đến
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "available");
              }}
            >
              ❌ Hủy
            </Button>
          </div>
        );
      case "cleaning":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "available");
              }}
            >
              ✨ Xong
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="table-management">
      {/* ❌ Bỏ Notification local vì đã có NotificationContainer global */}
      {/* Top Actions Bar */}
      <div className="top-actions">
        <h1>🍽️ Quản Lý Bàn Ăn</h1>
        <div className="top-actions-right">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTableDiagram(true)}
          >
            🗺️ Sơ đồ bàn
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFloorModal(true)}
          >
            🏗️ Thêm tầng
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="table_sidebar">
          <div className="table_sidebar-section">{renderCircularChart()}</div>

          <div className="table_sidebar-section">
            <h3 className="table_sidebar-title">🔍 Tìm bàn</h3>
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Tìm bàn theo số, khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
          </div>

          <div className="table_sidebar-section">
            <h3 className="table_sidebar-title">🏢 Tầng</h3>
            <div className="floor-list">
              {floors.map((floor) => (
                <div
                  key={floor.id}
                  className={`floor-item ${floor.active ? "active" : ""}`}
                  onClick={() => selectFloor(floor.id)}
                >
                  <div className="floor-info">
                    <span>{floor.icon}</span>
                    <div>
                      <div className="floor-name">{floor.name}</div>
                      <div className="floor-count">
                        {getFloorTableCount(floor.id)} bàn
                      </div>
                    </div>
                  </div>
                  <div className="floor-actions">
                    <button
                      className="floor-btn edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        editFloor(floor.id);
                      }}
                      title="Sửa"
                    >
                      ✏️
                    </button>
                    <button
                      className="floor-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFloor(floor.id);
                      }}
                      title="Xóa"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <div className="tables-container">
            <div className="tables-header">
              <h2>
                {currentFloor
                  ? `${floors.find((f) => f.id === currentFloor)?.icon} ${
                      floors.find((f) => f.id === currentFloor)?.name
                    }`
                  : "📍 Tất cả bàn"}
              </h2>
              <div className="header-actions">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddTableModal(true)}
                >
                  ➕ Thêm bàn
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    showNotification("🔄 Đã làm mới danh sách bàn!", "info")
                  }
                >
                  🔄 Làm mới
                </Button>
              </div>
            </div>

            <div className="table-controls">
              <div className="filter-section">
                <select
                  className="filter-select"
                  value={currentFilters.status}
                  onChange={(e) =>
                    setCurrentFilters((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="available">🟢 Trống</option>
                  <option value="occupied">🟡 Có khách</option>
                  <option value="reserved">🔵 Đã đặt</option>
                  <option value="cleaning">🟣 Dọn dẹp</option>
                </select>
                <select
                  className="filter-select"
                  value={currentFilters.area}
                  onChange={(e) =>
                    setCurrentFilters((prev) => ({
                      ...prev,
                      area: e.target.value,
                    }))
                  }
                >
                  <option value="">Tất cả khu vực</option>
                  <option value="indoor">🏢 Trong nhà</option>
                  <option value="outdoor">🌳 Ngoài trời</option>
                  <option value="vip">👑 VIP</option>
                  <option value="takeaway">📦 Mang về</option>
                </select>
                <select
                  className="filter-select"
                  value={currentSort}
                  onChange={(e) => setCurrentSort(e.target.value)}
                >
                  <option value="number">Số bàn A-Z</option>
                  <option value="status">Theo trạng thái</option>
                  <option value="total-desc">Doanh thu cao</option>
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCurrentFilters({ status: "", area: "", seats: "" });
                    setCurrentSort("number");
                  }}
                >
                  🗑️ Xóa lọc
                </Button>
              </div>
            </div>

            <div className="tables-grid">
              {getFilteredTables().length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🍽️</div>
                  <div className="empty-state-text">Không tìm thấy bàn nào</div>
                  <div className="empty-state-subtext">
                    Thử thay đổi bộ lọc hoặc thêm bàn mới
                  </div>
                </div>
              ) : (
                getFilteredTables().map((table) => (
                  <Card
                    key={table.id}
                    className={`table-card ${table.status}`}
                    onClick={() => handleTableClick(table.id)}
                  >
                    <div className="table-header">
                      <div className="table-number">{table.number}</div>
                      <div className={`table-status status-${table.status}`}>
                        {getStatusText(table.status)}
                      </div>
                    </div>
                    <div className="table-info">
                      <div className="table-detail">
                        <span>👥</span>
                        <span>
                          {table.seats > 0 ? table.seats + " chỗ" : "Mang về"}
                        </span>
                      </div>
                      <div className="table-detail">
                        <span>📍</span>
                        <span>{getAreaText(table.area)}</span>
                      </div>
                      {table.customer && (
                        <div className="table-detail">
                          <span>👤</span>
                          <span>{table.customer}</span>
                        </div>
                      )}
                      {table.orderTime && (
                        <div className="table-detail">
                          <span>⏰</span>
                          <span>{table.orderTime}</span>
                        </div>
                      )}
                      {table.total > 0 && (
                        <div className="table-detail">
                          <span>💰</span>
                          <span>{formatCurrency(table.total)}</span>
                        </div>
                      )}
                    </div>
                    {renderTableActions(table)}
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Table Diagram Modal */}
      <Modal
        isOpen={showTableDiagram}
        onClose={() => setShowTableDiagram(false)}
        title="🗺️ Sơ đồ bàn ăn"
        size="large"
      >
        <div className="diagram-controls">
          <div className="diagram-search">
            <input
              type="text"
              className="diagram-search-input"
              placeholder="🔍 Tìm bàn..."
              value={diagramSearchQuery}
              onChange={(e) => setDiagramSearchQuery(e.target.value)}
            />
          </div>
          <div className="diagram-filters">
            <select
              className="diagram-filter-select"
              value={diagramFloorFilter}
              onChange={(e) => setDiagramFloorFilter(e.target.value)}
            >
              <option value="">Tất cả tầng</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.name}
                </option>
              ))}
            </select>
            <select
              className="diagram-filter-select"
              value={diagramStatusFilter}
              onChange={(e) => setDiagramStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="available">🟢 Trống</option>
              <option value="occupied">🟡 Có khách</option>
              <option value="reserved">🔵 Đã đặt</option>
              <option value="cleaning">🟣 Dọn dẹp</option>
            </select>
          </div>
        </div>

        <div className="diagram-container">
          <svg
            className="diagram-svg"
            width="100%"
            height="500"
            viewBox="0 0 600 400"
          >
            <defs>
              <pattern
                id="grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 L 0 20"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {getDiagramFilteredTables().map((t) => (
              <g key={t.id} className={`diagram-table ${t.status}`}>
                <circle
                  cx={t.x}
                  cy={t.y}
                  r="25"
                  className={`table-circle status-${t.status}`}
                  onClick={() => handleTableClick(t.id)}
                />
                <text
                  x={t.x}
                  y={t.y - 5}
                  textAnchor="middle"
                  className="table-number-text"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {t.number}
                </text>
                <text
                  x={t.x}
                  y={t.y + 8}
                  textAnchor="middle"
                  className="table-seats-text"
                  fontSize="8"
                >
                  {t.seats > 0 ? `${t.seats} chỗ` : "Mang về"}
                </text>
                {t.customer && (
                  <text
                    x={t.x}
                    y={t.y + 45}
                    textAnchor="middle"
                    className="table-customer-text"
                    fontSize="8"
                    fill="#64748b"
                  >
                    {t.customer.length > 10
                      ? t.customer.substring(0, 10) + "..."
                      : t.customer}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        <div className="diagram-legend">
          <div className="legend-item">
            <div className="legend-circle available"></div>
            <span>Trống</span>
          </div>
          <div className="legend-item">
            <div className="legend-circle occupied"></div>
            <span>Có khách</span>
          </div>
          <div className="legend-item">
            <div className="legend-circle reserved"></div>
            <span>Đã đặt</span>
          </div>
          <div className="legend-item">
            <div className="legend-circle cleaning"></div>
            <span>Dọn dẹp</span>
          </div>
        </div>
      </Modal>

      {/* Floor Modal */}
      <Modal
        isOpen={showFloorModal}
        onClose={() => {
          setShowFloorModal(false);
          setFloorForm({ name: "", icon: "", description: "" });
          setEditingFloor(null);
        }}
        title={editingFloor ? "✏️ Sửa thông tin tầng" : "🏗️ Thêm tầng mới"}
      >
        <div className="form-group">
          <label className="form-label">Tên tầng</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: Tầng 1, Tầng trệt, Sân thượng..."
            value={floorForm.name}
            onChange={(e) =>
              setFloorForm((p) => ({ ...p, name: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Biểu tượng</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: 1️⃣, 🏢, 🌳..."
            maxLength="2"
            value={floorForm.icon}
            onChange={(e) =>
              setFloorForm((p) => ({ ...p, icon: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Mô tả</label>
          <input
            type="text"
            className="form-input"
            placeholder="Mô tả ngắn về tầng này..."
            value={floorForm.description}
            onChange={(e) =>
              setFloorForm((p) => ({ ...p, description: e.target.value }))
            }
          />
        </div>
        <div className="modal-footer">
          <Button
            variant="secondary"
            onClick={() => {
              setShowFloorModal(false);
              setFloorForm({ name: "", icon: "", description: "" });
              setEditingFloor(null);
            }}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={saveFloor}>
            💾 Lưu tầng
          </Button>
        </div>
      </Modal>

      {/* Add Table Modal */}
      <Modal
        isOpen={showAddTableModal}
        onClose={() => {
          setShowAddTableModal(false);
          setTableForm({ number: "", seats: 4, floorId: "", area: "indoor" });
        }}
        title="➕ Thêm bàn mới"
      >
        <div className="form-group">
          <label className="form-label">Số bàn</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: B01, A12..."
            value={tableForm.number}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, number: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Số chỗ ngồi</label>
          <input
            type="number"
            className="form-input"
            min="1"
            max="20"
            value={tableForm.seats}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, seats: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Tầng</label>
          <select
            className="form-select"
            value={tableForm.floorId}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, floorId: e.target.value }))
            }
          >
            <option value="">Chọn tầng...</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon} {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Khu vực</label>
          <select
            className="form-select"
            value={tableForm.area}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, area: e.target.value }))
            }
          >
            <option value="indoor">🏢 Trong nhà</option>
            <option value="outdoor">🌳 Ngoài trời</option>
            <option value="takeaway">📦 Mang về</option>
            <option value="vip">👑 VIP</option>
          </select>
        </div>
        <div className="modal-footer">
          <Button
            variant="secondary"
            onClick={() => {
              setShowAddTableModal(false);
              setTableForm({
                number: "",
                seats: 4,
                floorId: "",
                area: "indoor",
              });
            }}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={saveTable}>
            💾 Thêm bàn
          </Button>
        </div>
      </Modal>

      {/* Table Detail Modal */}
      <Modal
        isOpen={showTableDetail}
        onClose={() => setShowTableDetail(false)}
        title={selectedTableDetail ? `🍽️ ${selectedTableDetail.number}` : ""}
        size="large"
      >
        {selectedTableDetail && (
          <>
            <div className="table-quick-info">
              <span className="quick-info-item">
                👤 {selectedTableDetail.customer || "Chưa có khách"}
              </span>
              <span className="quick-info-item">
                ⏰ {calculateDuration(selectedTableDetail.entryTime)}
              </span>
              <span className="quick-info-item">
                💰 {formatCurrency(selectedTableDetail.total)}
              </span>
            </div>

            <div className="orders-section">
              <div className="orders-header">
                <h4 className="section-title">📋 Món đã order</h4>
                <div className="orders-summary">
                  <span className="orders-count">
                    {selectedTableDetail.orders?.length || 0} món
                  </span>
                  <span className="orders-total">
                    {formatCurrency(selectedTableDetail.total)}
                  </span>
                </div>
              </div>
              <div className="orders-list">
                {selectedTableDetail.orders &&
                selectedTableDetail.orders.length > 0 ? (
                  selectedTableDetail.orders.map((order, idx) => (
                    <div key={idx} className="order-item">
                      <div className="order-item-info">
                        <div className="order-item-name">
                          {order.item}{" "}
                          <span style={{ color: "#64748b" }}>
                            x{order.quantity}
                          </span>
                        </div>
                        <div className="order-item-details">
                          {order.cookingMethod
                            ? `🍳 ${order.cookingMethod}`
                            : ""}
                          {order.customMethod
                            ? ` • ✨ ${order.customMethod}`
                            : ""}
                          {!order.cookingMethod && !order.customMethod
                            ? "📝 Không có ghi chú đặc biệt"
                            : ""}
                        </div>
                      </div>
                      <div className="order-item-price">
                        {formatCurrency(order.subtotal)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🍽️</div>
                    <div className="empty-state-text">Chưa có món nào</div>
                    <div className="empty-state-subtext">
                      Nhấn "Order thêm" để thêm món
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="secondary"
                onClick={() => setShowTableDetail(false)}
              >
                Đóng
              </Button>
              {selectedTableDetail.status === "occupied" && (
                <>
                  <Button
                    variant="warning"
                    onClick={() => {
                      setShowTableDetail(false);
                      openOrderModal(selectedTableDetail.id);
                    }}
                  >
                    📝 Order thêm
                  </Button>
                  <Button variant="success" onClick={openPaymentModal}>
                    💰 Thanh toán
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Order Modal */}
      <Modal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        title={currentTable ? `🍽️ Order cho ${currentTable.number}` : ""}
        size="lg"
      >
        {currentTable && (
          <>
            <div className="order-header">
              <div className="menu-search">
                <input
                  type="text"
                  className="menu-search-input"
                  placeholder="🔍 Tìm món ăn..."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                />
              </div>

              {currentTable.area === "takeaway" && (
                <div className="delivery-partners">
                  <h4 className="section-title">🚚 Chọn đối tác giao hàng</h4>
                  <div className="partners-grid">
                    {deliveryPartners
                      .filter((p) => p.status === "online")
                      .map((p) => (
                        <div
                          key={p.id}
                          className={`partner-card ${
                            selectedDeliveryPartner?.id === p.id
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => setSelectedDeliveryPartner(p)}
                        >
                          <div className="partner-logo">{p.logo}</div>
                          <div className="partner-info">
                            <div className="partner-name">{p.name}</div>
                            <div className="partner-commission">
                              Hoa hồng: {p.commission}
                            </div>
                            <div className="partner-rating">⭐ {p.rating}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="menu-sections">
              <div className="menu-section">
                <h4 className="section-title">🍜 Món chính</h4>
                <div className="menu-items">
                  {getFilteredMenuItems()
                    .filter((i) => i.category === "main")
                    .map((item) => (
                      <div key={item.id} className="menu-item">
                        <div className="menu-item-info">
                          <div className="menu-item-name">{item.name}</div>
                          <div className="menu-item-description">
                            {item.description}
                          </div>
                          <div className="menu-item-price">
                            {formatCurrency(item.price)}
                          </div>
                          {currentOrder[item.id]?.cookingMethod && (
                            <div className="selected-method">
                              🍳 {currentOrder[item.id].cookingMethod}
                            </div>
                          )}
                        </div>
                        <div className="menu-item-actions">
                          <div className="quantity-controls">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateQuantity(item.id, -1)}
                              disabled={
                                !currentOrder[item.id] ||
                                currentOrder[item.id].quantity <= 0
                              }
                            >
                              -
                            </Button>
                            <span className="quantity">
                              {currentOrder[item.id]?.quantity || 0}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="menu-section">
                <h4 className="section-title">🥤 Đồ uống</h4>
                <div className="menu-items">
                  {getFilteredMenuItems()
                    .filter((i) => i.category === "beverage")
                    .map((item) => (
                      <div key={item.id} className="menu-item">
                        <div className="menu-item-info">
                          <div className="menu-item-name">{item.name}</div>
                          <div className="menu-item-description">
                            {item.description}
                          </div>
                          <div className="menu-item-price">
                            {formatCurrency(item.price)}
                          </div>
                          {currentOrder[item.id]?.cookingMethod && (
                            <div className="selected-method">
                              🍳 {currentOrder[item.id].cookingMethod}
                            </div>
                          )}
                        </div>
                        <div className="menu-item-actions">
                          <div className="quantity-controls">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateQuantity(item.id, -1)}
                              disabled={
                                !currentOrder[item.id] ||
                                currentOrder[item.id].quantity <= 0
                              }
                            >
                              -
                            </Button>
                            <span className="quantity">
                              {currentOrder[item.id]?.quantity || 0}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="order-summary">
              <h4 className="section-title">📋 Tóm tắt đơn hàng</h4>
              <div className="summary-items">
                {Object.keys(currentOrder).filter(
                  (id) => currentOrder[id].quantity > 0
                ).length === 0 ? (
                  <div className="summary-item">
                    <span>Chưa có món nào</span>
                    <span>0đ</span>
                  </div>
                ) : (
                  Object.keys(currentOrder)
                    .filter((id) => currentOrder[id].quantity > 0)
                    .map((id) => {
                      const item = [
                        ...menuItems.main,
                        ...menuItems.beverages,
                      ].find((i) => i.id == id);
                      const orderItem = currentOrder[id];
                      const itemPrice = orderItem.price || item.price;
                      const subtotal = itemPrice * orderItem.quantity;
                      return (
                        <div key={id} className="summary-item">
                          <span>
                            {item.name} x{orderItem.quantity}
                          </span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                      );
                    })
                )}
                <div className="summary-total">
                  <span>Tổng cộng:</span>
                  <span>
                    {formatCurrency(
                      Object.keys(currentOrder)
                        .filter((id) => currentOrder[id].quantity > 0)
                        .reduce((total, id) => {
                          const item = [
                            ...menuItems.main,
                            ...menuItems.beverages,
                          ].find((i) => i.id == id);
                          const orderItem = currentOrder[id];
                          const itemPrice = orderItem.price || item.price;
                          return total + itemPrice * orderItem.quantity;
                        }, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="secondary"
                onClick={() => setShowOrderModal(false)}
              >
                Hủy
              </Button>
              <Button variant="primary" onClick={submitOrder}>
                🛒 Xác nhận đơn hàng
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Cooking Method Modal */}
      <Modal
        isOpen={showCookingMethodModal}
        onClose={() => setShowCookingMethodModal(false)}
        title={
          currentCookingItem
            ? `🍳 Chọn cách chế biến - ${currentCookingItem.name}`
            : ""
        }
      >
        {currentCookingItem && (
          <>
            <div className="cooking-methods">
              {currentCookingItem.cookingMethods.map((method, idx) => (
                <div
                  key={idx}
                  className="cooking-method"
                  onClick={() =>
                    selectCookingMethod(currentCookingItem.id, method)
                  }
                >
                  <div className="method-info">
                    <div className="method-name">{method.name}</div>
                    <div className="method-description">
                      {method.description}
                    </div>
                  </div>
                  <div className="method-price">
                    {formatCurrency(method.price)}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <Button
                variant="secondary"
                onClick={() => setShowCookingMethodModal(false)}
              >
                Hủy
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={
          selectedTableDetail
            ? `💰 Thanh toán - ${selectedTableDetail.number}`
            : ""
        }
        size="large"
      >
        {selectedTableDetail && (
          <>
            <div className="payment-section">
              <h4 className="payment-section-title">📋 Chi tiết hóa đơn</h4>
              <div className="bill-summary">
                {selectedTableDetail.orders &&
                selectedTableDetail.orders.length > 0 ? (
                  selectedTableDetail.orders.map((order, idx) => (
                    <div key={idx} className="bill-item">
                      <div className="bill-item-info">
                        <div className="bill-item-name">
                          {order.item} x{order.quantity}
                        </div>
                        <div className="bill-item-details">
                          {order.cookingMethod
                            ? `🍳 ${order.cookingMethod}`
                            : ""}
                          {order.customMethod
                            ? ` • ✨ ${order.customMethod}`
                            : ""}
                        </div>
                      </div>
                      <div className="bill-item-price">
                        {formatCurrency(order.subtotal)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Không có món nào</div>
                )}
              </div>
            </div>

            <div className="payment-section">
              <h4 className="payment-section-title">
                💳 Phương thức thanh toán
              </h4>
              <div className="payment-methods">
                {[
                  {
                    id: "cash",
                    icon: "💵",
                    name: "Tiền mặt",
                    desc: "Thanh toán bằng tiền mặt",
                  },
                  {
                    id: "card",
                    icon: "💳",
                    name: "Thẻ ngân hàng",
                    desc: "Visa, Mastercard, ATM",
                  },
                  {
                    id: "transfer",
                    icon: "📱",
                    name: "Chuyển khoản",
                    desc: "Banking, Momo, ZaloPay",
                  },
                ].map((m) => (
                  <div
                    key={m.id}
                    className={`payment-method ${
                      selectedPaymentMethod === m.id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedPaymentMethod(m.id)}
                  >
                    <div className="payment-method-icon">{m.icon}</div>
                    <div className="payment-method-info">
                      <div className="payment-method-name">{m.name}</div>
                      <div className="payment-method-desc">{m.desc}</div>
                    </div>
                    <div className="payment-method-check">✓</div>
                  </div>
                ))}
              </div>
            </div>

            {selectedPaymentMethod === "cash" && (
              <div className="payment-section">
                <h4 className="payment-section-title">
                  💵 Thanh toán tiền mặt
                </h4>
                <div className="cash-payment">
                  <div className="form-group">
                    <label className="form-label">Khách đưa</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      min="0"
                      value={customerPaid}
                      onChange={(e) => setCustomerPaid(e.target.value)}
                    />
                  </div>
                  <div className="change-display">
                    <div className="change-label">Tiền thừa</div>
                    <div
                      className={`change-amount ${
                        calculateChange() >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {calculateChange() >= 0
                        ? formatCurrency(calculateChange())
                        : formatCurrency(Math.abs(calculateChange())) +
                          " (thiếu)"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="payment-total">
              <div className="payment-total-row">
                <span>Tạm tính:</span>
                <span>{formatCurrency(selectedTableDetail.total)}</span>
              </div>
              <div className="payment-total-row">
                <span>Thuế VAT (10%):</span>
                <span>
                  {formatCurrency(Math.round(selectedTableDetail.total * 0.1))}
                </span>
              </div>
              <div className="payment-total-row total">
                <span>Tổng cộng:</span>
                <span>
                  {formatCurrency(
                    selectedTableDetail.total +
                      Math.round(selectedTableDetail.total * 0.1)
                  )}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <Button
                variant="secondary"
                onClick={() => setShowPaymentModal(false)}
              >
                Hủy
              </Button>
              <Button variant="success" onClick={processPaymentConfirm}>
                💰 Xác nhận thanh toán
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TableManagement;
