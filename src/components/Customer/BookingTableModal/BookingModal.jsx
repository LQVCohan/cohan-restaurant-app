import React, { useState, useEffect, useContext, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
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
} from "lucide-react";
import { AuthContext } from "../../../context/AuthContext";
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
  const { createBooking, isLoading } = useBookingTable();
  const { showNotification } = useNotification();

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
      variables: { restaurantId, status: "available", limit: 200 },
      skip: !restaurantId || !needPickTable,
      fetchPolicy: "network-only",
    }
  );
  const tables = useMemo(() => tablesData?.tables ?? [], [tablesData]);

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
    notes: "",
  });
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
      customerName: autoName,
      customerPhone: autoPhone,
      customerEmail: autoEmail,
    }));
  }, [isOpen, needPickTable, tableId, tableCapacity, user]);

  useEffect(() => {
    if (!isOpen) return;
    if (needPickTable && tables.length > 0 && !pickedTable?.id) {
      setPickedTable(tables[0]);
    }
  }, [isOpen, needPickTable, tables, pickedTable]);

  const capacity = pickedTable?.capacity || tableCapacity || 4;
  const deposit = useMemo(
    () => getDepositFromTable(pickedTable, formData.partySize),
    [pickedTable, formData.partySize]
  );

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
    if (!formData.timeOut) errs.timeOut = "Chọn giờ ra";
    if (timeWarning === "Đã qua.") errs.time = "Giờ không hợp lệ";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    const durationMinutes = calculateDurationMinutes(
      formData.date,
      formData.time,
      formData.timeOut
    );
    const timeToISO = localDateTimeToISO(formData.date, formData.time);

    if (durationMinutes < 30) {
      showNotification("Thời gian dùng bữa tối thiểu 30 phút.", "error");
      return;
    }

    try {
      const input = {
        restaurantId,
        tableId: pickedTable.id,
        timeTo: timeToISO,
        durationMinutes: durationMinutes,
        partySize: Number(formData.partySize),
        note: formData.notes || "",
        customerName: formData.customerName?.trim(),
        customerPhone: formData.customerPhone?.trim() || null,
        customerEmail: formData.customerEmail?.trim() || null,
        depositAmount: deposit,
      };

      const reservation = await createBooking(input);
      if (reservation) {
        onBookingConfirmed?.(reservation);
        onClose?.();
      }
    } catch (e) {
      showNotification(e?.message || "Lỗi đặt bàn.", "error");
    }
  };

  if (!isOpen) return null;
  const durationPreview = calculateDurationMinutes(
    formData.date,
    formData.time,
    formData.timeOut
  );

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
              tables={tables}
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
              openingHours={restaurant?.openingHours}
              closingHours={restaurant?.closingHours}
              onChange={handleChange}
              errors={errors}
              warning={timeWarning}
            />
          </div>

          <div className="bkm-note-area">
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Ghi chú đặc biệt (dị ứng, trang trí sinh nhật...)"
            />
          </div>

          {showSummary && (
            <BookingSummaryPreview
              formData={formData}
              tableCode={pickedTable?.code || pickedTable?.id}
              deposit={deposit}
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
    if (!time) return [];
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
            disabled={!time}
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

const BookingSummaryPreview = ({ formData, tableCode, deposit, duration }) => (
  <div className="bkm-receipt-preview">
    <div className="receipt-header">Xác nhận thông tin</div>
    <div className="receipt-row">
      <span>Khách hàng:</span>
      <strong>{formData.customerName}</strong>
    </div>
    <div className="receipt-row">
      <span>Thời gian:</span>
      <strong>
        {formatDateTime(formData.date, formData.time)} ({duration}p)
      </strong>
    </div>
    <div className="receipt-row">
      <span>Vị trí:</span>
      <strong>Bàn {tableCode}</strong>
    </div>
    <div className="receipt-divider"></div>
    <div className="receipt-row total">
      <span>Tiền cọc:</span>
      <span className="money">{formatCurrency(deposit)}</span>
    </div>
  </div>
);

export default BookingModal;
