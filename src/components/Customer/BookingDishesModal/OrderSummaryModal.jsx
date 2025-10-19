import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useContext,
} from "react";
import Modal, { ModalFooter } from "../../common/Modal";
import ModifierModal from "./ModifierModal";
import { formatCurrency, formatQuantity } from "../../../utils/formatters";
import "./OrderSummaryModal.scss";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import SuccessModal from "../SuccessModal/SuccessModal";
import { AuthContext } from "../../../context/AuthContext";

const DEFAULT_SHIPPING = (prefill = {}) => ({
  fullName: prefill.fullName || "",
  phone: prefill.phone || "",
  email: prefill.email || "",
  address: "",
  note: "",
  deliveryMethod: "delivery",
  deliveryTime: "asap",
  scheduleDate: "",
  scheduleTime: "",
});

const ORDER_VAT_RATE = 0.1;

const RESTAURANT_BY_ID = gql`
  query RestaurantById($id: ID!) {
    restaurant(id: $id) {
      id
      name
    }
  }
`;

const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      orderCode
      restaurantId
      totals {
        grandTotal
      }
      currentStatus
    }
  }
`;

function useRestaurantName(restaurantId) {
  const skip = !restaurantId;
  const { data } = useQuery(RESTAURANT_BY_ID, {
    variables: { id: restaurantId },
    skip,
  });
  return data?.restaurant?.name;
}

const OrderSummaryModal = ({
  isOpen,
  onClose,
  items = [],
  restaurantId,
  onSuccess,
}) => {
  const { user, isAuthenticated } = useContext(AuthContext);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [currentView, setCurrentView] = useState("summary"); // summary | qr | success
  const [currentEditingItem, setCurrentEditingItem] = useState(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [orderData, setOrderData] = useState([]);
  const [orderInfo, setOrderInfo] = useState({ id: "", time: "" });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [createOrder] = useMutation(CREATE_ORDER);

  const [shipping, setShipping] = useState(DEFAULT_SHIPPING());
  const [shippingTouched, setShippingTouched] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  // Success modal data

  const [receipt, setReceipt] = useState(null);
  const handleCloseAll = () => {
    setIsSuccessOpen(false); // hoặc currentView = "summary"
    onClose?.(); // đóng OrderSummaryModal
  };
  // Chuẩn hóa items
  const mappedOrderData = useMemo(
    () =>
      (items || []).map((it) => ({
        id: it.id,
        dishId: it.dishId,
        restaurantId: it.restaurantId,
        name: it.name,
        image: it.image,
        cookingMethod: it.method || "",
        methodDelta: it.methodDelta || 0,
        description: it.description || "",
        unit: it.unit || "phần",
        quantity: it.quantity || 1,
        price: it.price || 0,
        modifiers: it.modifiers || [],
        modifiersPrice: it.modifiersPrice || 0,
        modifierGroupIds: it.modifierGroupIds || [],
        menuId: it.menuId,
        categoryId: it.categoryId,
      })),
    [items]
  );

  // Group theo nhà hàng
  const groupedByRestaurant = useMemo(() => {
    const map = new Map();
    for (const item of orderData) {
      const rid = item.restaurantId || "unknown";
      if (!map.has(rid)) map.set(rid, []);
      map.get(rid).push(item);
    }
    return map;
  }, [orderData]);

  const restaurantCount = useMemo(
    () => new Set(orderData.map((i) => i.restaurantId || "unknown")).size,
    [orderData]
  );

  useEffect(() => {
    if (isOpen) {
      const prefill = {
        fullName: user?.fullName,
        phone: user?.phone,
        email: user?.email,
      };
      generateOrderInfo();
      resetToSummaryView();
      setOrderData(mappedOrderData);
      setShipping(DEFAULT_SHIPPING(prefill));
      setShippingTouched(false);
    }
  }, [isOpen, mappedOrderData, user]);

  const generateOrderInfo = () => {
    const orderId =
      "DH" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const orderTime = new Date().toLocaleString("vi-VN");
    setOrderInfo({ id: orderId, time: orderTime });
  };

  const calculateSubtotals = () => {
    let subtotal = 0;
    let modifiersTotal = 0;
    orderData.forEach((item) => {
      subtotal += item.price * item.quantity;
      modifiersTotal += (item.modifiersPrice || 0) * item.quantity;
    });
    const total = subtotal + modifiersTotal;
    const tax = Math.round(total * ORDER_VAT_RATE);
    const finalTotal = total + tax;
    return { subtotal, modifiersTotal, tax, finalTotal };
  };

  const calcGroupTotals = useCallback((itemsOfGroup) => {
    let subtotal = 0;
    let modifiersTotal = 0;
    itemsOfGroup.forEach((item) => {
      subtotal += item.price * item.quantity;
      modifiersTotal += (item.modifiersPrice || 0) * item.quantity;
    });
    const total = subtotal + modifiersTotal;
    const tax = Math.round(total * ORDER_VAT_RATE);
    const finalTotal = total + tax;
    return { subtotal, modifiersTotal, tax, finalTotal };
  }, []);

  // Validate: name >=2, phone OR email, address if delivery, schedule ok
  const handleShippingChange = useCallback((field, value) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
    setShippingTouched(true);
  }, []);

  const isShippingValid = useMemo(() => {
    const nameOk = (shipping.fullName || "").trim().length >= 2;

    const phoneRaw = (shipping.phone || "").trim();
    const emailRaw = (shipping.email || "").trim();

    const phoneOk = phoneRaw ? /^(\+?\d{7,15})$/.test(phoneRaw) : false;
    const emailOk = emailRaw
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      : false;

    const contactOk = phoneOk || emailOk; // ✅ ít nhất 1 trong 2

    const needAddress = shipping.deliveryMethod === "delivery";
    const addressOk =
      !needAddress || (shipping.address || "").trim().length > 5;

    const scheduleOk =
      shipping.deliveryTime === "asap" ||
      (shipping.scheduleDate && shipping.scheduleTime);

    return nameOk && contactOk && scheduleOk && addressOk;
  }, [shipping]);

  const shippingErrors = useMemo(() => {
    if (!shippingTouched) return {};
    const errs = {};
    if (!shipping.fullName?.trim() || shipping.fullName.trim().length < 2) {
      errs.fullName = "Vui lòng nhập họ tên hợp lệ.";
    }
    const phoneRaw = (shipping.phone || "").trim();
    const emailRaw = (shipping.email || "").trim();
    const phoneOk = phoneRaw ? /^(\+?\d{7,15})$/.test(phoneRaw) : false;
    const emailOk = emailRaw
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      : false;
    if (!phoneOk && !emailOk) {
      errs.contact = "Cần ít nhất số điện thoại hợp lệ hoặc email hợp lệ.";
    }
    if (
      shipping.deliveryMethod === "delivery" &&
      (!shipping.address?.trim() || shipping.address.trim().length < 6)
    ) {
      errs.address = "Địa chỉ cần ít nhất 6 ký tự.";
    }
    if (
      shipping.deliveryTime === "schedule" &&
      (!shipping.scheduleDate || !shipping.scheduleTime)
    ) {
      errs.schedule = "Vui lòng chọn ngày/giờ giao hàng.";
    }
    return errs;
  }, [shipping, shippingTouched]);

  const handleAddModifier = (itemId) => {
    const item = orderData.find((i) => i.id === itemId);
    if (item) {
      setCurrentEditingItem(item);
      setIsModifierModalOpen(true);
    }
  };

  const handleApplyModifiers = (itemId, newModifiers, newModifiersPrice) => {
    setOrderData((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              modifiers: newModifiers,
              modifiersPrice: newModifiersPrice,
            }
          : item
      )
    );
  };

  const mapDeliveryToOrderType = (deliveryMethod) => {
    if (deliveryMethod === "dinein") return "dine_in";
    if (deliveryMethod === "pickup") return "takeaway";
    return "delivery";
  };

  // Tạo một orderCode chung cho whole checkout
  const genOrderCode = () =>
    "OC" + Math.random().toString(36).slice(2, 8).toUpperCase();

  const buildInputForRestaurant = useCallback(
    (rid, itemsOfGroup, shippingArg, paymentMethod, orderCode) => {
      const base = {
        orderCode,
        restaurantId: rid,
        orderType: mapDeliveryToOrderType(shippingArg?.deliveryMethod),
        shipping: shippingArg,
        paymentMethod,
        items: itemsOfGroup.map((i) => ({
          dishId: i.dishId,
          menuId: i.menuId,
          categoryId: i.categoryId,
          name: i.name,
          unit: i.unit || "phần",
          image: typeof i.image === "string" ? i.image : undefined,
          price: i.price,
          modifiersPrice: i.modifiersPrice || 0,
          method: i.cookingMethod || "",
          methodDelta: i.methodDelta || 0,
          description: i.description || "",
          quantity: i.quantity,
          modifiers: (i.modifiers || []).map((m) => ({
            optionId: m.optionId,
            optionName: m.optionName,
            groupId: m.groupId,
            price: m.price || 0,
          })),
        })),
      };
      // nếu đã login -> server tự lấy ctx.user, else -> gửi customer để tạo guest
      if (!isAuthenticated) {
        base.customer = {
          fullName: shippingArg?.fullName || undefined,
          phone: shippingArg?.phone || undefined,
          email: shippingArg?.email || undefined,
        };
      }
      return base;
    },
    [isAuthenticated]
  );

  const persistAllOrders = useCallback(
    async (paymentMethod) => {
      const code = genOrderCode();
      const calls = Array.from(groupedByRestaurant.entries()).map(
        ([rid, items]) => {
          const input = buildInputForRestaurant(
            rid,
            items,
            shipping,
            paymentMethod,
            code
          );
          return createOrder({ variables: { input } });
        }
      );
      const results = await Promise.all(calls);
      const created = results.map((r) => r?.data?.createOrder).filter(Boolean);
      return { orderCode: code, orders: created };
    },
    [groupedByRestaurant, buildInputForRestaurant, shipping, createOrder]
  );

  const setAndShowSuccess = (createdOrders) => {
    const totalPaid = createdOrders.reduce(
      (s, o) => s + (o?.totals?.grandTotal || 0),
      0
    );
    setReceipt({
      customerName: shipping.fullName,
      customerPhone: shipping.phone,
      address: shipping.address,
      deliveryMethod: shipping.deliveryMethod,
      deliveryTime: shipping.deliveryTime,
      scheduleDate: shipping.scheduleDate,
      scheduleTime: shipping.scheduleTime,
      note: shipping.note,
      paymentMethod: selectedPaymentMethod,
      totalPaid,
      orders: createdOrders.map((o) => ({
        id: o.id,
        restaurantId: o.restaurantId,
        grandTotal: o?.totals?.grandTotal || 0,
      })),
    });
    setIsSuccessOpen(true);
  };

  const handlePaymentMethodSelect = (method) =>
    setSelectedPaymentMethod(method);

  const handleConfirmPayment = async () => {
    if (!isShippingValid) {
      setShippingTouched(true);
      return;
    }
    if (!selectedPaymentMethod) {
      alert("Vui lòng chọn phương thức thanh toán!");
      return;
    }

    if (selectedPaymentMethod === "cash") {
      try {
        setIsProcessingPayment(true);
        const { orders: created } = await persistAllOrders("cash");
        setIsProcessingPayment(false);
        setCurrentView("success");
        setAndShowSuccess(created);
        onSuccess?.();
      } catch (err) {
        setIsProcessingPayment(false);
        alert(`Lưu đơn hàng thất bại: ${err?.message || err}`);
      }
    } else if (selectedPaymentMethod === "transfer") {
      setCurrentView("qr");
    }
  };

  const handleQRPayment = async () => {
    try {
      setIsProcessingPayment(true);
      const { orders: created } = await persistAllOrders("transfer");
      setIsProcessingPayment(false);
      setCurrentView("success");
      setAndShowSuccess(created);
      onSuccess?.();
    } catch (err) {
      setIsProcessingPayment(false);
      alert(`Lưu đơn hàng thất bại: ${err?.message || err}`);
    }
  };

  const resetToSummaryView = () => {
    setCurrentView("summary");
    setSelectedPaymentMethod(null);
    setIsProcessingPayment(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case "success":
        return <SuccessScreen onNewOrder={() => onClose()} />;
      case "qr":
        return (
          <QRPaymentScreen
            amount={calculateSubtotals().finalTotal}
            onConfirm={handleQRPayment}
            isProcessing={isProcessingPayment}
          />
        );
      default:
        return (
          <SummaryContent
            orderInfo={orderInfo}
            orderData={orderData}
            groupedByRestaurant={groupedByRestaurant}
            subtotals={calculateSubtotals()}
            shipping={shipping}
            shippingErrors={shippingErrors}
            onShippingChange={handleShippingChange}
            selectedPaymentMethod={selectedPaymentMethod}
            onAddModifier={handleAddModifier}
            onPaymentMethodSelect={handlePaymentMethodSelect}
            restaurantCount={restaurantCount}
            calcGroupTotals={calcGroupTotals}
          />
        );
    }
  };

  const renderFooter = () => {
    switch (currentView) {
      case "success":
        return (
          <ModalFooter>
            <button className="btn btn--primary" onClick={() => onClose()}>
              Đặt hàng mới
            </button>
          </ModalFooter>
        );
      case "qr":
        return (
          <ModalFooter>
            <button className="btn btn--secondary" onClick={resetToSummaryView}>
              Quay lại
            </button>
            <button
              className="btn btn--success"
              onClick={handleQRPayment}
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? (
                <>
                  <span className="loading-spinner" />
                  Đang xử lý...
                </>
              ) : (
                "Tôi đã thanh toán"
              )}
            </button>
          </ModalFooter>
        );
      default:
        return (
          <ModalFooter>
            <button className="btn btn--secondary" onClick={onClose}>
              Đóng
            </button>
            <button
              className="btn btn--primary"
              onClick={() => alert("Chỉnh sửa đơn hàng")}
            >
              Chỉnh sửa đơn hàng
            </button>
            <button
              className="btn btn--success"
              onClick={handleConfirmPayment}
              disabled={
                !isShippingValid ||
                !selectedPaymentMethod ||
                isProcessingPayment
              }
              title={
                !isShippingValid
                  ? "Vui lòng nhập đầy đủ thông tin giao hàng (tên + SĐT hoặc email)"
                  : !selectedPaymentMethod
                  ? "Chọn phương thức thanh toán"
                  : undefined
              }
            >
              {isProcessingPayment ? "Đang lưu đơn..." : "Xác nhận thanh toán"}
            </button>
          </ModalFooter>
        );
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="📦 Xác nhận đơn hàng"
        size="lg"
        className="order-summary-modal"
      >
        <div className="order-summary-wrapper">
          <div className="order-summary-content">{renderContent()}</div>
          {renderFooter()}
        </div>
      </Modal>

      <ModifierModal
        isOpen={isModifierModalOpen}
        onClose={() => setIsModifierModalOpen(false)}
        item={currentEditingItem}
        onApply={handleApplyModifiers}
        restaurantId={currentEditingItem?.restaurantId ?? restaurantId}
      />

      {/* Success modal tổng hợp đơn (nhiều nhà hàng) */}
      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={handleCloseAll}
        kind="order"
        orderReceipt={receipt}
      />
    </>
  );
};

export default OrderSummaryModal;

/* ===================== Sub-components ===================== */

const SummaryContent = ({
  orderInfo,
  orderData,
  groupedByRestaurant,
  subtotals,
  shipping,
  shippingErrors,
  onShippingChange,
  selectedPaymentMethod,
  onAddModifier,
  onPaymentMethodSelect,
  restaurantCount,
  calcGroupTotals,
}) => (
  <>
    <RestaurantInfo
      orderInfo={orderInfo}
      orderData={orderData}
      restaurantCount={restaurantCount}
    />
    <ShippingForm
      value={shipping}
      errors={shippingErrors}
      onChange={onShippingChange}
    />
    <OrderItems
      groupedByRestaurant={groupedByRestaurant}
      onAddModifier={onAddModifier}
      calcGroupTotals={calcGroupTotals}
    />
    <PriceBreakdown subtotals={subtotals} />
    <PaymentMethods
      selectedMethod={selectedPaymentMethod}
      onSelect={onPaymentMethodSelect}
    />
  </>
);

const RestaurantInfo = ({ orderInfo, orderData, restaurantCount }) => {
  const rid = orderData[0]?.restaurantId;
  const nameFromHook = useRestaurantName(rid);
  const singleName = nameFromHook || "Nhà hàng";

  if (restaurantCount <= 1) {
    return (
      <div className="section">
        <div className="restaurant-info">
          <h3 className="restaurant-name">🏪 {singleName}</h3>
          <p className="restaurant-address">📍 —</p>
          <div className="order-info">
            <span className="order-id">Mã đơn tạm: #{orderInfo.id}</span>
            <span className="order-time">{orderInfo.time}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="restaurant-info">
        <h3 className="restaurant-name">🏪 Đơn hàng nhiều nhà hàng</h3>
        <p className="restaurant-address">
          Hệ thống sẽ điều phối phù hợp theo từng nhà hàng.
        </p>
        <div className="order-info">
          <span className="order-id">Mã giao dịch tạm: #{orderInfo.id}</span>
          <span className="order-time">{orderInfo.time}</span>
        </div>
      </div>
    </div>
  );
};

const ShippingForm = ({ value, errors = {}, onChange }) => {
  const {
    fullName,
    phone,
    email,
    address,
    note,
    deliveryMethod,
    deliveryTime,
    scheduleDate,
    scheduleTime,
  } = value || {};

  return (
    <div className="section">
      <h3 className="section-title">🚚 Thông tin giao hàng</h3>

      <div className="form-grid">
        <div className="form-col">
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Họ và tên</label>
              <input
                className={`form-input ${errors.fullName ? "is-invalid" : ""}`}
                type="text"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => onChange("fullName", e.target.value)}
              />
              {errors.fullName && (
                <div className="form-error">{errors.fullName}</div>
              )}
            </div>

            <div className="form-field">
              <label className="form-label">Số điện thoại</label>
              <input
                className={`form-input ${errors.contact ? "is-invalid" : ""}`}
                type="tel"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => onChange("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Email</label>
              <input
                className={`form-input ${errors.contact ? "is-invalid" : ""}`}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => onChange("email", e.target.value)}
              />
              {errors.contact && (
                <div className="form-error">{errors.contact}</div>
              )}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Địa chỉ</label>
            <input
              className={`form-input ${errors.address ? "is-invalid" : ""}`}
              type="text"
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
              value={address}
              onChange={(e) => onChange("address", e.target.value)}
              disabled={deliveryMethod !== "delivery"}
            />
            {errors.address && (
              <div className="form-error">{errors.address}</div>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Ghi chú</label>
            <textarea
              className="form-textarea"
              placeholder="Ví dụ: ít cay, giao tới cổng..."
              rows={2}
              value={note}
              onChange={(e) => onChange("note", e.target.value)}
            />
          </div>
        </div>

        <div className="form-col">
          <div className="form-field">
            <label className="form-label">Phương thức nhận</label>
            <div className="segmented">
              <button
                type="button"
                className={`segmented__option ${
                  deliveryMethod === "delivery" ? "is-active" : ""
                }`}
                onClick={() => onChange("deliveryMethod", "delivery")}
              >
                🚚 Giao tận nơi
              </button>
              <button
                type="button"
                className={`segmented__option ${
                  deliveryMethod === "pickup" ? "is-active" : ""
                }`}
                onClick={() => onChange("deliveryMethod", "pickup")}
              >
                🛍️ Tự đến lấy
              </button>
              <button
                type="button"
                className={`segmented__option ${
                  deliveryMethod === "dinein" ? "is-active" : ""
                }`}
                onClick={() => onChange("deliveryMethod", "dinein")}
              >
                🍽️ Dùng tại chỗ
              </button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Thời gian nhận</label>
            <div className="segmented">
              <button
                type="button"
                className={`segmented__option ${
                  deliveryTime === "asap" ? "is-active" : ""
                }`}
                onClick={() => onChange("deliveryTime", "asap")}
              >
                Ngay khi có thể
              </button>
              <button
                type="button"
                className={`segmented__option ${
                  deliveryTime === "schedule" ? "is-active" : ""
                }`}
                onClick={() => onChange("deliveryTime", "schedule")}
              >
                Hẹn giờ
              </button>
            </div>
          </div>

          {deliveryTime === "schedule" && (
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Ngày</label>
                <input
                  className={`form-input ${
                    errors.schedule ? "is-invalid" : ""
                  }`}
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => onChange("scheduleDate", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Giờ</label>
                <input
                  className={`form-input ${
                    errors.schedule ? "is-invalid" : ""
                  }`}
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => onChange("scheduleTime", e.target.value)}
                />
              </div>
              {errors.schedule && (
                <div className="form-error">{errors.schedule}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const OrderItems = ({
  groupedByRestaurant,
  onAddModifier,
  calcGroupTotals,
}) => {
  if (!groupedByRestaurant || groupedByRestaurant.size === 0) {
    return (
      <div className="section">
        <h3 className="section-title">🛒 Chi tiết đơn hàng</h3>
        <p>Chưa có món nào.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h3 className="section-title">🛒 Chi tiết đơn hàng</h3>
      {Array.from(groupedByRestaurant.entries()).map(([rid, items]) => (
        <RestaurantGroup
          key={rid}
          restaurantId={rid}
          items={items}
          onAddModifier={onAddModifier}
          calcGroupTotals={calcGroupTotals}
        />
      ))}
    </div>
  );
};

const RestaurantGroup = ({
  restaurantId,
  items,
  onAddModifier,
  calcGroupTotals,
}) => {
  const rName = useRestaurantName(restaurantId) || `Nhà hàng ${restaurantId}`;
  const groupTotals = calcGroupTotals(items);

  return (
    <div className="restaurant-group">
      <h4 className="restaurant-group__title">🏪 {rName}</h4>
      <div className="order-items">
        {items.map((item) => (
          <OrderItem key={item.id} item={item} onAddModifier={onAddModifier} />
        ))}
      </div>

      <div className="price-breakdown group">
        <div className="price-row">
          <span className="price-label">Tổng món ăn ({rName})</span>
          <span className="price-value">
            {formatCurrency(groupTotals.subtotal)}
          </span>
        </div>
        <div className="price-row">
          <span className="price-label">Phí tùy chọn thêm</span>
          <span className="price-value">
            {formatCurrency(groupTotals.modifiersTotal)}
          </span>
        </div>
        <div className="price-row">
          <span className="price-label">VAT (10%)</span>
          <span className="price-value">{formatCurrency(groupTotals.tax)}</span>
        </div>
        <div className="price-row total">
          <span className="price-label">Tổng {rName}</span>
          <span className="price-value">
            {formatCurrency(groupTotals.finalTotal)}
          </span>
        </div>
      </div>
    </div>
  );
};

const OrderItem = ({ item, onAddModifier }) => {
  const itemTotal = (item.price + (item.modifiersPrice || 0)) * item.quantity;
  const unitPrice = item.price + (item.modifiersPrice || 0);

  return (
    <div className="order-item">
      <div className="item-image">
        {typeof item.image === "string" ? (
          <img src={item.image} alt={item.name} />
        ) : (
          item.image
        )}
      </div>

      <div className="item-details">
        <h4 className="item-name">
          <span>{item.name}</span>
          {item.cookingMethod && (
            <span className="cooking-method"> — {item.cookingMethod}</span>
          )}
        </h4>

        {item.description && (
          <p className="item-description">{item.description}</p>
        )}

        {item.modifiers && item.modifiers.length > 0 && (
          <div className="item-modifiers">
            {item.modifiers.map((modifier, index) => (
              <span key={index} className="modifier-tag">
                {modifier.optionName}
                {modifier.price > 0 && ` (+${formatCurrency(modifier.price)})`}
              </span>
            ))}
          </div>
        )}

        <div className="item-quantity-price">
          <span className="item-quantity">
            {formatQuantity(item.quantity, item.unit)}
          </span>
          <span className="item-price">
            {formatCurrency(itemTotal)}
            <span className="item-unit-price">
              ({formatCurrency(unitPrice)}/{item.unit})
            </span>
          </span>
        </div>

        <div className="item-actions">
          <button
            className="add-modifier-btn"
            onClick={() => onAddModifier(item.id)}
          >
            ➕ Thêm tùy chọn
          </button>
        </div>
      </div>
    </div>
  );
};

const PriceBreakdown = ({ subtotals }) => (
  <div className="section">
    <h3 className="section-title">💳 Chi tiết thanh toán</h3>
    <div className="price-breakdown">
      <div className="price-row">
        <span className="price-label">Tổng tiền món ăn</span>
        <span className="price-value">
          {formatCurrency(subtotals.subtotal)}
        </span>
      </div>
      <div className="price-row">
        <span className="price-label">Phí tùy chọn thêm</span>
        <span className="price-value">
          {formatCurrency(subtotals.modifiersTotal)}
        </span>
      </div>
      <div className="price-row">
        <span className="price-label">Thuế VAT (10%)</span>
        <span className="price-value">{formatCurrency(subtotals.tax)}</span>
      </div>
      <div className="price-row">
        <span className="price-label">Phí giao hàng</span>
        <span className="price-value">Miễn phí</span>
      </div>
      <div className="price-row total">
        <span className="price-label">Tổng thanh toán</span>
        <span className="price-value">
          {formatCurrency(subtotals.finalTotal)}
        </span>
      </div>
    </div>
  </div>
);

const PaymentMethods = ({ selectedMethod, onSelect }) => (
  <div className="section">
    <h3 className="section-title">💳 Phương thức thanh toán</h3>
    <div className="payment-methods">
      <div
        className={`payment-method ${
          selectedMethod === "cash" ? "selected" : ""
        }`}
        onClick={() => onSelect("cash")}
      >
        <div className="payment-icon">💵</div>
        <div className="payment-info">
          <h4 className="payment-name">Tiền mặt</h4>
          <p className="payment-desc">Thanh toán khi nhận hàng</p>
        </div>
      </div>
      <div
        className={`payment-method ${
          selectedMethod === "transfer" ? "selected" : ""
        }`}
        onClick={() => onSelect("transfer")}
      >
        <div className="payment-icon">🏦</div>
        <div className="payment-info">
          <h4 className="payment-name">Chuyển khoản</h4>
          <p className="payment-desc">Quét mã QR để thanh toán</p>
        </div>
      </div>
    </div>
  </div>
);

const SuccessScreen = ({ onNewOrder }) => (
  <div className="section">
    <div className="success-screen">
      <div className="success-icon">🎉</div>
      <h3 className="success-title">Đặt hàng thành công!</h3>
      <p className="success-message">
        Cảm ơn bạn đã đặt hàng. Chúng tôi sẽ chuẩn bị món ăn và giao đến bạn
        trong thời gian sớm nhất.
      </p>
      <button className="btn btn--primary" onClick={onNewOrder}>
        Đóng
      </button>
    </div>
  </div>
);

const QRPaymentScreen = ({ amount, onConfirm, isProcessing }) => (
  <div className="section">
    <div className="qr-payment">
      <h3 className="qr-title">Quét mã QR để thanh toán</h3>
      <p className="qr-subtitle">Sử dụng ứng dụng ngân hàng để quét mã</p>
      <div className="qr-code">📱</div>
      <p className="qr-amount">Số tiền: {formatCurrency(amount)}</p>
      <div className="qr-instructions">
        <h4>⚠️ Hướng dẫn thanh toán:</h4>
        <ol>
          <li>Mở ứng dụng ngân hàng trên điện thoại</li>
          <li>Chọn tính năng "Quét mã QR"</li>
          <li>Quét mã QR phía trên</li>
          <li>Xác nhận thông tin và thanh toán</li>
          <li>Chờ xác nhận từ hệ thống</li>
        </ol>
      </div>
      <div style={{ marginTop: 12 }}>
        <button
          className="btn btn--success"
          onClick={onConfirm}
          disabled={isProcessing}
        >
          {isProcessing ? "Đang lưu đơn..." : "Tôi đã thanh toán"}
        </button>
      </div>
    </div>
  </div>
);
