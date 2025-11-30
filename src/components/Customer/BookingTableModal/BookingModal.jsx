import React, { useState, useEffect, useContext, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
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

const parseTimeStr = (timeStr) => {
  if (!timeStr) return null;
  const t = timeStr.trim().toLowerCase();
  const [timePart] = t.split(" ");
  let [h, m] = timePart.replace(/[a-z]/g, "").split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  if (t.includes("pm") && h !== 12) h += 12;
  if (t.includes("am") && h === 12) h = 0;
  return { h, m, totalMinutes: h * 60 + m };
};

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
  // Lấy thông tin user từ Context
  const { user } = useContext(AuthContext) || {};

  const { createBooking, isLoading } = useBookingTable();
  const { showNotification } = useNotification();

  // Khóa scroll body
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

  // --- PREFILL DATA & AUTO-FILL USER ---
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

    // ✅ LOGIC AUTO-FILL TỪ USER ĐĂNG NHẬP
    // Ưu tiên lấy từ user context, nếu không có thì để rỗng
    const autoName = user?.fullName || user?.name || "";
    const autoPhone = user?.phone || user?.phoneNumber || "";
    const autoEmail = user?.email || "";

    setFormData((prev) => ({
      ...prev,
      date: today,
      partySize: Math.min(2, preTable?.capacity || 4),
      time: "",
      timeOut: "",
      // Fill thông tin khách hàng
      customerName: autoName,
      customerPhone: autoPhone,
      customerEmail: autoEmail,
    }));
  }, [isOpen, needPickTable, tableId, tableCapacity, user]); // Thêm 'user' vào dependency

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
    if (!formData.customerName?.trim()) errs.customerName = "Nhập tên";
    if (!formData.customerPhone?.trim() && !formData.customerEmail?.trim())
      errs.contact = "Cần SĐT hoặc Email";
    if (!pickedTable?.id) errs.table = "Chọn bàn";
    if (!formData.date) errs.date = "Chọn ngày";
    if (!formData.time) errs.time = "Chọn giờ vào";
    if (!formData.timeOut) errs.timeOut = "Chọn giờ ra";
    if (timeWarning === "Đã qua.") errs.time = "Giờ sai";
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
        <div className="bkm-header">
          <h2 className="bkm-title">Đặt Bàn</h2>
          <button className="bkm-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="bkm-body">
          <RestaurantInfo restaurant={restaurant} />

          <div className="bkm-compact-form">
            <div className="bkm-row">
              <InputGroup label="Họ tên *" error={errors.customerName}>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => handleChange("customerName", e.target.value)}
                />
              </InputGroup>
              <InputGroup label="SĐT *" error={errors.contact}>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) =>
                    handleChange("customerPhone", e.target.value)
                  }
                />
              </InputGroup>
            </div>
            <div className="bkm-row">
              <InputGroup label="Email (Nhận vé)" className="flex-grow">
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) =>
                    handleChange("customerEmail", e.target.value)
                  }
                />
              </InputGroup>
            </div>
          </div>

          <div className="bkm-divider"></div>

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

          <div className="bkm-row-4">
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
              rows="1"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Ghi chú thêm..."
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

        <div className="bkm-footer">
          {!showSummary ? (
            <button
              className="bkm-btn bkm-btn-primary full-width"
              onClick={() => {
                if (validate()) setShowSummary(true);
              }}
            >
              Tiếp tục & Xem lại
            </button>
          ) : (
            <div className="bkm-footer-actions">
              <button
                className="bkm-btn bkm-btn-text"
                onClick={() => setShowSummary(false)}
              >
                Quay lại
              </button>
              <button
                className="bkm-btn bkm-btn-success flex-grow"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? "Đang xử lý..." : "✅ Xác nhận"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ──────── Sub-Components & Logic Generators ──────── */

const generateSlots = (
  startStr,
  endStr,
  selectedDate = null,
  includeEnd = false
) => {
  // Helper parse giờ
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
        <label>Ngày</label>
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
          Giờ vào {warning && <span className="warn-badge">!</span>}
        </label>
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
      <div className="bkm-control-box">
        <label>Giờ ra</label>
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
      {warning && <div className="bkm-full-width-warn">{warning}</div>}
    </>
  );
};

const InputGroup = ({ label, children, error, className = "" }) => (
  <div className={`bkm-input-wrap ${className} ${error ? "has-error" : ""}`}>
    <label>{label}</label>
    {children}
  </div>
);
const RestaurantInfo = ({ restaurant }) => (
  <div className="bkm-res-header">
    <div className="icon">🏪</div>
    <div className="text">
      <h3 className="name">{restaurant?.name || "Đang tải..."}</h3>
      <p className="addr">{addressToText(restaurant?.address)}</p>
    </div>
  </div>
);
const SelectedTable = ({ tableCode, capacity, floor }) => (
  <div className="bkm-selected-table">
    <div className="icon">🪑</div>
    <div className="info">
      <span className="code">Bàn {tableCode}</span>
      <span className="meta">
        {capacity} ghế {floor && `• Tầng ${floor}`}
      </span>
    </div>
    <div className="badge-check">✔</div>
  </div>
);
const TablePicker = ({ loading, tables, pickedTable, onPick, error }) => (
  <div className="bkm-table-picker">
    <label>Chọn bàn:</label>
    {loading ? (
      <span>Loading...</span>
    ) : (
      <div className="chips">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            className={pickedTable?.id === t.id ? "active" : ""}
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
    <label>Khách</label>
    <div className="stepper">
      <button
        type="button"
        onClick={() => onButtonChange(-1)}
        disabled={value <= 1}
      >
        −
      </button>
      <span>{value}</span>
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
  <div className="bkm-mini-summary">
    <div className="line">
      <span>👤 {formData.customerName}</span>
      <span>🪑 Bàn {tableCode}</span>
    </div>
    <div className="line">
      <span>
        📅 {formatDateTime(formData.date, formData.time)} ({duration}p)
      </span>
      <span className="money">Cọc: {formatCurrency(deposit)}</span>
    </div>
  </div>
);

export default BookingModal;
