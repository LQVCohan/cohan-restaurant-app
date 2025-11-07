import React, { useState, useEffect, useContext, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import Modal, { ModalFooter } from "@/components/common/Modal";
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

/* ─────────────── Utils ─────────────── */
const phoneRegex = /^(\+?\d{7,15})$/i;
const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function requirePhoneOrEmail({ phone, email }) {
  const phoneOk = phone ? phoneRegex.test(String(phone).trim()) : false;
  const emailOk = email ? emailRegex.test(String(email).trim()) : false;
  return phoneOk || emailOk;
}

function addressToText(addr) {
  if (!addr) return "—";
  const parts = [
    addr.line1,
    addr.line2,
    addr.ward,
    addr.district,
    addr.city,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
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
  if (isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

/* ───────────────── BookingModal ───────────────── */
const BookingModal = ({
  isOpen,
  onClose,
  restaurantId,
  tableCode,
  tableId, // optional
  tableCapacity, // optional
  tableFloor, // optional
  onBookingConfirmed, // (reservation) => void
}) => {
  const { user } = useContext(AuthContext) || {};
  const { createBooking, isLoading } = useBookingTable();
  const { showNotification } = useNotification();
  console.log("tableCode", tableCode);
  /* Lấy dữ liệu nhà hàng */
  const { data: rData } = useQuery(GET_RESTAURANT, {
    variables: { id: restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-first",
  });
  const restaurant = rData?.restaurant;

  /* useMemo để ổn định deps */
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

  /* State quản lý form */
  const [pickedTable, setPickedTable] = useState(null);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    partySize: 2,
    date: "",
    time: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [showSummary, setShowSummary] = useState(false);

  /* Prefill khi mở modal */
  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setShowSummary(false);

    const today = new Date().toISOString().split("T")[0];
    const preTable = needPickTable
      ? null
      : {
          id: tableId,
          code: tableId,
          capacity: tableCapacity || 4,
        };
    setPickedTable(preTable);

    const customerName = user?.fullName || user?.name || "";
    const customerPhone = user?.phone || "";
    const customerEmail = user?.email || "";

    setFormData((prev) => ({
      ...prev,
      date: today,
      partySize: Math.min(2, preTable?.capacity || 4),
      customerName,
      customerPhone,
      customerEmail,
      time: prev.time || "",
    }));
  }, [isOpen, needPickTable, tableId, tableCapacity, user]);

  /* Tự động chọn bàn đầu tiên nếu cần */
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

  /* Handlers */
  const onChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const handlePartyBtn = (delta) => {
    const next = Math.max(1, Math.min(12, Number(formData.partySize) + delta));
    setFormData((prev) => ({ ...prev, partySize: next }));
    if (next > capacity) {
      showNotification(
        `Bàn hiện chọn chỉ chứa tối đa ${capacity} người.`,
        "error"
      );
    }
  };

  const handlePartyInput = (e) => {
    const val = Math.max(1, parseInt(e.target.value || "1", 10));
    setFormData((prev) => ({ ...prev, partySize: val }));
    if (val > capacity) {
      showNotification(
        `Bàn hiện chọn chỉ chứa tối đa ${capacity} người.`,
        "error"
      );
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.customerName?.trim())
      errs.customerName = "Vui lòng nhập họ tên.";
    if (
      !requirePhoneOrEmail({
        phone: formData.customerPhone,
        email: formData.customerEmail,
      })
    ) {
      errs.customerPhone = "Cần ít nhất 1 trong 2: SĐT hoặc Email.";
      errs.customerEmail = "Cần ít nhất 1 trong 2: SĐT hoặc Email.";
    } else {
      if (
        formData.customerPhone &&
        !phoneRegex.test(formData.customerPhone.trim())
      ) {
        errs.customerPhone = "Số điện thoại không hợp lệ.";
      }
      if (
        formData.customerEmail &&
        !emailRegex.test(formData.customerEmail.trim())
      ) {
        errs.customerEmail = "Email không hợp lệ.";
      }
    }
    if (!pickedTable?.id) errs.table = "Vui lòng chọn bàn.";
    if (!formData.date) errs.date = "Chọn ngày.";
    if (!formData.time) errs.time = "Chọn giờ.";
    if (Number(formData.partySize) > capacity)
      errs.partySize = `Tối đa ${capacity} người.`;

    setErrors(errs);

    if (errs.table) {
      setTimeout(() => {
        const el = document.getElementById("tablePickerSection");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }

    return Object.keys(errs).length === 0;
  };

  const handlePreview = () => {
    if (!validate()) {
      showNotification("Vui lòng kiểm tra thông tin.", "error");
      return;
    }
    setShowSummary(true);
    showNotification("Vui lòng kiểm tra thông tin và xác nhận.", "info");
    setTimeout(() => {
      const el = document.getElementById("bookingSummary");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const handleConfirm = async () => {
    if (!validate()) {
      showNotification("Vui lòng kiểm tra thông tin.", "error");
      return;
    }
    if (!pickedTable?.id) {
      setErrors((e) => ({ ...e, table: "Vui lòng chọn bàn." }));
      showNotification("Vui lòng chọn bàn.", "error");
      return;
    }

    const timeToISO = localDateTimeToISO(formData.date, formData.time);
    if (!timeToISO) {
      showNotification("Thời gian không hợp lệ.", "error");
      return;
    }

    try {
      const input = {
        restaurantId,
        tableId: pickedTable.id,
        timeTo: timeToISO,
        durationMinutes: 90,
        partySize: Number(formData.partySize) || 2,
        note: formData.notes || "",
        customerName: formData.customerName?.trim(),
        customerPhone: formData.customerPhone?.trim() || null,
        customerEmail: formData.customerEmail?.trim() || null,
        depositAmount: deposit,
      };

      const reservation = await createBooking(input);
      if (!reservation) throw new Error("Không nhận được dữ liệu đặt bàn.");
      console.log("Reservation created:", reservation);
      onBookingConfirmed?.(reservation);
      onClose?.();
    } catch (e) {
      showNotification(e?.message || "Đặt bàn thất bại.", "error");
    }
  };

  /* Render */
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🍽️ Đặt Bàn Nhà Hàng"
      size="lg"
      closeOnOverlayClick
      closeOnEscape
      showCloseButton={false}
    >
      <div className="booking-modal-wrapper">
        <div className="booking-modal-content">
          <RestaurantInfo restaurant={restaurant} />

          <CustomerForm
            formData={formData}
            errors={errors}
            onChange={onChange}
          />

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
              tableCode={tableCode || pickedTable?.label || pickedTable?.label}
              capacity={capacity}
              floor={tableFloor}
            />
          )}

          <PartySize
            value={formData.partySize}
            maxCapacity={capacity}
            onButtonChange={handlePartyBtn}
            onInput={handlePartyInput}
            error={errors.partySize}
          />

          <DateTimeSelection
            date={formData.date}
            time={formData.time}
            onChange={onChange}
            errors={errors}
          />

          <NotesSection value={formData.notes} onChange={onChange} />

          {showSummary && (
            <BookingSummary
              formData={formData}
              tableCode={pickedTable?.code || pickedTable?.id}
              deposit={deposit}
            />
          )}
        </div>

        <ModalFooter className="booking-modal-footer">
          {!showSummary ? (
            <button className="btn btn--primary" onClick={handlePreview}>
              👁️ Xem trước
            </button>
          ) : (
            <button
              className="btn btn--success"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner" />
                  Đang xử lý...
                </>
              ) : (
                "✅ Xác nhận đặt bàn"
              )}
            </button>
          )}
          <button className="btn btn--secondary" onClick={onClose}>
            Hủy
          </button>
        </ModalFooter>
      </div>
    </Modal>
  );
};

/* ───────────── Sub-components ───────────── */
const RestaurantInfo = ({ restaurant }) => {
  const name = restaurant?.name || "—";
  const addr = addressToText(restaurant?.address);
  return (
    <div className="booking-section">
      <div className="restaurant-info">
        <h3 className="restaurant-name">🏪 {name}</h3>
        <p className="restaurant-address">📍 {addr}</p>
      </div>
    </div>
  );
};

const CustomerForm = ({ formData, errors, onChange }) => (
  <div className="booking-section">
    <h3 className="section-title">👤 Thông tin khách hàng</h3>
    <div className="form-grid">
      <div className="form-group">
        <label className="form-label">Họ và tên *</label>
        <input
          type="text"
          className={`form-input ${
            errors.customerName ? "form-input--error" : ""
          }`}
          value={formData.customerName}
          onChange={(e) => onChange("customerName", e.target.value)}
          placeholder="Nhập họ và tên"
          required
        />
        {errors.customerName && (
          <span className="form-error">{errors.customerName}</span>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Số điện thoại</label>
        <input
          type="tel"
          className={`form-input ${
            errors.customerPhone ? "form-input--error" : ""
          }`}
          value={formData.customerPhone}
          onChange={(e) => onChange("customerPhone", e.target.value)}
          placeholder="0901234567"
        />
        {errors.customerPhone && (
          <span className="form-error">{errors.customerPhone}</span>
        )}
      </div>

      <div className="form-group form-group--full">
        <label className="form-label">Email</label>
        <input
          type="email"
          className={`form-input ${
            errors.customerEmail ? "form-input--error" : ""
          }`}
          value={formData.customerEmail}
          onChange={(e) => onChange("customerEmail", e.target.value)}
          placeholder="email@example.com"
        />
        {errors.customerEmail && (
          <span className="form-error">{errors.customerEmail}</span>
        )}
        <div className="hint">
          * Cần ít nhất 1 trong 2: số điện thoại hoặc email.
        </div>
      </div>
    </div>
  </div>
);

const TablePicker = ({ loading, tables, pickedTable, onPick, error }) => (
  <div className="booking-section" id="tablePickerSection">
    <h3 className="section-title">🪑 Chọn bàn</h3>
    {loading ? (
      <p>Đang tải bàn...</p>
    ) : tables.length === 0 ? (
      <p>Chưa có bàn khả dụng.</p>
    ) : (
      <div className="table-picker-grid">
        {tables.map((t) => {
          const selected = pickedTable?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`table-chip ${selected ? "selected" : ""}`}
              onClick={() => onPick(t)}
              disabled={t.status !== "available"}
              title={
                t.status !== "available"
                  ? "Bàn không khả dụng"
                  : `Sức chứa: ${t.capacity}`
              }
            >
              <span>#{t.code || t.id}</span>
              <span className="dot" />
              <span>{t.capacity} người</span>
            </button>
          );
        })}
      </div>
    )}
    {error && <span className="form-error">{error}</span>}
  </div>
);

const SelectedTable = ({ tableCode, capacity, floor }) => (
  <div className="booking-section">
    <h3 className="section-title">🪑 Bàn đã chọn</h3>
    <div className="selected-table-display">
      <div className="table-card-large">
        <div className="table-icon">🪑</div>
        <div className="table-info">
          <div className="table-id-large">{tableCode || "—"}</div>
          <div className="table-details">
            <div className="table-capacity-large">
              Sức chứa: {capacity || 4} người
            </div>
            {floor != null && <div className="table-floor">Tầng {floor}</div>}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PartySize = ({ value, maxCapacity, onButtonChange, onInput, error }) => (
  <div className="booking-section">
    <h3 className="section-title">👥 Số người</h3>
    <div className="party-size-selector">
      <button
        type="button"
        className="party-btn"
        onClick={() => onButtonChange(-1)}
        disabled={value <= 1}
      >
        -
      </button>
      <input
        type="number"
        className="party-input"
        value={value}
        min="1"
        max={maxCapacity || 12}
        onChange={onInput}
      />
      <button
        type="button"
        className="party-btn"
        onClick={() => onButtonChange(1)}
        disabled={value >= (maxCapacity || 12)}
      >
        +
      </button>
    </div>
    {error && <span className="form-error">{error}</span>}
  </div>
);

const DateTimeSelection = ({ date, time, onChange, errors }) => {
  const timeSlots = [
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
  ];
  return (
    <div className="booking-section">
      <h3 className="section-title">📅 Chọn ngày và giờ đến</h3>
      <div className="datetime-selection">
        <div className="form-group">
          <label className="form-label">Ngày đến *</label>
          <input
            type="date"
            className={`form-input ${errors.date ? "form-input--error" : ""}`}
            value={date}
            onChange={(e) => onChange("date", e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            required
          />
          {errors.date && <span className="form-error">{errors.date}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Giờ đến *</label>
          <select
            className={`form-input ${errors.time ? "form-input--error" : ""}`}
            value={time}
            onChange={(e) => onChange("time", e.target.value)}
            required
          >
            <option value="">Chọn giờ...</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          {errors.time && <span className="form-error">{errors.time}</span>}
        </div>
      </div>
    </div>
  );
};

const NotesSection = ({ value, onChange }) => (
  <div className="booking-section">
    <h3 className="section-title">📝 Ghi chú đặc biệt</h3>
    <div className="form-group form-group--full">
      <textarea
        className="form-textarea"
        value={value}
        onChange={(e) => onChange("notes", e.target.value)}
        placeholder="Yêu cầu đặc biệt (nếu có)..."
        rows="4"
      />
    </div>
  </div>
);

const BookingSummary = ({ formData, tableCode, deposit }) => (
  <div className="booking-section" id="bookingSummary">
    <h3 className="section-title">📋 Tóm tắt đặt bàn</h3>
    <div className="summary-box">
      <SummaryItem label="👤 Người đặt" value={formData.customerName || "-"} />
      <SummaryItem label="🪑 Bàn" value={tableCode || "-"} />
      <SummaryItem label="👥 Số người" value={`${formData.partySize} người`} />
      <SummaryItem
        label="📅 Ngày giờ"
        value={
          formData.date && formData.time
            ? formatDateTime(formData.date, formData.time)
            : "-"
        }
      />
      <SummaryItem label="📝 Ghi chú" value={formData.notes || "Không có"} />
      <SummaryItem
        label="💰 Tiền cọc"
        value={formatCurrency(deposit)}
        highlight
      />
    </div>
  </div>
);

const SummaryItem = ({ label, value, highlight = false }) => (
  <div className={`summary-item ${highlight ? "summary-item--highlight" : ""}`}>
    <span className="summary-label">{label}:</span>
    <span className="summary-value">{value}</span>
  </div>
);

export default BookingModal;
