import React, { useState, useEffect, useContext, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  MapPin,
  Store,
  Users,
  ChevronRight,
  Check,
  AlertCircle,
  Sparkles,
  Video,
  Info,
  Receipt,
  ArrowUpRight,
  Gift,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext";
import { useCart } from "../../../context/CartProvider";
import { useBookingTable } from "../../../hooks/useBookingTable";
import { useNotification } from "../../../hooks/useNotification";
import { formatCurrency, formatDateTime } from "../../../utils/formatters";
import "./BookingModal.scss";

/* ───────────────── GraphQL ───────────────── */
const GET_RESTAURANT = gql`
  query Restaurant($id: ID!) {
    restaurant(id: $id) {
      id
      name
      openingHours
      closingHours
      address {
        line1
        line2
        ward
        district
        city
        country
      }
    }
  }
`;

const GET_TABLES_BY_RESTAURANT = gql`
  query TablesByRestaurant(
    $restaurantId: ID!
    $status: TableStatus
    $limit: Int
  ) {
    tables(restaurantId: $restaurantId, status: $status, limit: $limit) {
      id
      code
      capacity
      status
      floorId
      deposit
      type
      vrUrl
    }
  }
`;

const GET_EVENT_PACKAGES = gql`
  query EventPackagesByRestaurant($restaurantId: ID!, $activeOnly: Boolean) {
    eventPackagesByRestaurant(
      restaurantId: $restaurantId
      activeOnly: $activeOnly
    ) {
      id
      name
      description
      promotionId
      promotionCode
      price
      items {
        menuItemId
        name
        menuId
        categoryId
        image
        servingKey
        unitPrice
        quantity
        note
      }
    }
  }
`;

const CREATE_TABLE_EVENT = gql`
  mutation CreateTableEvent($input: CreateTableEventInput!) {
    createTableEvent(input: $input) {
      id
      eventName
      promotionCode
      orderId
      orderCode
    }
  }
`;

const CREATE_ORDER_FOR_TABLE = gql`
  mutation CreateOrderForTable($input: CreateOrderForTableInput!) {
    createOrderForTable(input: $input) {
      isNewOrder
      order {
        id
        orderCode
        restaurantId
      }
    }
  }
`;

/* ───────────────── Utils Helpers ───────────────── */
function addressToText(addr) {
  if (!addr) return "—";
  return [addr.line1, addr.line2, addr.ward, addr.district, addr.city]
    .filter(Boolean)
    .join(", ");
}

function getDepositFromTable(table, partySize) {
  if (typeof table?.deposit === "number") return table.deposit;
  const per = 50000;
  const cap = 200000;
  const size = Math.max(1, Number(partySize || table?.capacity || 2));
  return Math.min(cap, per * size);
}

function localDateTimeToISO(d, t) {
  if (!d || !t) return null;
  const iso = new Date(`${d}T${t}:00`);
  return isNaN(iso.getTime()) ? null : iso.toISOString();
}

function calculateDurationMinutes(date, timeIn, timeOut) {
  if (!date || !timeIn || !timeOut) return 0;
  const start = new Date(`${date}T${timeIn}:00`);
  const end = new Date(`${date}T${timeOut}:00`);
  const diffMs = end - start;
  return Math.floor(diffMs / 60000);
}

const POLICY_ITEMS = [
  "Vui lòng đến đúng giờ; được phép trễ tối đa 15 phút.",
  "Sau 15 phút không có thông báo, hệ thống tự hủy bàn.",
  "Không hoàn tiền khi huỷ muộn hoặc không đến; tài khoản bị hạn chế đặt bàn 30 ngày.",
  "Nếu có vấn đề, vui lòng gọi số 1900-888-999 hoặc nhắn chatbot để được hỗ trợ.",
];

/* ───────────────── Main Component ───────────────── */
const BookingModal = ({
  isOpen,
  onClose,
  restaurantId,
  tableCode,
  tableId,
  tableCapacity,
  tableFloor,
  onBookingConfirmed,
}) => {
  const { user } = useContext(AuthContext) || {};
  const navigate = useNavigate();
  const { cart } = useCart();
  const { createBooking, isLoading } = useBookingTable();
  const { showNotification } = useNotification();
  const [createTableEvent] = useMutation(CREATE_TABLE_EVENT);
  const [createOrderForTable] = useMutation(CREATE_ORDER_FOR_TABLE);

  // Khóa scroll body khi modal mở
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // --- Data Fetching ---
  const { data: rData } = useQuery(GET_RESTAURANT, {
    variables: { id: restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-first",
  });
  const restaurant = rData?.restaurant;

  const needPickTable = useMemo(() => !tableId, [tableId]);

  const { data: tablesData, loading: tablesLoading } = useQuery(
    GET_TABLES_BY_RESTAURANT,
    {
      variables: {
        restaurantId,
        status: showVirtualTour ? null : "available",
        limit: 200,
      },
      skip: !restaurantId || (!needPickTable && !showVirtualTour),
      fetchPolicy: "network-only",
    }
  );
  const tables = useMemo(() => tablesData?.tables ?? [], [tablesData]);
  const selectableTables = useMemo(
    () => tables.filter((t) => t.status === "available"),
    [tables]
  );
  const { data: eventPackageData } = useQuery(GET_EVENT_PACKAGES, {
    variables: { restaurantId, activeOnly: true },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });
  const eventPackages = useMemo(
    () => eventPackageData?.eventPackagesByRestaurant ?? [],
    [eventPackageData]
  );

  // --- State ---
  const [pickedTable, setPickedTable] = useState(null);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    partySize: 2,
    date: "",
    time: "",
    timeOut: "",
    openEnded: false,
    notes: "",
  });
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [eventNote, setEventNote] = useState("");
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [timeWarning, setTimeWarning] = useState(null);

  // --- PREFILL DATA ---
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setShowSummary(false);
    setTimeWarning(null);
    const today = new Date().toLocaleDateString("en-CA");

    const preTable = needPickTable
      ? null
      : {
          id: tableId,
          code: tableCode || tableId,
          capacity: tableCapacity || 4,
        };
    setPickedTable(preTable);

    const autoName = user?.fullName || user?.name || "";
    const autoPhone = user?.phone || user?.phoneNumber || "";
    const autoEmail = user?.email || "";

    setFormData((prev) => ({
      ...prev,
      date: today,
      partySize: Math.min(2, preTable?.capacity || 4),
      time: "",
      timeOut: "",
      openEnded: false,
      customerName: autoName,
      customerPhone: autoPhone,
      customerEmail: autoEmail,
    }));
    setSelectedPackageId(null);
    setEventNote("");
    setSelectedRequests([]);
    setShowVirtualTour(false);
  }, [isOpen, needPickTable, tableId, tableCapacity, user]);

  useEffect(() => {
    if (!isOpen) return;
    if (needPickTable && selectableTables.length > 0 && !pickedTable?.id) {
      setPickedTable(selectableTables[0]);
    }
  }, [isOpen, needPickTable, selectableTables, pickedTable]);

  const capacity = pickedTable?.capacity || tableCapacity || 4;
  const tableType = pickedTable?.type || (capacity >= 8 ? "VIP" : "Standard");
  const selectedPackage = useMemo(
    () => eventPackages.find((pkg) => pkg.id === selectedPackageId) || null,
    [eventPackages, selectedPackageId]
  );
  const deposit = useMemo(
    () => getDepositFromTable(pickedTable, formData.partySize),
    [pickedTable, formData.partySize]
  );
  const restaurantCartItems = useMemo(
    () => (cart || []).filter((item) => item.restaurantId === restaurantId),
    [cart, restaurantId]
  );
  const menuSubtotal = useMemo(
    () =>
      restaurantCartItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0
      ),
    [restaurantCartItems]
  );
  const menuDeposit = Math.round(menuSubtotal * 0.5);
  const totalDeposit = deposit + menuDeposit;
  const packagePrice = Number(selectedPackage?.price || 0);
  const totalDuePreview = totalDeposit;

  // --- Handlers ---
  const checkTimeWarning = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) {
      setTimeWarning(null);
      return;
    }
    const now = new Date();
    const selected = new Date(`${dateStr}T${timeStr}:00`);
    const diffMinutes = Math.floor((selected - now) / 60000);

    if (diffMinutes < 0) setTimeWarning("Đã qua.");
    else if (diffMinutes < 30) setTimeWarning("Sát giờ!");
    else setTimeWarning(null);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "date") {
        newData.time = "";
        newData.timeOut = "";
      }
      if (field === "time") {
        checkTimeWarning(newData.date, value);
        if (!newData.openEnded) newData.timeOut = "";
      }
      if (field === "openEnded") {
        newData.timeOut = "";
      }
      return newData;
    });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const handlePartyBtn = (delta) => {
    const next = Math.max(1, Math.min(20, Number(formData.partySize) + delta));
    setFormData((prev) => ({ ...prev, partySize: next }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.customerName?.trim()) errs.customerName = "Vui lòng nhập tên";
    if (!formData.customerPhone?.trim() && !formData.customerEmail?.trim())
      errs.contact = "Cần SĐT hoặc Email";
    if (!pickedTable?.id) errs.table = "Vui lòng chọn bàn";
    if (!formData.date) errs.date = "Chọn ngày";
    if (!formData.time) errs.time = "Chọn giờ vào";
    if (!formData.openEnded && !formData.timeOut)
      errs.timeOut = "Chọn giờ ra";
    if (timeWarning === "Đã qua.") errs.time = "Giờ không hợp lệ";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    const durationMinutes = formData.openEnded
      ? 0
      : calculateDurationMinutes(formData.date, formData.time, formData.timeOut);
    const timeToISO = localDateTimeToISO(formData.date, formData.time);

    if (!formData.openEnded && durationMinutes < 30) {
      showNotification("Thời gian dùng bữa tối thiểu 30 phút.", "error");
      return;
    }

    try {
      const noteParts = [
        formData.notes,
        selectedRequests.length
          ? `Yêu cầu: ${selectedRequests.join(", ")}`
          : "",
        selectedPackage
          ? `Gói sự kiện: ${selectedPackage?.name} (${
              selectedPackage?.promotionCode || "N/A"
            })`
          : "",
        selectedPackage && eventNote ? `Ghi chú sự kiện: ${eventNote}` : "",
        formData.openEnded
          ? "Không xác định giờ ra (bàn sẽ giữ cho đến khi set trống)."
          : "",
        menuSubtotal > 0
          ? `Có đặt món trước: ${formatCurrency(
              menuSubtotal
            )} (cọc món 50%)`
          : "",
      ].filter(Boolean);
      const input = {
        restaurantId,
        tableId: pickedTable.id,
        timeTo: timeToISO,
        durationMinutes: durationMinutes || 0,
        partySize: Number(formData.partySize),
        note: noteParts.join(" | "),
        customerName: formData.customerName?.trim(),
        customerPhone: formData.customerPhone?.trim() || null,
        customerEmail: formData.customerEmail?.trim() || null,
        depositAmount: totalDeposit,
      };

      const reservation = await createBooking(input);
      if (reservation) {
        let createdOrder = null;
        if (selectedPackage && selectedPackage.items?.length) {
          const invalidItem = selectedPackage.items.find(
            (item) => !item.servingKey
          );
          if (invalidItem) {
            showNotification(
              "Gói sự kiện thiếu servingKey cho món đi kèm, vui lòng cập nhật trong event management.",
              "warning"
            );
          } else {
            const orderItems = selectedPackage.items.map((item) => ({
              dishId: item.menuItemId,
              menuId: item.menuId,
              categoryId: item.categoryId,
              name: item.name,
              unit: "phần",
              image: item.image,
              basePrice: Number(item.unitPrice || 0),
              servingKey: item.servingKey,
              quantity: Number(item.quantity || 1),
              note: item.note || null,
            }));
            const orderPayload = {
              restaurantId,
              tableId: pickedTable.id,
              tableCode: pickedTable.code || tableCode || pickedTable.id,
              parentOrderCode: reservation.orderCode || null,
              items: orderItems,
              note: `Order từ gói sự kiện: ${selectedPackage.name}`,
              customer: {
                fullName: formData.customerName?.trim(),
                phone: formData.customerPhone?.trim() || null,
                email: formData.customerEmail?.trim() || null,
              },
              clientMeta: {
                source: "reservation_event_package",
                reservationId: reservation.id,
                promotionId: selectedPackage.promotionId || null,
                promotionCode: selectedPackage.promotionCode || null,
              },
            };
            const { data } = await createOrderForTable({
              variables: { input: orderPayload },
            });
            createdOrder = data?.createOrderForTable?.order || null;
          }
        }

        if (selectedPackage) {
          await createTableEvent({
            variables: {
              input: {
                restaurantId,
                tableId: pickedTable.id,
                tableCode: pickedTable.code || tableCode || pickedTable.id,
                eventPackageId: selectedPackage.id,
                eventName: selectedPackage.name,
                promotionId: selectedPackage.promotionId || null,
                promotionCode: selectedPackage.promotionCode || null,
                orderId: createdOrder?.id || null,
                orderCode: createdOrder?.orderCode || null,
                items: (selectedPackage.items || []).map((item) => ({
                  menuItemId: item.menuItemId,
                  name: item.name,
                  quantity: item.quantity || 1,
                  unitPrice: item.unitPrice || 0,
                })),
                note: eventNote || null,
              },
            },
          });
        }
        onBookingConfirmed?.(reservation);
        onClose?.();
      }
    } catch (e) {
      showNotification(e?.message || "Lỗi đặt bàn.", "error");
    }
  };

  if (!isOpen) return null;
  const durationPreview = formData.openEnded
    ? 0
    : calculateDurationMinutes(formData.date, formData.time, formData.timeOut);

  return (
    <div className="bkm-backdrop" onClick={onClose}>
      <div className="bkm-container" onClick={(e) => e.stopPropagation()}>
        {/* --- Header --- */}
        <div className="bkm-header">
          <div className="header-content">
            <h2 className="bkm-title">Reservation</h2>
            <span className="bkm-subtitle">Đặt chỗ trước</span>
          </div>
          <button className="bkm-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* --- Body --- */}
        <div className="bkm-body">
          <RestaurantInfo restaurant={restaurant} />

          {/* Form Section */}
          <div className="bkm-section-title">Thông tin khách hàng</div>
          <div className="bkm-compact-form">
            <InputGroup
              label="Họ và tên"
              error={errors.customerName}
              icon={<User size={16} />}
            >
              <input
                type="text"
                placeholder="Nhập tên của bạn"
                value={formData.customerName}
                onChange={(e) => handleChange("customerName", e.target.value)}
              />
            </InputGroup>

            <div className="bkm-row">
              <InputGroup
                label="Số điện thoại"
                error={errors.contact}
                icon={<Phone size={16} />}
              >
                <input
                  type="tel"
                  placeholder="09xx..."
                  value={formData.customerPhone}
                  onChange={(e) =>
                    handleChange("customerPhone", e.target.value)
                  }
                />
              </InputGroup>
              <InputGroup label="Email nhận vé" icon={<Mail size={16} />}>
                <input
                  type="email"
                  placeholder="name@mail.com"
                  value={formData.customerEmail}
                  onChange={(e) =>
                    handleChange("customerEmail", e.target.value)
                  }
                />
              </InputGroup>
            </div>
          </div>

          <div className="bkm-divider"></div>

          {/* Table Section */}
          <div className="bkm-section-title">Chọn vị trí</div>
          {needPickTable ? (
            <TablePicker
              loading={tablesLoading}
              tables={selectableTables}
              pickedTable={pickedTable}
              onPick={setPickedTable}
              error={errors.table}
            />
          ) : (
            <SelectedTable
              tableCode={tableCode || pickedTable?.code}
              capacity={capacity}
              floor={tableFloor}
            />
          )}

          <div className="bkm-table-details">
            <div className="details-row">
              <div className="detail-card">
                <span className="detail-label">Sức chứa tối đa</span>
                <span className="detail-value">{capacity} khách</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Loại bàn</span>
                <span className="detail-value">{tableType}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Cọc bàn</span>
                <span className="detail-value">
                  {formatCurrency(deposit)}
                </span>
              </div>
            </div>
            <div className="detail-card highlight">
              <div>
                <div className="detail-label">Ưu đãi kèm theo</div>
                <div className="detail-value">
                  Miễn phí nước suối · Tặng 5% hóa đơn cho nhóm từ 6 khách
                </div>
              </div>
              <button
                type="button"
                className="bkm-btn bkm-btn-ghost"
                onClick={() => setShowVirtualTour(true)}
              >
                <Video size={16} /> Xem bàn (VR)
              </button>
            </div>
          </div>

          {showVirtualTour && (
            <div className="bkm-virtual-tour">
              <div className="tour-header">
                <div>
                  <h4>Trải nghiệm bàn 360°</h4>
                  <p>
                    Chạm chọn bàn ngay trong lúc xem. Bàn không khả dụng sẽ tô
                    đỏ.
                  </p>
                </div>
                <button
                  type="button"
                  className="bkm-btn bkm-btn-ghost"
                  onClick={() => setShowVirtualTour(false)}
                >
                  <X size={16} /> Đóng
                </button>
              </div>
              <div className="tour-body">
                <div className="tour-preview">
                  <div className="tour-screen">
                    <span className="tour-badge">360°</span>
                    <span className="tour-title">
                      View bàn {pickedTable?.code || tableCode || "—"}
                    </span>
                    <span className="tour-sub">
                      Mô phỏng góc nhìn quanh bàn · kéo để xoay
                    </span>
                  </div>
                  <button
                    type="button"
                    className="tour-action"
                    onClick={() => {
                      const target = pickedTable?.vrUrl;
                      if (target) {
                        window.open(target, "_blank", "noopener,noreferrer");
                        return;
                      }
                      showNotification(
                        "Bàn chưa có link VR, vui lòng chọn bàn khác.",
                        "warning"
                      );
                    }}
                  >
                    <ArrowUpRight size={16} /> Mở toàn cảnh
                  </button>
                </div>
                <div className="tour-table-list">
                  {(tables.length ? tables : [pickedTable])
                    .filter(Boolean)
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`tour-table ${
                          t.status !== "available" ? "unavailable" : ""
                        } ${pickedTable?.id === t.id ? "active" : ""}`}
                        onClick={() => {
                          if (t.status !== "available") return;
                          setPickedTable(t);
                          showNotification(`Đã chọn bàn ${t.code}`, "success");
                        }}
                      >
                        <span>Bàn {t.code}</span>
                        <span className="status">
                          {t.status === "available"
                            ? "Trống"
                            : "Không khả dụng"}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Time & Party Section */}
          <div className="bkm-row-grid">
            <PartySize
              value={formData.partySize}
              onButtonChange={handlePartyBtn}
            />
            <TimeLogicSelection
              date={formData.date}
              time={formData.time}
              timeOut={formData.timeOut}
              openEnded={formData.openEnded}
              openingHours={restaurant?.openingHours}
              closingHours={restaurant?.closingHours}
              onChange={handleChange}
              errors={errors}
              warning={timeWarning}
            />
          </div>

          <label className="bkm-checkbox">
            <input
              type="checkbox"
              checked={formData.openEnded}
              onChange={(e) => handleChange("openEnded", e.target.checked)}
            />
            <span>
              Không xác định giờ ra (giữ bàn đến khi set trống)
            </span>
          </label>

          <div className="bkm-note-area">
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Ghi chú đặc biệt (dị ứng, trang trí sinh nhật...)"
            />
          </div>

          <div className="bkm-requests">
            <div className="bkm-section-title">Yêu cầu thêm</div>
            <div className="request-grid">
              {[
                "Bàn gần cửa sổ",
                "Ghế trẻ em",
                "Không gian yên tĩnh",
                "Ăn chay",
                "Dị ứng hải sản",
              ].map((req) => (
                <label key={req} className="request-chip">
                  <input
                    type="checkbox"
                    checked={selectedRequests.includes(req)}
                    onChange={() =>
                      setSelectedRequests((prev) =>
                        prev.includes(req)
                          ? prev.filter((r) => r !== req)
                          : [...prev, req]
                      )
                    }
                  />
                  <span>{req}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bkm-section-title">Gói sự kiện</div>
          <div className="bkm-packages">
            {eventPackages.length === 0 ? (
              <div className="package-empty">
                <Gift size={18} /> Chưa có gói sự kiện được cấu hình.
              </div>
            ) : (
              eventPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  className={`package-card ${
                    selectedPackageId === pkg.id ? "active" : ""
                  }`}
                  onClick={() =>
                    setSelectedPackageId((prev) =>
                      prev === pkg.id ? null : pkg.id
                    )
                  }
                >
                  <div className="pkg-header">
                    <span className="pkg-title">{pkg.name}</span>
                    <span className="pkg-price">
                      {formatCurrency(pkg.price || 0)}
                    </span>
                  </div>
                  <p className="pkg-desc">{pkg.description}</p>
                  {pkg.promotionCode && (
                    <span className="pkg-code">
                      Mã khuyến mãi: {pkg.promotionCode}
                    </span>
                  )}
                </button>
              ))
            )}
            <button
              type="button"
              className={`package-card ${!selectedPackageId ? "active" : ""}`}
              onClick={() => {
                setSelectedPackageId(null);
                setEventNote("");
              }}
            >
              <div className="pkg-header">
                <span className="pkg-title">Không chọn gói</span>
                <span className="pkg-price">0đ</span>
              </div>
              <p className="pkg-desc">Tôi chỉ cần đặt bàn cơ bản</p>
            </button>
          </div>

          {selectedPackage && (
            <div className="bkm-package-fields">
              <div className="package-items">
                <div className="items-title">Món đi kèm</div>
                {selectedPackage.items?.length ? (
                  <ul>
                    {selectedPackage.items.map((item) => (
                      <li key={item.menuItemId}>
                        {item.name} · {item.quantity || 1} món ·{" "}
                        {formatCurrency(item.unitPrice || 0)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pkg-note">
                    Gói này chưa có món đi kèm được cấu hình.
                  </p>
                )}
              </div>
              <div className="field-item">
                <label>Ghi chú gói sự kiện</label>
                <input
                  type="text"
                  value={eventNote}
                  onChange={(e) => setEventNote(e.target.value)}
                  placeholder="Ví dụ: ghi tên lên bánh, bố trí bóng bay..."
                />
              </div>
            </div>
          )}

          <div className="bkm-section-title">Đặt món kèm</div>
          <div className="bkm-order-block">
            <div className="order-info">
              <div className="order-title">
                <Receipt size={16} /> Giỏ món hiện tại
              </div>
              <p>
                {menuSubtotal > 0
                  ? `Có ${restaurantCartItems.length} món · Tạm tính ${formatCurrency(
                      menuSubtotal
                    )}`
                  : "Chưa có món trong giỏ của nhà hàng này."}
              </p>
              <div className="order-deposit">
                Cọc món (50%): <strong>{formatCurrency(menuDeposit)}</strong>
              </div>
            </div>
            <button
              type="button"
              className="bkm-btn bkm-btn-gold"
              onClick={() =>
                navigate(
                  `/cus-menu?restaurantId=${encodeURIComponent(
                    restaurantId || ""
                  )}&returnTo=booking`
                )
              }
            >
              <Sparkles size={16} /> Order món
            </button>
          </div>

          <div className="bkm-policy">
            <div className="policy-title">
              <Info size={16} /> Chính sách & lưu ý
            </div>
            <ul>
              {POLICY_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {showSummary && (
            <BookingSummaryPreview
              formData={formData}
              tableCode={pickedTable?.code || pickedTable?.id}
              deposit={totalDeposit}
              menuDeposit={menuDeposit}
              packagePrice={packagePrice}
              totalDue={totalDuePreview}
              duration={durationPreview}
            />
          )}
        </div>

        {/* --- Footer --- */}
        <div className="bkm-footer">
          {!showSummary ? (
            <button
              className="bkm-btn bkm-btn-gold full-width"
              onClick={() => {
                if (validate()) setShowSummary(true);
              }}
            >
              Tiếp tục <ChevronRight size={18} />
            </button>
          ) : (
            <div className="bkm-footer-actions">
              <button
                className="bkm-btn bkm-btn-ghost"
                onClick={() => setShowSummary(false)}
              >
                Quay lại
              </button>
              <button
                className="bkm-btn bkm-btn-confirm flex-grow"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? "Đang xử lý..." : "Xác nhận đặt bàn"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ──────── Sub-Components ──────── */

const generateSlots = (
  startStr,
  endStr,
  selectedDate = null,
  includeEnd = false
) => {
  const parse = (str) => {
    if (!str) return null;
    const t = str.trim().toLowerCase();
    const [timePart] = t.split(" ");
    let [h, m] = timePart.replace(/[a-z]/g, "").split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    if (t.includes("pm") && h !== 12) h += 12;
    if (t.includes("am") && h === 12) h = 0;
    return { h, m, total: h * 60 + m };
  };
  const startObj = parse(startStr) || { h: 7, m: 0, total: 420 };
  const endObj = parse(endStr) || { h: 22, m: 0, total: 1320 };
  let curTotal = startObj.total;
  const endTotal = endObj.total;
  let slots = [];
  while (curTotal < endTotal) {
    const h = Math.floor(curTotal / 60);
    const m = curTotal % 60;
    slots.push(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    );
    curTotal += 30;
  }
  if (includeEnd) {
    const h = Math.floor(endTotal / 60);
    const m = endTotal % 60;
    slots.push(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    );
  }
  if (selectedDate) {
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");
    if (selectedDate === todayStr) {
      const nowTotal = now.getHours() * 60 + now.getMinutes();
      slots = slots.filter((s) => {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + m > nowTotal;
      });
    }
  }
  return slots;
};

const TimeLogicSelection = ({
  date,
  time,
  timeOut,
  openEnded,
  openingHours,
  closingHours,
  onChange,
  errors,
  warning,
}) => {
  const timeSlots = useMemo(() => {
    return generateSlots(openingHours, closingHours, date);
  }, [date, openingHours, closingHours]);

  const timeOutSlots = useMemo(() => {
    if (!time || openEnded) return [];
    const [h, m] = time.split(":").map(Number);
    let nextTotal = h * 60 + m + 30;
    const nextH = Math.floor(nextTotal / 60);
    const nextM = nextTotal % 60;
    const nextStartStr = `${nextH.toString().padStart(2, "0")}:${nextM
      .toString()
      .padStart(2, "0")}`;
    return generateSlots(nextStartStr, closingHours, null, true);
  }, [time, closingHours]);

  return (
    <>
      <div className="bkm-control-box">
        <label>
          <Calendar size={14} /> Ngày
        </label>
        <input
          type="date"
          className={errors.date ? "err-border" : ""}
          value={date}
          onChange={(e) => onChange("date", e.target.value)}
          min={new Date().toLocaleDateString("en-CA")}
        />
      </div>
      <div className="bkm-control-box">
        <label>
          <Clock size={14} /> Giờ vào{" "}
          {warning && (
            <span className="warn-badge">
              <AlertCircle size={12} />
            </span>
          )}
        </label>
        <div className="select-wrapper">
          <select
            className={errors.time ? "err-border" : ""}
            value={time}
            onChange={(e) => onChange("time", e.target.value)}
            disabled={!date}
          >
            <option value="">--:--</option>
            {timeSlots.length > 0 ? (
              timeSlots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            ) : (
              <option disabled>Hết giờ</option>
            )}
          </select>
        </div>
      </div>
      <div className="bkm-control-box">
        <label>
          <Clock size={14} /> Giờ ra
        </label>
        <div className="select-wrapper">
          <select
            className={errors.timeOut ? "err-border" : ""}
            value={timeOut}
            onChange={(e) => onChange("timeOut", e.target.value)}
            disabled={!time || openEnded}
          >
            <option value="">--:--</option>
            {timeOutSlots.length > 0 ? (
              timeOutSlots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            ) : (
              <option disabled>N/A</option>
            )}
          </select>
        </div>
      </div>
      {warning && <div className="bkm-full-width-warn">{warning}</div>}
    </>
  );
};

const InputGroup = ({ label, children, error, className = "", icon }) => (
  <div className={`bkm-input-wrap ${className} ${error ? "has-error" : ""}`}>
    <label>{label}</label>
    <div className="input-inner">
      {icon && <span className="input-icon">{icon}</span>}
      {children}
    </div>
    {error && <span className="error-text">{error}</span>}
  </div>
);

const RestaurantInfo = ({ restaurant }) => (
  <div className="bkm-res-card">
    <div className="icon-box">
      <Store size={24} strokeWidth={1.5} />
    </div>
    <div className="text-info">
      <h3 className="name">{restaurant?.name || "Đang tải..."}</h3>
      <div className="addr-row">
        <MapPin size={14} />
        <span className="addr">{addressToText(restaurant?.address)}</span>
      </div>
    </div>
  </div>
);

const SelectedTable = ({ tableCode, capacity, floor }) => (
  <div className="bkm-selected-table">
    <div className="left">
      <span className="label">Bàn đã chọn</span>
      <span className="code">{tableCode}</span>
    </div>
    <div className="right">
      <div className="detail">
        <Users size={14} /> {capacity} Ghế
      </div>
      <div className="detail">
        <MapPin size={14} /> Tầng {floor || "G"}
      </div>
    </div>
    <div className="status-icon">
      <Check size={18} />
    </div>
  </div>
);

const TablePicker = ({ loading, tables, pickedTable, onPick, error }) => (
  <div className="bkm-table-picker">
    {loading ? (
      <span className="loading-text">Đang tải danh sách bàn...</span>
    ) : (
      <div className="chips-grid">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip-btn ${pickedTable?.id === t.id ? "active" : ""}`}
            onClick={() => onPick(t)}
            disabled={t.status !== "available"}
          >
            {t.code}
          </button>
        ))}
      </div>
    )}
    {error && <span className="err-text">{error}</span>}
  </div>
);

const PartySize = ({ value, onButtonChange }) => (
  <div className="bkm-control-box">
    <label>
      <Users size={14} /> Số khách
    </label>
    <div className="stepper-luxury">
      <button
        type="button"
        onClick={() => onButtonChange(-1)}
        disabled={value <= 1}
      >
        −
      </button>
      <span className="value">{value}</span>
      <button
        type="button"
        onClick={() => onButtonChange(1)}
        disabled={value >= 20}
      >
        +
      </button>
    </div>
  </div>
);

const BookingSummaryPreview = ({
  formData,
  tableCode,
  deposit,
  menuDeposit,
  packagePrice,
  totalDue,
  duration,
}) => (
  <div className="bkm-receipt-preview">
    <div className="receipt-header">Xác nhận thông tin</div>
    <div className="receipt-row">
      <span>Khách hàng:</span>
      <strong>{formData.customerName}</strong>
    </div>
    <div className="receipt-row">
      <span>Thời gian:</span>
      <strong>
        {formatDateTime(formData.date, formData.time)}{" "}
        {formData.openEnded ? "(Không giờ ra)" : `(${duration}p)`}
      </strong>
    </div>
    <div className="receipt-row">
      <span>Vị trí:</span>
      <strong>Bàn {tableCode}</strong>
    </div>
    <div className="receipt-divider"></div>
    <div className="receipt-row">
      <span>Tiền cọc bàn:</span>
      <span>{formatCurrency(deposit - menuDeposit)}</span>
    </div>
    <div className="receipt-row">
      <span>Tiền cọc món:</span>
      <span>{formatCurrency(menuDeposit)}</span>
    </div>
    {packagePrice > 0 && (
      <div className="receipt-row">
        <span>Gói sự kiện (tính vào order):</span>
        <span>{formatCurrency(packagePrice)}</span>
      </div>
    )}
    <div className="receipt-row total">
      <span>Tổng cần thanh toán:</span>
      <span className="money">{formatCurrency(totalDue)}</span>
    </div>
  </div>
);

export default BookingModal;
