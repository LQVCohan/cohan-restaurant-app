import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import cls from "./RightPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { useNotification } from "../../../../../hooks/useNotification";
import { formatPrice } from "@/utils/formatters";
import PaymentModal from "../modals/PaymentModal";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";
import MenuItemModal from "../modals/MenuItemModal";

// --- Icons Definition ---
const IconImage = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: "middle" }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const IconSettings = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const IconDashboard = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

const IconOrderList = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 6h11"></path>
    <path d="M9 12h11"></path>
    <path d="M9 18h11"></path>
    <path d="M5 6v.01"></path>
    <path d="M5 12v.01"></path>
    <path d="M5 18v.01"></path>
  </svg>
);

export default function RightPanel() {
  const navigate = useNavigate();
  const {
    currentTable,
    currentOrder,
    currentOrderType,
    shippingInfo,
    deliveryCustomer,
    updateItemQty,
    removeItem,
    finalTotals,
    clearOrder,
    saveOrder,
    setTableStatus,
    setCurrentTable,
    preparePayment,
  } = usePos();

  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  // --- States ---
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isClearModalOpen, setClearModalOpen] = useState(false);

  // --- Dropdown Menu Logic ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuNavigate = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  // --- Computations ---
  const hasItems = Array.isArray(currentOrder) && currentOrder.length > 0;

  const { existingItems, newItems } = useMemo(() => {
    const ex = [];
    const nw = [];
    (currentOrder || []).forEach((it) => {
      if (it.isExisting && !it.isNew) ex.push(it);
      else nw.push(it);
    });
    return { existingItems: ex, newItems: nw };
  }, [currentOrder]);

  const isOffPremise =
    currentOrderType === "delivery" || currentOrderType === "takeaway";

  // --- Handlers ---
  const closePaymentModal = useCallback(() => setPaymentModalOpen(false), []);

  const openPaymentModal = useCallback(async () => {
    if (!hasItems) return;

    // Hiện tại thanh toán POS chỉ support dine-in
    if (isOffPremise) {
      showNotification(
        "Thanh toán tại POS hiện chỉ áp dụng cho đơn tại bàn.",
        "warning"
      );
      return;
    }

    if (!currentTable?.restaurantId) {
      showNotification("Thiếu restaurantId.", "error");
      return;
    }
    const res = await preparePayment({
      restaurantId: currentTable.restaurantId,
    });
    if (!res?.success) {
      showNotification(res?.message || "Lưu đơn thất bại.", "error");
      return;
    }
    setPaymentModalOpen(true);
  }, [hasItems, currentTable, preparePayment, showNotification, isOffPremise]);

  const handlePaymentComplete = useCallback(
    (payload) => {
      showNotification("Thanh toán thành công.", "success");
      const inv =
        payload?.server?.invoice?.number || payload?.server?.invoice?.id;
      if (inv) showNotification(`Hóa đơn: ${inv}`, "info");

      clearOrder();
      if (currentTable?.id && setTableStatus) {
        setTableStatus({ id: currentTable.id, status: "available" });
      }
      if (setCurrentTable) setCurrentTable(null);

      setPaymentModalOpen(false);
    },
    [
      clearOrder,
      currentTable,
      setTableStatus,
      setCurrentTable,
      showNotification,
    ]
  );

  const handleSaveOrder = async () => {
    // Với dine_in thì vẫn bắt buộc phải chọn bàn
    if (!currentTable && currentOrderType === "dine_in") {
      showNotification("Vui lòng chọn bàn trước khi lưu.", "error");
      return;
    }

    // saveOrder trong PosContext đã tự merge restaurantId rồi,
    // nên ở đây chỉ cần truyền thêm flag nếu cần
    const res = await saveOrder?.({
      persist: true,
    });

    if (res?.success) {
      setPulse(true);
      setTimeout(() => setPulse(false), 650);

      if (currentOrderType === "dine_in" && currentTable) {
        showNotification(
          `Đã lưu vào bàn ${currentTable.code}`,
          "success",
          3000
        );
      } else if (currentOrderType === "delivery") {
        showNotification("Đã lưu đơn giao hàng.", "success", 3000);
      } else if (currentOrderType === "takeaway") {
        showNotification("Đã lưu đơn mang đi.", "success", 3000);
      } else {
        showNotification("Đã lưu đơn hàng.", "success", 3000);
      }
    } else {
      showNotification(res?.message || "Lưu đơn hàng thất bại.", "error");
    }
  };

  const handleQtyChange = (e, item, change) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) return;
    const next = Math.max(1, Number(item.quantity || 1) + change);
    updateItemQty(item._lineId || item.dishId || item.id, next);
  };

  const handleQtyInput = (e, item) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) return;
    const v = Math.max(1, Number(e.target.value) || 1);
    updateItemQty(item._lineId || item.dishId || item.id, v);
  };

  const handleDeleteClick = (e, item) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDeleteItem = (action, selectedReason) => {
    removeItem(itemToDelete._lineId || itemToDelete.dishId || itemToDelete.id);
    setDeleteModalOpen(false);
    setItemToDelete(null);
    showNotification(
      `Đã xóa món${selectedReason ? ` — ${selectedReason}` : ""}`,
      "info"
    );
  };

  const handleClearConfirm = (action) => {
    if (action === "clear_table") {
      clearOrder();
      if (currentTable?.id && setTableStatus) {
        setTableStatus({ id: currentTable.id, status: "available" });
      }
      if (setCurrentTable) setCurrentTable(null);
      showNotification(
        currentTable?.code
          ? `Đã xóa thông tin bàn ${currentTable.code}`
          : "Đã xóa đơn hiện tại"
      );
    } else {
      clearOrder();
      showNotification(`Đã xóa tất cả món (giữ thông tin bàn/đơn)`);
    }
    setClearModalOpen(false);
  };

  const handlePrint = (mode = "draft") => {
    try {
      showNotification(
        mode === "final" ? "In hóa đơn..." : "In phiếu tạm tính...",
        "info"
      );
    } catch (e) {
      showNotification("Không thể in. Vui lòng thử lại.", "error");
    }
  };

  const handleItemClick = (item) => {
    const modalItemData = {
      ...item,
      id: item.dishId || item.id,
      thumbImage: item.image,
    };
    setSelectedDetailItem(modalItemData);
    setDetailModalOpen(true);
  };

  // --- Helpers ---
  const getItemPrice = (item) => formatPrice(Number(item.price || 0));
  const getItemTotal = (item) => {
    const t =
      item.total != null
        ? Number(item.total)
        : Number(item.price || 0) * Number(item.quantity || 1);
    return formatPrice(t);
  };

  const formatTime = (dateInput) => {
    if (!dateInput) return "";
    let dateObj;
    if (typeof dateInput === "string" && /^\d+$/.test(dateInput)) {
      dateObj = new Date(parseInt(dateInput, 10));
    } else {
      dateObj = new Date(dateInput);
    }
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- Totals Logic ---
  const totals = finalTotals || {};
  const breakdownConfig = [
    { key: "subtotal", label: "Tạm tính", cls: "" },
    { key: "discount", label: "Giảm giá", cls: "neg" },
    { key: "service", label: "Phí phục vụ", cls: "" },
    { key: "tax", label: "Thuế", cls: "" },
  ];

  const breakdownRows = breakdownConfig
    .filter(({ key }) => totals[key] !== undefined && totals[key] !== null)
    .map(({ key, label, cls: c }) => ({
      label,
      value: totals[key],
      clsName: c,
    }));

  const headerTitle = isOffPremise
    ? currentOrderType === "delivery"
      ? "Đơn giao hàng"
      : "Đơn mang về"
    : currentTable
    ? `Bàn ${currentTable.code}`
    : "Chọn bàn";

  const headerMeta = (() => {
    if (isOffPremise) {
      const name = shippingInfo?.fullName || deliveryCustomer?.name || "";
      const phone = shippingInfo?.phone || deliveryCustomer?.phone || "";
      const addr = shippingInfo?.address || "";
      return {
        line1: name || phone ? `${name || "Khách"} · ${phone || ""}` : "",
        line2: addr || "Chưa có địa chỉ giao hàng",
      };
    }
    if (currentTable) {
      return {
        line1: `${currentTable.capacity || 0} chỗ`,
        line2: currentTable.status || "available",
      };
    }
    return {
      line1: "Chưa chọn bàn",
      line2: "",
    };
  })();

  return (
    <div
      className={`${cls.wrapper} ${pulse ? cls.pulse : ""}`}
      data-pos-order-panel
    >
      {/* --- Modals --- */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        totalAmount={finalTotals?.total || 0}
        order={currentOrder}
        table={currentTable}
        onConfirm={() => {}}
        onComplete={handlePaymentComplete}
      />
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteItem}
      />
      <ConfirmDeleteModal
        isOpen={isClearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleClearConfirm}
        showScopeChoice={true}
      />
      <MenuItemModal
        isOpen={detailModalOpen}
        item={selectedDetailItem}
        onClose={() => setDetailModalOpen(false)}
        isReviewMode={true}
      />

      {/* --- HEADER --- */}
      <div className={cls.header}>
        <div className={cls.headerLeft}>
          <div className={cls.tableName}>{headerTitle}</div>
          <div className={cls.tableMeta}>
            {headerMeta.line1}
            {headerMeta.line1 && headerMeta.line2 ? " · " : ""}
            <span className={cls.statusBadge}>{headerMeta.line2}</span>
          </div>
        </div>

        {/* Dropdown Menu */}
        <div className={cls.headerRight}>
          <div className={cls.menuWrapper} ref={menuRef}>
            <button
              className={`${cls.manageBtn} ${isMenuOpen ? cls.active : ""}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Tùy chọn quản lý"
            >
              <IconSettings /> Quản lý
            </button>
            {isMenuOpen && (
              <div className={cls.dropdownMenu}>
                <div
                  className={cls.dropdownItem}
                  onClick={() => handleMenuNavigate("/manager")}
                >
                  <IconDashboard /> Dashboard
                </div>
                <div
                  className={cls.dropdownItem}
                  onClick={() => handleMenuNavigate("/manager#orders")}
                >
                  <IconOrderList /> Order
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- BODY --- */}
      <div className={cls.body}>
        {/* Section 1: Món Mới (Compact) */}
        {newItems.length > 0 && (
          <div className={cls.sectionNew}>
            <div className={cls.groupHeader}>Món mới ({newItems.length})</div>
            <div className={cls.itemsList}>
              {newItems.map((item) => (
                <div
                  key={item._lineId || item.dishId || item.id}
                  className={cls.cardNew}
                  onClick={() => handleItemClick(item)}
                >
                  {/* Dòng 1: Tên + Icon ảnh + Nút xóa */}
                  <div className={cls.rowTop}>
                    <div className={cls.cardName}>
                      {item.name}
                      {item.proofImages && item.proofImages.length > 0 && (
                        <span className={cls.iconProof} title="Có ảnh xác nhận">
                          <IconImage />
                        </span>
                      )}
                    </div>
                    <button
                      className={cls.btnDelete}
                      onClick={(e) => handleDeleteClick(e, item)}
                      title="Xóa"
                    >
                      <IconTrash />
                    </button>
                  </div>

                  {/* Dòng 2: Note (nếu có) */}
                  {(item.method || item.cookingOption || item.note) && (
                    <div className={cls.rowNote}>
                      {item.method || item.cookingOption ? (
                        <span className={cls.tagMethod}>
                          {item.method || item.cookingOption}
                        </span>
                      ) : null}
                      {item.note && (
                        <span className={cls.textNote}>{item.note}</span>
                      )}
                    </div>
                  )}

                  {/* Dòng 3: Giá + Số lượng + Tổng */}
                  <div className={cls.rowBottom}>
                    <div className={cls.priceSingle}>{getItemPrice(item)}</div>
                    <div
                      className={cls.qtyWrapper}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={cls.qtyBtn}
                        onClick={(e) => handleQtyChange(e, item, -1)}
                      >
                        −
                      </button>
                      <input
                        className={cls.qtyInput}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQtyInput(e, item)}
                      />
                      <button
                        className={cls.qtyBtn}
                        onClick={(e) => handleQtyChange(e, item, +1)}
                      >
                        +
                      </button>
                    </div>
                    <div className={cls.cardTotal}>{getItemTotal(item)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: Món Đã Gửi Bếp (Compact) */}
        {existingItems.length > 0 && (
          <div className={cls.sectionExisting}>
            <div className={cls.dividerLabel}>
              Đã gửi bếp ({existingItems.length})
            </div>
            <div className={cls.itemsList}>
              {existingItems.map((item) => (
                <div
                  key={item._lineId || item.dishId || item.id}
                  className={cls.cardExisting}
                  onClick={() => handleItemClick(item)}
                >
                  <div className={cls.rowTop}>
                    <div className={cls.cardName}>
                      {item.name}
                      {item.proofImages && item.proofImages.length > 0 && (
                        <span className={cls.iconProof} title="Có ảnh xác nhận">
                          <IconImage />
                        </span>
                      )}
                    </div>
                    {item.createdAt && (
                      <span className={cls.timeTag}>
                        {formatTime(item.createdAt)}
                      </span>
                    )}
                  </div>

                  {(item.note || item.method || item.cookingOption) && (
                    <div className={cls.rowNote}>
                      {(item.method || item.cookingOption) && (
                        <span className={cls.tagMethod}>
                          {item.method || item.cookingOption}
                        </span>
                      )}
                      {item.note && (
                        <span className={cls.textNoteSaved}>{item.note}</span>
                      )}
                    </div>
                  )}

                  <div className={cls.rowBottom}>
                    <div className={cls.priceSingle}>{getItemPrice(item)}</div>
                    <div className={cls.qtyStatic}>x{item.quantity}</div>
                    <div className={cls.cardTotal}>{getItemTotal(item)}</div>
                    <button
                      className={cls.btnDeleteSaved}
                      onClick={(e) => handleDeleteClick(e, item)}
                      title="Hủy món"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hasItems && (
          <div className={cls.emptyState}>
            <p>Trống</p>
          </div>
        )}
      </div>

      {/* --- FOOTER --- */}
      <div className={cls.footer}>
        <div className={cls.summary}>
          <div className={cls.row}>
            <span>Tạm tính:</span>
            <strong>{formatPrice(finalTotals?.subtotal || 0)}</strong>
          </div>
          <button
            type="button"
            className={cls.breakdownToggle}
            onClick={() => setShowBreakdown((v) => !v)}
          >
            {showBreakdown ? "Thu gọn ▲" : "Chi tiết ▼"}
          </button>
          {showBreakdown && (
            <div id="totals-breakdown" className={cls.breakdown}>
              {breakdownRows.map((r) => (
                <div
                  key={r.label}
                  className={`${cls.breakdownRow} ${cls[r.clsName] || ""}`}
                >
                  <span>{r.label}</span>
                  <span>{formatPrice(Number(r.value) || 0)}</span>
                </div>
              ))}
              <div className={cls.hr} />
            </div>
          )}
          <div className={`${cls.row} ${cls.grand}`}>
            <span>Tổng cộng:</span>
            <strong>{formatPrice(finalTotals?.total || 0)}</strong>
          </div>
        </div>

        {/* Actions Grid */}
        <div className={cls.actionsGrid}>
          <button
            className={`${cls.btn} ${cls.secondary}`}
            onClick={() => setClearModalOpen(true)}
            disabled={!hasItems}
          >
            Xóa
          </button>
          <button
            className={`${cls.btn} ${cls.primary}`}
            onClick={handleSaveOrder}
            disabled={!hasItems || newItems.length === 0}
          >
            Lưu
          </button>
          <button
            className={`${cls.btn} ${cls.success}`}
            disabled={!hasItems}
            onClick={openPaymentModal}
          >
            Thanh toán
          </button>
          <button
            className={`${cls.btn} ${cls.warning}`}
            onClick={() => handlePrint("draft")}
            disabled={!hasItems}
          >
            In
          </button>
        </div>
      </div>
    </div>
  );
}
