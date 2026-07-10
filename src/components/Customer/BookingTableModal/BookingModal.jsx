import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Info,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Sparkles,
  Store,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext";
import { useCart } from "../../../context/CartProvider";
import { useBookingTable } from "../../../hooks/useBookingTable";
import { useNotification } from "../../../hooks/useNotification";
import { formatCurrency, formatDateTime } from "../../../utils/formatters";
import "./BookingModal.scss";

export const GET_PUBLIC_BOOKING_RESTAURANT = gql`
  query PublicBookingRestaurant($id: ID!) {
    publicRestaurant(id: $id) {
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
      reservationSettings {
        baseDepositAmount
        menuDepositPercent
      }
    }
  }
`;

export const GET_PUBLIC_BOOKING_TABLES = gql`
  query PublicBookingTables($restaurantId: ID!, $limit: Int) {
    publicTables(restaurantId: $restaurantId, limit: $limit) {
      id
      code
      capacity
      status
      floorId
      floorLevel
      deposit
      type
      vrUrl
      bookingPerks
      reservationHoldMinutes
      minSpend
      cancelPolicy
    }
  }
`;

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASIC_PHONE_REGEX = /^(0|\+?84)\d{9,10}$/;
const SPECIAL_REQUESTS = [
  "Bàn gần cửa sổ",
  "Ghế trẻ em",
  "Không gian yên tĩnh",
  "Ăn chay",
  "Dị ứng hải sản",
];

function addressToText(address) {
  if (!address) return "Địa chỉ đang được cập nhật";
  return [
    address.line1,
    address.line2,
    address.ward,
    address.district,
    address.city,
  ]
    .filter(Boolean)
    .join(", ") || "Địa chỉ đang được cập nhật";
}

function parseClock(value, fallback = null) {
  const normalized = String(value || "").trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return fallback;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const suffix = match[3];
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) {
    return fallback;
  }
  if (suffix === "pm" && hour !== 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23) return fallback;
  return hour * 60 + minute;
}

function formatClock(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function generateSlots(startValue, endValue, selectedDate, includeEnd = false) {
  const start = parseClock(startValue, 7 * 60);
  let end = parseClock(endValue, 22 * 60);
  if (end <= start) end += 24 * 60;

  const slots = [];
  const boundary = includeEnd ? end : end - 1;
  for (let current = start; current <= boundary; current += 30) {
    slots.push(formatClock(current));
  }

  if (!selectedDate || selectedDate !== new Date().toLocaleDateString("en-CA")) {
    return slots;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => {
    const slotMinutes = parseClock(slot, 0);
    return slotMinutes > nowMinutes;
  });
}

function calculateDurationMinutes(date, timeIn, timeOut) {
  if (!date || !timeIn || !timeOut) return 0;
  const start = new Date(`${date}T${timeIn}:00`);
  const end = new Date(`${date}T${timeOut}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end <= start) end.setDate(end.getDate() + 1);
  return Math.floor((end - start) / 60000);
}

function localDateTimeToISO(date, time) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function tableTypeLabel(value) {
  const labels = {
    standard: "Tiêu chuẩn",
    booth: "Booth",
    vip: "VIP",
    outdoor: "Ngoài trời",
    bar: "Quầy bar",
    private: "Phòng riêng",
  };
  return labels[String(value || "standard").toLowerCase()] || "Tiêu chuẩn";
}

function nextDefaultTime(time, closingHours) {
  const start = parseClock(time, null);
  if (start == null) return "";
  let close = parseClock(closingHours, 22 * 60);
  if (close <= start) close += 24 * 60;
  if (close - start < 30) return "";
  return formatClock(Math.min(start + 60, close));
}

const BookingModal = ({
  isOpen,
  onClose,
  restaurantId,
  tableCode,
  tableId,
  tableCapacity,
  tableFloor,
  initialDraft,
  onBookingConfirmed,
}) => {
  const { user } = useContext(AuthContext) || {};
  const navigate = useNavigate();
  const { cart } = useCart();
  const { createBooking, isLoading } = useBookingTable();
  const { showNotification } = useNotification();

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
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [errors, setErrors] = useState({});
  const [showSummary, setShowSummary] = useState(false);

  const canUseUnlimitedTime = ["silver", "gold", "platinum"].includes(
    String(user?.loyaltyRank || "basic").toLowerCase(),
  );

  const {
    data: restaurantData,
    loading: restaurantLoading,
    error: restaurantError,
  } = useQuery(GET_PUBLIC_BOOKING_RESTAURANT, {
    variables: { id: restaurantId },
    skip: !isOpen || !restaurantId,
    fetchPolicy: "cache-first",
  });

  const {
    data: tablesData,
    loading: tableLoading,
    error: tableError,
  } = useQuery(GET_PUBLIC_BOOKING_TABLES, {
    variables: { restaurantId, limit: 200 },
    skip: !isOpen || !restaurantId || !tableId,
    fetchPolicy: "cache-first",
  });

  const restaurant = restaurantData?.publicRestaurant || null;
  const selectedTable = useMemo(() => {
    const publicTable = (tablesData?.publicTables || []).find(
      (table) => String(table.id) === String(tableId),
    );
    return publicTable || {
      id: tableId,
      code: tableCode || tableId,
      capacity: tableCapacity || 1,
      floorLevel: tableFloor,
      status: "available",
      deposit: null,
      type: "standard",
      bookingPerks: [],
    };
  }, [tablesData, tableId, tableCode, tableCapacity, tableFloor]);

  const capacity = Math.max(1, Number(selectedTable?.capacity || tableCapacity || 1));
  const hasTableDeposit =
    selectedTable?.deposit !== null && selectedTable?.deposit !== undefined;
  const tableDeposit = hasTableDeposit ? Number(selectedTable.deposit) : Number.NaN;
  const policyDeposit = Number(restaurant?.reservationSettings?.baseDepositAmount);
  const deposit = Number.isFinite(tableDeposit)
    ? Math.max(0, tableDeposit)
    : Number.isFinite(policyDeposit)
      ? Math.max(0, policyDeposit)
      : 0;

  const restaurantCartItems = useMemo(
    () =>
      (cart || []).filter(
        (item) => String(item.restaurantId) === String(restaurantId),
      ),
    [cart, restaurantId],
  );
  const menuSubtotal = useMemo(
    () =>
      restaurantCartItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.price || 0) + Number(item.modifiersPrice || 0)) *
            Number(item.quantity || 1),
        0,
      ),
    [restaurantCartItems],
  );
  const menuDepositPercent = 50;
  const menuDeposit = Math.round(menuSubtotal * (menuDepositPercent / 100));
  const totalDeposit = deposit + menuDeposit;

  const timeSlots = useMemo(
    () =>
      generateSlots(
        restaurant?.openingHours,
        restaurant?.closingHours,
        formData.date,
      ),
    [restaurant?.openingHours, restaurant?.closingHours, formData.date],
  );

  const timeOutSlots = useMemo(() => {
    if (!formData.time || formData.openEnded) return [];
    const start = parseClock(formData.time, null);
    if (start == null) return [];
    return generateSlots(
      formatClock(start + 30),
      restaurant?.closingHours,
      null,
      true,
    );
  }, [formData.time, formData.openEnded, restaurant?.closingHours]);

  const durationPreview = formData.openEnded
    ? 0
    : calculateDurationMinutes(formData.date, formData.time, formData.timeOut);

  const selectedDateTime = useMemo(() => {
    if (!formData.date || !formData.time) return null;
    const value = new Date(`${formData.date}T${formData.time}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [formData.date, formData.time]);

  const bookingPerks = Array.isArray(selectedTable?.bookingPerks)
    ? selectedTable.bookingPerks.filter(Boolean)
    : [];

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape" && !isLoading) onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, isLoading, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const today = new Date().toLocaleDateString("en-CA");
    const draftMatchesTable =
      initialDraft?.tableId &&
      String(initialDraft.tableId) === String(tableId);
    setFormData(
      draftMatchesTable
        ? {
            customerName: user?.fullName || user?.name || "",
            customerPhone: user?.phone || user?.phoneNumber || "",
            customerEmail: user?.email || "",
            partySize: Math.min(2, capacity),
            date: today,
            time: "",
            timeOut: "",
            openEnded: false,
            notes: "",
            ...initialDraft.formData,
          }
        : {
            customerName: user?.fullName || user?.name || "",
            customerPhone: user?.phone || user?.phoneNumber || "",
            customerEmail: user?.email || "",
            partySize: Math.min(2, capacity),
            date: today,
            time: "",
            timeOut: "",
            openEnded: false,
            notes: "",
          },
    );
    setSelectedRequests(
      draftMatchesTable && Array.isArray(initialDraft.selectedRequests)
        ? initialDraft.selectedRequests
        : [],
    );
    setErrors({});
    setShowSummary(false);
  }, [isOpen, user, capacity, initialDraft, tableId]);

  useEffect(() => {
    setFormData((current) => {
      const nextPartySize = Math.min(
        capacity,
        Math.max(1, Number(current.partySize) || 1),
      );
      return nextPartySize === current.partySize
        ? current
        : { ...current, partySize: nextPartySize };
    });
  }, [capacity]);

  const clearError = (...keys) => {
    setErrors((current) => {
      const next = { ...current };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const handleChange = (field, value) => {
    setFormData((current) => {
      const next = { ...current, [field]: value };
      if (field === "date") {
        next.time = "";
        next.timeOut = "";
      }
      if (field === "time") {
        next.timeOut = nextDefaultTime(value, restaurant?.closingHours);
      }
      if (field === "openEnded") {
        next.timeOut = value
          ? ""
          : nextDefaultTime(current.time, restaurant?.closingHours);
      }
      return next;
    });
    clearError(field, "contact", "form");
  };

  const handlePartyChange = (delta) => {
    setFormData((current) => ({
      ...current,
      partySize: Math.min(
        capacity,
        Math.max(1, Number(current.partySize || 1) + delta),
      ),
    }));
    clearError("partySize", "form");
  };

  const toggleRequest = (request) => {
    setSelectedRequests((current) =>
      current.includes(request)
        ? current.filter((item) => item !== request)
        : [...current, request],
    );
  };

  const validate = () => {
    const nextErrors = {};
    const customerName = String(formData.customerName || "").trim();
    const customerPhone = String(formData.customerPhone || "")
      .replace(/\s+/g, "")
      .trim();
    const customerEmail = String(formData.customerEmail || "").trim().toLowerCase();

    if (!restaurant && !restaurantLoading) {
      nextErrors.form = "Nhà hàng hiện không khả dụng để đặt bàn.";
    }
    if (!selectedTable?.id || tableError) {
      nextErrors.form = "Không thể xác nhận bàn đã chọn. Vui lòng đóng và chọn lại bàn.";
    }
    if (selectedTable?.status && selectedTable.status !== "available") {
      nextErrors.form = "Bàn này không còn ở trạng thái trống. Vui lòng chọn lại bàn.";
    }
    if (!customerName) nextErrors.customerName = "Vui lòng nhập họ và tên.";
    if (!customerPhone && !customerEmail) {
      nextErrors.contact = "Nhập email hoặc số điện thoại để nhà hàng xác nhận.";
    }
    if (customerPhone && !BASIC_PHONE_REGEX.test(customerPhone)) {
      nextErrors.customerPhone = "Số điện thoại không hợp lệ.";
    }
    if (customerEmail && !BASIC_EMAIL_REGEX.test(customerEmail)) {
      nextErrors.customerEmail = "Email không hợp lệ.";
    }
    if (!formData.date) nextErrors.date = "Vui lòng chọn ngày.";
    if (!formData.time) nextErrors.time = "Vui lòng chọn giờ đến.";
    if (!formData.openEnded && !formData.timeOut) {
      nextErrors.timeOut = "Vui lòng chọn giờ kết thúc.";
    }
    if (selectedDateTime && selectedDateTime <= new Date()) {
      nextErrors.time = "Thời gian đặt bàn phải ở tương lai.";
    }
    if (
      !Number.isFinite(Number(formData.partySize)) ||
      Number(formData.partySize) < 1 ||
      Number(formData.partySize) > capacity
    ) {
      nextErrors.partySize = `Bàn này phục vụ tối đa ${capacity} khách.`;
    }
    if (formData.openEnded && !canUseUnlimitedTime) {
      nextErrors.openEnded = "Tùy chọn này chỉ dành cho thành viên Silver trở lên.";
    }
    if (!formData.openEnded && formData.time && formData.timeOut && durationPreview < 30) {
      nextErrors.timeOut = "Thời gian dùng bàn tối thiểu 30 phút.";
    }

    const serviceAt = localDateTimeToISO(formData.date, formData.time);
    const serviceTime = serviceAt ? new Date(serviceAt).getTime() : null;
    const hasAddonTimeMismatch =
      serviceTime != null &&
      restaurantCartItems.some((item) => {
        if (!item?.serviceAt) return false;
        return new Date(item.serviceAt).getTime() !== serviceTime;
      });
    if (hasAddonTimeMismatch) {
      nextErrors.form =
        "Các món đã chọn thuộc giờ đặt bàn khác. Vui lòng chọn lại món cho lịch hiện tại.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) setShowSummary(true);
  };

  const handleChooseDishes = () => {
    if (!validate()) return;
    const serviceAt = localDateTimeToISO(formData.date, formData.time);
    if (!serviceAt) {
      showNotification("Vui lòng chọn ngày và giờ đến trước khi chọn món.", "warning");
      return;
    }

    const params = new URLSearchParams({
      restaurantId: String(restaurantId || ""),
      returnTo: "booking",
      serviceAt,
    });
    navigate(`/cus-menu?${params.toString()}`, {
      state: {
        bookingDraft: {
          tableId: selectedTable.id,
          tableFloor,
          formData,
          selectedRequests,
        },
      },
    });
  };

  const handleConfirm = async () => {
    if (!validate()) {
      setShowSummary(false);
      return;
    }

    const noteParts = [
      formData.notes?.trim(),
      selectedRequests.length ? `Yêu cầu: ${selectedRequests.join(", ")}` : "",
      menuSubtotal > 0
        ? `Có đặt món trước: ${formatCurrency(menuSubtotal)} (cọc món ${menuDepositPercent}%)`
        : "",
      formData.openEnded ? "Không xác định giờ ra." : "",
    ].filter(Boolean);

    try {
      const reservation = await createBooking({
        restaurantId,
        tableId: selectedTable.id,
        timeTo: localDateTimeToISO(formData.date, formData.time),
        durationMinutes: formData.openEnded ? 0 : durationPreview,
        partySize: Number(formData.partySize),
        note: noteParts.join(" | "),
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim() || null,
        customerEmail: formData.customerEmail.trim() || null,
        linkedCartItemIds: restaurantCartItems
          .map((item) => item.backendCartItemId)
          .filter(Boolean),
        isUnlimitedTime: formData.openEnded,
        paymentMethod: "momo",
      });

      if (!reservation) {
        throw new Error("Không nhận được kết quả đặt bàn.");
      }

      onBookingConfirmed?.(reservation);
      onClose?.();
    } catch (error) {
      showNotification(error?.message || "Không thể đặt bàn. Vui lòng thử lại.", "error");
    }
  };

  if (!isOpen) return null;

  const dataUnavailable = Boolean(restaurantError || tableError || (!restaurant && !restaurantLoading));
  const floorLabel = selectedTable?.floorLevel ?? tableFloor;

  return (
    <div
      className="bkm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onClose?.();
      }}
    >
      <section
        className="bkm-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bkm-title"
        aria-describedby="bkm-description"
      >
        <header className="bkm-header">
          <div>
            <span className="bkm-eyebrow">Đặt chỗ trước</span>
            <h2 id="bkm-title">Hoàn tất đặt bàn</h2>
            <p id="bkm-description">
              Kiểm tra thông tin khách, thời gian và vị trí trước khi xác nhận.
            </p>
          </div>
          <button
            type="button"
            className="bkm-close-btn"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Đóng cửa sổ đặt bàn"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="bkm-body">
          {(errors.form || dataUnavailable) && (
            <div className="bkm-alert" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>
                {errors.form ||
                  "Không tải đủ dữ liệu đặt bàn. Vui lòng đóng cửa sổ và thử lại."}
              </span>
            </div>
          )}

          <RestaurantCard
            restaurant={restaurant}
            loading={restaurantLoading}
            error={restaurantError}
          />

          <div className="bkm-layout">
            <main className="bkm-main-column">
              {!showSummary ? (
                <>
                  <FormSection
                    number="01"
                    title="Thông tin liên hệ"
                    description="Nhà hàng dùng thông tin này để xác nhận lịch đặt."
                  >
                    <InputGroup
                      label="Họ và tên"
                      icon={<User size={17} />}
                      error={errors.customerName}
                    >
                      <input
                        type="text"
                        autoComplete="name"
                        placeholder="Nhập họ và tên"
                        value={formData.customerName}
                        onChange={(event) =>
                          handleChange("customerName", event.target.value)
                        }
                      />
                    </InputGroup>
                    <div className="bkm-form-grid bkm-form-grid--two">
                      <InputGroup
                        label="Số điện thoại"
                        icon={<Phone size={17} />}
                        error={errors.customerPhone || errors.contact}
                      >
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="09xx xxx xxx"
                          value={formData.customerPhone}
                          onChange={(event) =>
                            handleChange("customerPhone", event.target.value)
                          }
                        />
                      </InputGroup>
                      <InputGroup
                        label="Email nhận xác nhận"
                        icon={<Mail size={17} />}
                        error={errors.customerEmail}
                      >
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="ten@email.com"
                          value={formData.customerEmail}
                          onChange={(event) =>
                            handleChange("customerEmail", event.target.value)
                          }
                        />
                      </InputGroup>
                    </div>
                  </FormSection>

                  <FormSection
                    number="02"
                    title="Thời gian dùng bàn"
                    description={`Khung giờ phục vụ ${restaurant?.openingHours || "07:00"}–${restaurant?.closingHours || "22:00"}.`}
                  >
                    <div className="bkm-form-grid bkm-form-grid--schedule">
                      <div className={`bkm-control ${errors.partySize ? "has-error" : ""}`}>
                        <label>
                          <Users size={16} /> Số khách
                        </label>
                        <div className="bkm-stepper">
                          <button
                            type="button"
                            onClick={() => handlePartyChange(-1)}
                            disabled={formData.partySize <= 1}
                            aria-label="Giảm số khách"
                          >
                            −
                          </button>
                          <span aria-live="polite">{formData.partySize}</span>
                          <button
                            type="button"
                            onClick={() => handlePartyChange(1)}
                            disabled={formData.partySize >= capacity}
                            aria-label="Tăng số khách"
                          >
                            +
                          </button>
                        </div>
                        <small>Tối đa {capacity} khách</small>
                        {errors.partySize && <em>{errors.partySize}</em>}
                      </div>

                      <div className={`bkm-control ${errors.date ? "has-error" : ""}`}>
                        <label htmlFor="bkm-date">
                          <Calendar size={16} /> Ngày
                        </label>
                        <input
                          id="bkm-date"
                          type="date"
                          min={new Date().toLocaleDateString("en-CA")}
                          value={formData.date}
                          onChange={(event) => handleChange("date", event.target.value)}
                        />
                        {errors.date && <em>{errors.date}</em>}
                      </div>

                      <div className={`bkm-control ${errors.time ? "has-error" : ""}`}>
                        <label htmlFor="bkm-time-in">
                          <Clock size={16} /> Giờ đến
                        </label>
                        <select
                          id="bkm-time-in"
                          value={formData.time}
                          onChange={(event) => handleChange("time", event.target.value)}
                          disabled={!formData.date || restaurantLoading}
                        >
                          <option value="">Chọn giờ</option>
                          {timeSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                        {errors.time && <em>{errors.time}</em>}
                      </div>

                      <div className={`bkm-control ${errors.timeOut ? "has-error" : ""}`}>
                        <label htmlFor="bkm-time-out">
                          <Clock size={16} /> Giờ kết thúc
                        </label>
                        <select
                          id="bkm-time-out"
                          value={formData.timeOut}
                          onChange={(event) => handleChange("timeOut", event.target.value)}
                          disabled={!formData.time || formData.openEnded}
                        >
                          <option value="">Chọn giờ</option>
                          {timeOutSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                        {errors.timeOut && <em>{errors.timeOut}</em>}
                      </div>
                    </div>

                    <label className={`bkm-unlimited ${errors.openEnded ? "has-error" : ""}`}>
                      <input
                        type="checkbox"
                        checked={formData.openEnded}
                        disabled={!canUseUnlimitedTime}
                        onChange={(event) =>
                          handleChange("openEnded", event.target.checked)
                        }
                      />
                      <span>
                        <strong>Không giới hạn giờ kết thúc</strong>
                        <small>
                          {canUseUnlimitedTime
                            ? "Bàn được giữ đến khi nhà hàng kết thúc phiên phục vụ."
                            : "Dành cho thành viên Silver, Gold và Platinum."}
                        </small>
                      </span>
                    </label>
                    {errors.openEnded && <div className="bkm-field-error">{errors.openEnded}</div>}
                  </FormSection>

                  <FormSection
                    number="03"
                    title="Yêu cầu thêm"
                    description="Chọn nhanh hoặc ghi rõ điều nhà hàng cần chuẩn bị."
                  >
                    <div className="bkm-request-grid">
                      {SPECIAL_REQUESTS.map((request) => {
                        const checked = selectedRequests.includes(request);
                        return (
                          <button
                            key={request}
                            type="button"
                            className={checked ? "is-selected" : ""}
                            onClick={() => toggleRequest(request)}
                            aria-pressed={checked}
                          >
                            {checked && <Check size={14} aria-hidden="true" />}
                            {request}
                          </button>
                        );
                      })}
                    </div>
                    <label className="bkm-notes">
                      <span>Ghi chú cho nhà hàng</span>
                      <textarea
                        rows="3"
                        value={formData.notes}
                        onChange={(event) => handleChange("notes", event.target.value)}
                        placeholder="Ví dụ: trang trí sinh nhật, vị trí xe lăn, dị ứng khác..."
                      />
                    </label>
                  </FormSection>
                </>
              ) : (
                <BookingSummaryPreview
                  restaurantName={restaurant?.name}
                  formData={formData}
                  tableCode={selectedTable?.code || tableCode}
                  floor={floorLabel}
                  tableDeposit={deposit}
                  menuDeposit={menuDeposit}
                  totalDeposit={totalDeposit}
                  duration={durationPreview}
                  requests={selectedRequests}
                />
              )}
            </main>

            <aside className="bkm-summary-column" aria-label="Tóm tắt bàn đã chọn">
              <SelectedTableCard
                table={selectedTable}
                code={selectedTable?.code || tableCode}
                capacity={capacity}
                floor={floorLabel}
                type={tableTypeLabel(selectedTable?.type)}
                deposit={deposit}
                loading={tableLoading}
              />

              {bookingPerks.length > 0 && (
                <div className="bkm-side-card bkm-perks">
                  <span className="bkm-side-label">Quyền lợi tại bàn</span>
                  <ul>
                    {bookingPerks.map((perk) => (
                      <li key={perk}>
                        <Check size={14} aria-hidden="true" /> {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bkm-side-card bkm-order-card">
                <div>
                  <span className="bkm-side-label">Đặt món trước</span>
                  <strong>
                    {restaurantCartItems.length
                      ? `${restaurantCartItems.length} món · ${formatCurrency(menuSubtotal)}`
                      : "Chưa có món trong giỏ"}
                  </strong>
                  <small>
                    Cọc món {menuDepositPercent}%: {formatCurrency(menuDeposit)}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={handleChooseDishes}
                >
                  <Sparkles size={15} aria-hidden="true" /> Chọn món
                </button>
              </div>

              {selectedTable?.vrUrl && (
                <a
                  className="bkm-vr-link"
                  href={selectedTable.vrUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Video size={17} aria-hidden="true" /> Xem vị trí bàn 360°
                </a>
              )}

              <div className="bkm-side-card bkm-policy">
                <div className="bkm-policy-title">
                  <Info size={16} aria-hidden="true" /> Chính sách giữ chỗ
                </div>
                <ul>
                  <li>
                    Bàn được giữ trong {selectedTable?.reservationHoldMinutes || 15} phút
                    kể từ giờ đặt.
                  </li>
                  <li>
                    {selectedTable?.cancelPolicy ||
                      "Liên hệ nhà hàng sớm nếu cần thay đổi hoặc hủy lịch."}
                  </li>
                  {Number(selectedTable?.minSpend || 0) > 0 && (
                    <li>
                      Chi tiêu tối thiểu: {formatCurrency(selectedTable.minSpend)}.
                    </li>
                  )}
                </ul>
              </div>
            </aside>
          </div>
        </div>

        <footer className="bkm-footer">
          <div className="bkm-footer-total">
            <span>{showSummary ? "Cần thanh toán cọc" : "Tổng tiền cọc dự kiến"}</span>
            <strong>{formatCurrency(totalDeposit)}</strong>
          </div>
          {!showSummary ? (
            <button
              type="button"
              className="bkm-primary-btn"
              onClick={handleContinue}
              disabled={restaurantLoading || tableLoading || dataUnavailable}
            >
              Kiểm tra thông tin <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <div className="bkm-footer-actions">
              <button
                type="button"
                className="bkm-secondary-btn"
                onClick={() => setShowSummary(false)}
                disabled={isLoading}
              >
                Chỉnh sửa
              </button>
              <button
                type="button"
                className="bkm-primary-btn"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? "Đang xác nhận..." : "Xác nhận đặt bàn"}
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
};

const RestaurantCard = ({ restaurant, loading, error }) => (
  <div className={`bkm-restaurant-card ${loading ? "is-loading" : ""}`}>
    <div className="bkm-restaurant-icon">
      <Store size={22} aria-hidden="true" />
    </div>
    <div>
      <span>Nhà hàng</span>
      <strong>
        {loading
          ? "Đang tải thông tin nhà hàng"
          : error
            ? "Không tải được thông tin nhà hàng"
            : restaurant?.name || "Nhà hàng không khả dụng"}
      </strong>
      <p>
        <MapPin size={14} aria-hidden="true" />
        {loading ? "Đang xác định địa chỉ..." : addressToText(restaurant?.address)}
      </p>
    </div>
  </div>
);

const FormSection = ({ number, title, description, children }) => (
  <section className="bkm-form-section">
    <div className="bkm-section-heading">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
    <div className="bkm-section-content">{children}</div>
  </section>
);

const InputGroup = ({ label, icon, error, children }) => (
  <label className={`bkm-input-group ${error ? "has-error" : ""}`}>
    <span>{label}</span>
    <div>
      {icon}
      {children}
    </div>
    {error && <em>{error}</em>}
  </label>
);

const SelectedTableCard = ({
  table,
  code,
  capacity,
  floor,
  type,
  deposit,
  loading,
}) => (
  <div className="bkm-table-card">
    <div className="bkm-table-card-top">
      <div>
        <span>Bàn đã chọn</span>
        <strong>{loading ? "..." : code || "—"}</strong>
      </div>
      <span className="bkm-table-status">
        <Check size={14} aria-hidden="true" /> Đã giữ lựa chọn
      </span>
    </div>
    <div className="bkm-table-meta">
      <div>
        <Users size={16} aria-hidden="true" />
        <span>Sức chứa</span>
        <strong>{capacity} khách</strong>
      </div>
      <div>
        <MapPin size={16} aria-hidden="true" />
        <span>Vị trí</span>
        <strong>{floor != null ? `Tầng ${floor}` : "Theo sơ đồ"}</strong>
      </div>
      <div>
        <Receipt size={16} aria-hidden="true" />
        <span>Loại bàn</span>
        <strong>{type}</strong>
      </div>
    </div>
    <div className="bkm-table-deposit">
      <span>Cọc giữ bàn</span>
      <strong>{formatCurrency(deposit)}</strong>
    </div>
    {table?.status && table.status !== "available" && (
      <div className="bkm-table-warning" role="alert">
        Bàn vừa thay đổi trạng thái. Vui lòng chọn lại bàn.
      </div>
    )}
  </div>
);

const BookingSummaryPreview = ({
  restaurantName,
  formData,
  tableCode,
  floor,
  tableDeposit,
  menuDeposit,
  totalDeposit,
  duration,
  requests,
}) => (
  <section className="bkm-confirmation">
    <div className="bkm-confirmation-heading">
      <span>
        <Check size={18} aria-hidden="true" />
      </span>
      <div>
        <h3>Kiểm tra lần cuối</h3>
        <p>Thông tin sẽ được gửi đến nhà hàng sau khi bạn xác nhận.</p>
      </div>
    </div>

    <dl>
      <div>
        <dt>Nhà hàng</dt>
        <dd>{restaurantName || "—"}</dd>
      </div>
      <div>
        <dt>Khách hàng</dt>
        <dd>{formData.customerName}</dd>
      </div>
      <div>
        <dt>Liên hệ</dt>
        <dd>{formData.customerPhone || formData.customerEmail}</dd>
      </div>
      <div>
        <dt>Thời gian</dt>
        <dd>
          {formatDateTime(formData.date, formData.time)}
          {formData.openEnded ? " · Không giới hạn" : ` · ${duration} phút`}
        </dd>
      </div>
      <div>
        <dt>Vị trí</dt>
        <dd>
          Bàn {tableCode}
          {floor != null ? ` · Tầng ${floor}` : ""}
        </dd>
      </div>
      <div>
        <dt>Số khách</dt>
        <dd>{formData.partySize} khách</dd>
      </div>
      {requests.length > 0 && (
        <div>
          <dt>Yêu cầu</dt>
          <dd>{requests.join(", ")}</dd>
        </div>
      )}
      {formData.notes && (
        <div>
          <dt>Ghi chú</dt>
          <dd>{formData.notes}</dd>
        </div>
      )}
    </dl>

    <div className="bkm-payment-breakdown">
      <div>
        <span>Cọc bàn</span>
        <strong>{formatCurrency(tableDeposit)}</strong>
      </div>
      <div>
        <span>Cọc món</span>
        <strong>{formatCurrency(menuDeposit)}</strong>
      </div>
      <div className="is-total">
        <span>Tổng cần thanh toán</span>
        <strong>{formatCurrency(totalDeposit)}</strong>
      </div>
    </div>
  </section>
);

export default BookingModal;
