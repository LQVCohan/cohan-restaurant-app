import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gql, useLazyQuery, useMutation } from "@apollo/client";
import s from "./TableActionsModal.module.scss";
import { usePos } from "../../../../../context/PosContext";
import useOrderManagement from "../../../../../hooks/useOrderManagement";
import { useReservation } from "../../../../../hooks/useReservation";
import { GET_CUSTOMERS_FOR_TABLE_INFO } from "../../../../../hooks/useUserManagement";
import { useNotification } from "../../../../../hooks/useNotification";
import { mapTableMutationError } from "../../../../../utils/tableMutationError";
import { getTableActionDisabledReason, getTableGuardState } from "../../../../../utils/tableGuardState";

const Q_TABLE_CUSTOMER = gql`
  query TableCustomer(
    $restaurantId: ID!
    $tableId: ID
    $tableCode: String
  ) {
    tableCustomer(
      restaurantId: $restaurantId
      tableId: $tableId
      tableCode: $tableCode
    ) {
      id
      restaurantId
      tableId
      tableCode
      customerName
      customerPhone
      customerEmail
      note
      partySize
      timeFrom
      timeTo
      createdAt
      updatedAt
    }
  }
`;

const UPSERT_TABLE_CUSTOMER = gql`
  mutation UpsertTableCustomer($input: UpsertTableCustomerInput!) {
    upsertTableCustomer(input: $input) {
      id
      tableId
      tableCode
      customerName
      customerPhone
      customerEmail
      note
      partySize
      timeFrom
      timeTo
    }
  }
`;

// --- ICONS SVG ---
const IconX = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
const IconTrash = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

function TableActionsModalCore({
  open,
  isOpen,
  table,
  onClose,
  onUpdated,
  onSave,
}) {
  const reallyOpen = open ?? isOpen;

  const {
    restaurantId,
    floors,
    getIdFromLevel,
    refetchTables,
    updateTable,
    setTableStatus,
    moveTable,
    swapTableCodes,
    mergeTables,
    splitTables,
    deleteTable,
    fetchTableByCode,
    fetchOrderByTable,
  } = usePos();

  const { updateOrderCustomerByCode } = useOrderManagement();
  const {
    findConfirmedByTable,
    checkInReservation,
    approveReservationChange,
    rejectReservationChange,
  } = useReservation();
  const [upsertTableCustomer] = useMutation(UPSERT_TABLE_CUSTOMER);
  const [
    loadTableCustomer,
    { data: tableCustomerData, refetch: refetchTableCustomer },
  ] = useLazyQuery(Q_TABLE_CUSTOMER, { fetchPolicy: "network-only" });
  const { showNotification } = useNotification();

  const [orderCodeForTable, setOrderCodeForTable] = useState(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(true);

  // Local states
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [type, setType] = useState("standard");
  const [tags, setTags] = useState("");
  const [status, setStatusLocal] = useState("available");
  const guardState = useMemo(() => getTableGuardState(table), [table]);
  const deleteDisabledReason = useMemo(
    () => getTableActionDisabledReason(table, "delete"),
    [table],
  );
  const [moveLevel, setMoveLevel] = useState(null);
  const [swapWithCode, setSwapWithCode] = useState("");
  const [mergeCodes, setMergeCodes] = useState("");

  const getTodayLocal = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const buildTimeSlots = useMemo(() => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }
    }
    return slots;
  }, []);

  const [todayStr, setTodayStr] = useState(getTodayLocal());
  const [useTimeslot, setUseTimeslot] = useState(true);

  const [cust, setCust] = useState({
    name: "",
    phone: "",
    email: "",
    guests: 0,
    checkinDate: "",
    checkinTime: "",
    checkinTimeTo: "",
    note: "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [phoneSuggestions, setPhoneSuggestions] = useState([]);
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [phoneSuggestionsOpen, setPhoneSuggestionsOpen] = useState(false);
  const [emailSuggestionsOpen, setEmailSuggestionsOpen] = useState(false);
  const phoneBlurTimerRef = useRef(null);
  const emailBlurTimerRef = useRef(null);
  const phoneSuggestionReqRef = useRef(0);
  const emailSuggestionReqRef = useRef(0);
  const suppressPhoneSuggestRef = useRef(false);
  const suppressEmailSuggestRef = useRef(false);

  const [loadPhoneSuggestions, { loading: phoneSuggestionsLoading }] =
    useLazyQuery(GET_CUSTOMERS_FOR_TABLE_INFO, { fetchPolicy: "network-only" });
  const [loadEmailSuggestions, { loading: emailSuggestionsLoading }] =
    useLazyQuery(GET_CUSTOMERS_FOR_TABLE_INFO, { fetchPolicy: "network-only" });

  const [busy, setBusy] = useState({});
  const [activeReservation, setActiveReservation] = useState(null);
  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  const setCustIfChanged = (patch) => {
    let changed = false;
    setCust((prev) => {
      const next = { ...prev, ...patch };
      for (const k of Object.keys(next)) {
        if (next[k] !== prev[k]) {
          changed = true;
          break;
        }
      }
      return changed ? next : prev;
    });
    return changed;
  };

  const findConfirmedByTableRef = useRef(findConfirmedByTable);
  const fetchOrderByTableRef = useRef(fetchOrderByTable);
  useEffect(() => {
    findConfirmedByTableRef.current = findConfirmedByTable;
  }, [findConfirmedByTable]);
  useEffect(() => {
    fetchOrderByTableRef.current = fetchOrderByTable;
  }, [fetchOrderByTable]);

  const hydratedReservationFor = useRef(null);
  const activeReservationRecordRef = useRef(null);
  const hydratedOrderFor = useRef(null);
  const hydratedTableCustomerFor = useRef(null);
  const loadedTableCustomerFor = useRef(null);
  const baselineCustRef = useRef(null);
  const baselineTableRef = useRef(null);

  useEffect(() => {
    if (table && reallyOpen) {
      setCode(table.code || "");
      setCapacity(Number(table.capacity || 0));
      setType(table.type || "standard");
      setTags(Array.isArray(table.tags) ? table.tags.join(", ") : "");
      setStatusLocal(table.status || "available");
      setMoveLevel(table.floorLevel ?? null);
      setSwapWithCode("");
      setMergeCodes("");
      setTodayStr(getTodayLocal());
      setUseTimeslot(
        table.status === "available" || table.status === "reserved",
      );
      setOrderCodeForTable(null);
      setActiveReservation(null);
      activeReservationRecordRef.current = null;
      setSelectedCustomer(null);
      setPhoneSuggestions([]);
      setEmailSuggestions([]);
      setPhoneSuggestionsOpen(false);
      setEmailSuggestionsOpen(false);
      hydratedReservationFor.current = null;
      hydratedOrderFor.current = null;
      hydratedTableCustomerFor.current = null;
      loadedTableCustomerFor.current = null;

      setCust({
        name: "",
        phone: "",
        email: "",
        guests: 0,
        checkinDate: getTodayLocal(),
        checkinTime: "",
        checkinTimeTo: "",
        note: "",
      });
      baselineCustRef.current = {
        name: "",
        phone: "",
        email: "",
        guests: 0,
        checkinDate: getTodayLocal(),
        checkinTime: "",
        checkinTimeTo: "",
        note: "",
      };
      baselineTableRef.current = {
        code: table.code || "",
        capacity: Number(table.capacity || 0),
        type: table.type || "standard",
        tags: Array.isArray(table.tags) ? table.tags.join(", ") : "",
      };
    }
  }, [table, reallyOpen]);

  useEffect(() => {
    if (status === "available" || status === "reserved") return;
    setUseTimeslot(false);
  }, [status]);

  const normalizeSuggestion = (u) => ({
    id: u?.id || null,
    name: u?.fullName || u?.username || u?.name || "",
    phone: u?.phone || "",
    email: u?.email || "",
    raw: u || null,
  });

  const applyCustomerSuggestion = (customer) => {
    if (!customer) return;
    suppressPhoneSuggestRef.current = true;
    suppressEmailSuggestRef.current = true;
    setCust((prev) => ({
      ...prev,
      name: customer.name || prev.name,
      phone: customer.phone || prev.phone,
      email: customer.email || prev.email,
    }));
    setSelectedCustomer(customer);
    setPhoneSuggestions([]);
    setEmailSuggestions([]);
    setPhoneSuggestionsOpen(false);
    setEmailSuggestionsOpen(false);
  };

  useEffect(() => {
    const query = (cust.phone || "").trim();
    if (!query) {
      setPhoneSuggestions([]);
      return;
    }
    if (suppressPhoneSuggestRef.current) {
      suppressPhoneSuggestRef.current = false;
      return;
    }
    if (query.length < 2) {
      setPhoneSuggestions([]);
      return;
    }
    const requestId = phoneSuggestionReqRef.current + 1;
    phoneSuggestionReqRef.current = requestId;
    const timer = setTimeout(async () => {
      try {
        const { data } = await loadPhoneSuggestions({
          variables: { search: query, includeGuests: true },
        });
        if (requestId !== phoneSuggestionReqRef.current) return;
        const raw = Array.isArray(data?.customers) ? data.customers : [];
        const next = raw.map(normalizeSuggestion).filter((c) => c.phone);
        setPhoneSuggestions(next);
      } catch (e) {
        if (requestId !== phoneSuggestionReqRef.current) return;
        console.warn("Phone suggestion error:", e);
        setPhoneSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [cust.phone, loadPhoneSuggestions]);

  useEffect(() => {
    const query = (cust.email || "").trim();
    if (!query) {
      setEmailSuggestions([]);
      return;
    }
    if (suppressEmailSuggestRef.current) {
      suppressEmailSuggestRef.current = false;
      return;
    }
    if (query.length < 2) {
      setEmailSuggestions([]);
      return;
    }
    const requestId = emailSuggestionReqRef.current + 1;
    emailSuggestionReqRef.current = requestId;
    const timer = setTimeout(async () => {
      try {
        const { data } = await loadEmailSuggestions({
          variables: { search: query, includeGuests: true },
        });
        if (requestId !== emailSuggestionReqRef.current) return;
        const raw = Array.isArray(data?.customers) ? data.customers : [];
        const next = raw.map(normalizeSuggestion).filter((c) => c.email);
        setEmailSuggestions(next);
      } catch (e) {
        if (requestId !== emailSuggestionReqRef.current) return;
        console.warn("Email suggestion error:", e);
        setEmailSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [cust.email, loadEmailSuggestions]);

  const isoToDateTimeParts = (iso) => {
    if (!iso) return { date: "", time: "" };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: "", time: "" };
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${HH}:${MM}` };
  };

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!reallyOpen || !table?.id || !restaurantId) return;

      if (
        table.status === "reserved" &&
        hydratedReservationFor.current !== table.id
      ) {
        try {
          const res = await findConfirmedByTableRef.current?.({
            restaurantId,
            tableId: table.id,
          });
          const hasResultEnvelope =
            res &&
            typeof res === "object" &&
            Object.prototype.hasOwnProperty.call(res, "success");
          const r = hasResultEnvelope
            ? res.success
              ? res.data || null
              : null
            : res?.data ?? res?.reservation ?? res?.result ?? res ?? null;
          activeReservationRecordRef.current = r || null;
          setActiveReservation(r || null);
          if (r && !cancelled) {
            const start = isoToDateTimeParts(r.timeTo);
            const durationMinutes = Math.max(0, Number(r.durationMinutes) || 0);
            const startDate = r.timeTo ? new Date(r.timeTo) : null;
            const end =
              startDate && !Number.isNaN(startDate.getTime()) && durationMinutes
                ? isoToDateTimeParts(
                    new Date(
                      startDate.getTime() + durationMinutes * 60000,
                    ).toISOString(),
                  )
                : { date: "", time: "" };
            const nextCust = {
              name: r.customerName ?? r.name ?? "",
              phone: r.customerPhone ?? r.phone ?? "",
              email: r.customerEmail ?? r.email ?? "",
              guests: Number(r.partySize || 0),
              checkinDate: start.date || getTodayLocal(),
              checkinTime: start.time || "",
              checkinTimeTo: end.time || "",
              note: r.note ?? "",
            };
            setCustIfChanged(nextCust);
            baselineCustRef.current = buildCustSnapshot(nextCust);
          }
        } catch (e) {
          console.warn(e);
        } finally {
          hydratedReservationFor.current = table.id;
        }
      }

      if (loadedTableCustomerFor.current !== table?.id) {
        try {
          await loadTableCustomer({
            variables: {
              restaurantId,
              tableId: table?.id || undefined,
              tableCode: table?.code || undefined,
            },
          });
        } catch (e) {
          console.warn(e);
        } finally {
          loadedTableCustomerFor.current = table?.id || null;
        }
      }

      if (hydratedOrderFor.current !== table?.code) {
        try {
          const ores = await fetchOrderByTableRef.current?.(
            restaurantId,
            table.code,
          );
          const groups = Array.isArray(ores?.data) ? ores.data : [];
          const firstGroup = groups[0] || null;

          if (firstGroup && !cancelled) {
            setOrderCodeForTable(firstGroup.orderCode || null);
            const u = firstGroup.user || firstGroup.customer || null;
            if (u) {
              const nextCust = {
                name: u.fullName || u.name || "",
                phone: u.phone || "",
                email: u.email || "",
                guests: Number(firstGroup.partySize || 0),
              };
              setCustIfChanged(nextCust);
              baselineCustRef.current = buildCustSnapshot(nextCust);
            }
          }
        } catch (e) {
          console.warn(e);
        } finally {
          hydratedOrderFor.current = table?.code || null;
        }
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    loadTableCustomer,
    reallyOpen,
    restaurantId,
    table?.id,
    table?.code,
    table?.status,
  ]);

  const mapReservationError = (message = "") => {
    if (message.includes("TABLE_SESSION_CONFLICT"))
      return "Bàn đang có phiên phục vụ khác, không thể check-in.";
    if (message.includes("TABLE_TIME_CONFLICT"))
      return "Khung giờ mới bị trùng với đặt bàn khác.";
    if (message.includes("TABLE_SLOT_HELD"))
      return "Khung giờ này đang được giữ bởi khách khác.";
    if (message.includes("TABLE_UNAVAILABLE"))
      return "Bàn chưa sẵn sàng để nhận khách.";
    if (message.includes("CAPACITY_EXCEEDED"))
      return "Số khách vượt sức chứa bàn.";
    if (message.includes("RESERVATION_CHANGE_NOT_PENDING"))
      return "Yêu cầu thay đổi không còn ở trạng thái chờ duyệt.";
    if (message.includes("RESERVATION_NOT_CONFIRMED"))
      return "Chỉ reservation đã xác nhận mới được check-in.";
    return message || "Thao tác reservation thất bại.";
  };

  const matchedTableCustomer = useMemo(
    () => tableCustomerData?.tableCustomer || null,
    [tableCustomerData],
  );

  useEffect(() => {
    if (!reallyOpen || !table?.id || !matchedTableCustomer) return;
    if (hydratedTableCustomerFor.current === table.id) return;
    if (
      table?.status === "reserved" &&
      hydratedReservationFor.current !== table.id
    ) {
      return;
    }
    if (activeReservationRecordRef.current?.id) return;
    if (table?.status === "occupied" && orderCodeForTable) return;

    const from = isoToDateTimeParts(matchedTableCustomer.timeFrom);
    const to = isoToDateTimeParts(matchedTableCustomer.timeTo);
    const nextCust = {
      name: matchedTableCustomer.customerName ?? "",
      phone: matchedTableCustomer.customerPhone ?? "",
      email: matchedTableCustomer.customerEmail ?? "",
      guests: Number(matchedTableCustomer.partySize || 0),
      checkinDate: from.date || to.date || getTodayLocal(),
      checkinTime: from.time || "",
      checkinTimeTo: to.time || "",
      note: matchedTableCustomer.note ?? "",
    };
    setCustIfChanged(nextCust);
    baselineCustRef.current = buildCustSnapshot(nextCust);
    hydratedTableCustomerFor.current = table.id;
  }, [
    matchedTableCustomer,
    orderCodeForTable,
    reallyOpen,
    table?.id,
    table?.status,
  ]);

  const floorsSorted = useMemo(
    () => (floors || []).slice().sort((a, b) => a.level - b.level),
    [floors],
  );
  const canSplit = !!table?.joinGroupId;

  const visibleTimeSlots = useMemo(() => {
    return (dateStr) => {
      if (!dateStr || dateStr !== todayStr) return buildTimeSlots;
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const cutoff = Math.min(1440, Math.ceil(nowMins / 30) * 30);
      return buildTimeSlots.filter((t) => {
        const [hh, mm] = t.split(":").map((n) => Number(n) || 0);
        const mins = hh * 60 + mm;
        return mins >= cutoff;
      });
    };
  }, [buildTimeSlots, todayStr]);

  // Lock Scroll
  useEffect(() => {
    if (!reallyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [reallyOpen, onClose]);

  if (!reallyOpen || !table) return null;

  /* ================== HELPERS ================== */
  const isEmail = (value) =>
    !!String(value || "")
      .toLowerCase()
      .match(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
  const isPhoneVN = (value) =>
    /^(0|\+84)\d{9,10}$/.test(String(value || ""));
  const combineDateTimeToISO = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const [y, m, d] = dateStr.split("-").map((n) => Number(n));
    const [hh, mm] = timeStr.split(":").map((n) => Number(n));
    return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
  };
  const toMinutes = (hhmm) => {
    if (!hhmm) return NaN;
    const [hh, mm] = hhmm.split(":").map((n) => Number(n));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
    return hh * 60 + mm;
  };

  const calcDurationMinutes = (fromTime, toTime) => {
    const a = toMinutes(fromTime);
    const b = toMinutes(toTime);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const diff = b - a;
    return diff > 0 ? diff : null;
  };

  const clampGuests = (val) =>
    Math.max(0, Number.isFinite(val) ? val : 0);
  const incGuests = (delta) =>
    setCust((prev) => ({
      ...prev,
      guests: clampGuests((prev.guests || 0) + delta),
    }));

  const statusLabels = {
    available: "Trống",
    occupied: "Đang phục vụ",
    reserved: "Đã đặt",
    cleaning: "Đang dọn",
    offline: "Ngưng phục vụ",
  };

  const typeLabels = {
    standard: "Tiêu chuẩn",
    vip: "VIP",
    outdoor: "Ngoài trời",
  };

  const buildCustSnapshot = (source) => ({
    name: (source?.name || "").trim(),
    phone: (source?.phone || "").trim(),
    email: (source?.email || "").trim().toLowerCase(),
    guests: Number(source?.guests || 0),
    checkinDate: source?.checkinDate || "",
    checkinTime: source?.checkinTime || "",
    checkinTimeTo: source?.checkinTimeTo || "",
    note: (source?.note || "").trim(),
  });

  const buildTableSnapshot = (source) => ({
    code: (source?.code || "").trim(),
    capacity: Number(source?.capacity || 0),
    type: source?.type || "standard",
    tags: (source?.tags || "").trim(),
  });

  const hasCustomerChanges = useMemo(() => {
    if (!baselineCustRef.current) return false;
    const current = buildCustSnapshot(cust);
    const baseline = buildCustSnapshot(baselineCustRef.current);
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }, [cust]);

  const hasTableChanges = useMemo(() => {
    if (!baselineTableRef.current) return false;
    const current = buildTableSnapshot({ code, capacity, type, tags });
    const baseline = buildTableSnapshot(baselineTableRef.current);
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }, [code, capacity, type, tags]);

  const resolveCustomerIdentity = () => {
    const name = (cust.name || selectedCustomer?.name || "").trim();
    const phone = (cust.phone || selectedCustomer?.phone || "").trim();
    const email = (cust.email || selectedCustomer?.email || "").trim();
    return { name, phone, email };
  };

  const validateCustomerForReservation = () => {
    const identity = resolveCustomerIdentity();
    const size = Number(cust.guests || 0);
    if (!(size > 0)) {
      alert("Số khách phải lớn hơn 0.");
      return false;
    }
    if (
      Number.isFinite(Number(table.capacity)) &&
      size > Number(table.capacity)
    ) {
      alert(`Số khách (${size}) vượt quá sức chứa (${table.capacity}).`);
      return false;
    }
    const phone = identity.phone;
    const email = identity.email;
    if (!phone && !email) {
      alert("Cần SĐT hoặc Email.");
      return false;
    }
    if (phone && !isPhoneVN(phone)) {
      alert("SĐT không hợp lệ.");
      return false;
    }
    if (email && !isEmail(email)) {
      alert("Email không hợp lệ.");
      return false;
    }
    if (useTimeslot && (status === "available" || status === "reserved")) {
      if (!cust.checkinDate) {
        alert("Vui lòng chọn ngày.");
        return false;
      }
      if (!cust.checkinTime) {
        alert("Vui lòng chọn giờ vào.");
        return false;
      }
      if (cust.checkinDate < todayStr) {
        alert("Ngày không hợp lệ.");
        return false;
      }
      if (!cust.checkinTimeTo) {
        alert("Vui lòng chọn giờ kết thúc.");
        return false;
      }
      const dur = calcDurationMinutes(cust.checkinTime, cust.checkinTimeTo);
      if (!dur) {
        alert("Giờ kết thúc phải lớn hơn giờ vào.");
        return false;
      }
    }
    return true;
  };

  /* ================== HANDLERS ================== */
  const handleSaveBasics = async () => {
    if (!table?.id) return;
    setBusyKey("save", true);
    try {
      await updateTable({
        id: table.id,
        code: code?.trim(),
        capacity: Number(capacity) || 0,
        type: (type || "standard").trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      baselineTableRef.current = buildTableSnapshot({
        code,
        capacity,
        type,
        tags,
      });
      onUpdated?.();
      showNotification?.("Đã lưu thay đổi bàn.", "success");
    } catch (e) {
      console.error(e);
      showNotification?.("Lỗi cập nhật thông tin bàn.", "error");
    } finally {
      setBusyKey("save", false);
    }
  };

  const handleChangeStatus = async (next) => {
    if (!table?.id || next === status) return;
    setBusyKey("status", true);
    try {
      await setTableStatus({ id: table.id, status: next });
      setStatusLocal(next);
      await refetchTables?.();
      onUpdated?.();
      showNotification?.("Đã cập nhật trạng thái bàn.", "success");
    } catch (e) {
      console.error(e);
      showNotification?.(mapTableMutationError(e), "warning");
    } finally {
      setBusyKey("status", false);
    }
  };

  const handleMove = async () => {
    if (!moveLevel) return;
    const floorId = getIdFromLevel(moveLevel);
    if (!floorId) return alert("Lỗi tầng.");
    setBusyKey("move", true);
    try {
      await moveTable({ id: table.id, floorId });
      onUpdated?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyKey("move", false);
    }
  };

  const handleSwap = async () => {
    const codeB = (swapWithCode || "").trim();
    if (!codeB) return;
    const b = fetchTableByCode(codeB);
    if (!b || String(b.floorId) !== String(table.floorId))
      return alert("Không tìm thấy hoặc khác tầng.");
    setBusyKey("swap", true);
    try {
      await swapTableCodes({
        restaurantId,
        floorId: table.floorId,
        aId: table.id,
        bId: b.id,
      });
      onUpdated?.();
      setSwapWithCode("");
    } catch (e) {
      console.error(e);
    } finally {
      setBusyKey("swap", false);
    }
  };

  const handleMerge = async () => {
    const raw = (mergeCodes || "").trim();
    if (!raw) return;
    const ids = Array.from(
      new Set(
        [table.code, ...raw.split(/[,\s]+/)]
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => fetchTableByCode(value))
          .filter(Boolean)
          .map((candidate) => candidate.id),
      ),
    );
    if (ids.length < 2) return alert("Cần > 1 bàn.");
    setBusyKey("merge", true);
    try {
      await mergeTables({ tableIds: ids, anchorId: table.id });
      onUpdated?.();
      setMergeCodes("");
    } catch (e) {
      console.error(e);
    } finally {
      setBusyKey("merge", false);
    }
  };

  const handleSplitOut = async () => {
    if (!canSplit) return;
    setBusyKey("split", true);
    try {
      await splitTables({
        joinGroupId: table.joinGroupId,
        mode: "PARTIAL",
        tableIds: [table.id],
      });
      onUpdated?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyKey("split", false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xoá bàn ${table.code}?`)) return;
    setBusyKey("delete", true);
    try {
      await deleteTable(table.id);
      onUpdated?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      showNotification?.(
        mapTableMutationError(e, "Không thể xoá bàn."),
        "error",
      );
    } finally {
      setBusyKey("delete", false);
    }
  };

  const buildTableCustomerInput = () => {
    const identity = resolveCustomerIdentity();
    const timeFrom =
      useTimeslot && cust.checkinDate && cust.checkinTime
        ? combineDateTimeToISO(cust.checkinDate, cust.checkinTime)
        : null;
    const timeTo =
      useTimeslot && cust.checkinDate && cust.checkinTimeTo
        ? combineDateTimeToISO(cust.checkinDate, cust.checkinTimeTo)
        : null;
    return {
      restaurantId,
      tableId: table?.id || undefined,
      tableCode: table?.code || undefined,
      customerName: identity.name || null,
      customerPhone: identity.phone || null,
      customerEmail: identity.email ? identity.email.toLowerCase() : null,
      note: cust.note || null,
      partySize: Number(cust.guests || 0) || null,
      timeFrom,
      timeTo,
    };
  };

  const hasCustomerIdentity = () =>
    !!(
      cust.name?.trim() ||
      cust.phone?.trim() ||
      cust.email?.trim() ||
      selectedCustomer?.id
    );

  const persistTableCustomer = async () => {
    if (!restaurantId || !table?.code) return;
    const input = buildTableCustomerInput();
    await upsertTableCustomer({ variables: { input } });
    if (refetchTableCustomer) {
      await refetchTableCustomer();
    } else {
      await loadTableCustomer({
        variables: {
          restaurantId,
          tableId: table?.id || undefined,
          tableCode: table?.code || undefined,
        },
      });
    }
  };

  const saveCustomerInfo = async () => {
    if (status === "occupied" && orderCodeForTable && restaurantId) {
      const identity = resolveCustomerIdentity();
      const customer = {
        fullName: identity.name,
        phone: identity.phone,
        email: identity.email,
      };
      if (!customer.fullName && !customer.phone)
        return showNotification?.("Cần tên hoặc SĐT.", "warning");
      try {
        setBusyKey("saveCustomer", true);
        const res = await updateOrderCustomerByCode({
          restaurantId,
          orderCode: orderCodeForTable,
          customer,
        });
        if (hasTableChanges) {
          await handleSaveBasics();
          baselineTableRef.current = buildTableSnapshot({
            code,
            capacity,
            type,
            tags,
          });
        }
        await persistTableCustomer();
        baselineCustRef.current = buildCustSnapshot(cust);
        if (res?.success) {
          showNotification?.("Đã cập nhật đơn hàng.", "success");
          await onUpdated?.();
        } else {
          showNotification?.("Lỗi cập nhật đơn hàng.", "error");
        }
      } catch (e) {
        console.error(e);
        showNotification?.("Lỗi cập nhật đơn hàng.", "error");
      } finally {
        setBusyKey("saveCustomer", false);
      }
      return;
    }
    if (!hasCustomerIdentity()) {
      showNotification?.("Cần tên hoặc SĐT.", "warning");
      return;
    }
    if (
      useTimeslot &&
      (status === "available" || status === "reserved") &&
      !validateCustomerForReservation()
    )
      return;

    const checkin =
      useTimeslot && cust.checkinDate && cust.checkinTime
        ? combineDateTimeToISO(cust.checkinDate, cust.checkinTime)
        : null;
    const durationMinutes =
      useTimeslot && cust.checkinTime && cust.checkinTimeTo
        ? calcDurationMinutes(cust.checkinTime, cust.checkinTimeTo)
        : null;
    try {
      setBusyKey("saveCustomer", true);
      if (onSave) {
        await onSave(table.code, {
          ...cust,
          guests: Number(cust.guests || 0),
          checkin,
          durationMinutes,
        });
      }
      if (hasTableChanges) {
        await handleSaveBasics();
        baselineTableRef.current = buildTableSnapshot({
          code,
          capacity,
          type,
          tags,
        });
      }
      await persistTableCustomer();
      baselineCustRef.current = buildCustSnapshot(cust);
      await onUpdated?.();
      showNotification?.("Đã lưu thông tin khách.", "success");
    } catch (e) {
      console.error(e);
      showNotification?.("Lưu thông tin khách thất bại.", "error");
    } finally {
      setBusyKey("saveCustomer", false);
    }
  };

  const handlePhoneFocus = () => {
    if (phoneBlurTimerRef.current) clearTimeout(phoneBlurTimerRef.current);
    setPhoneSuggestionsOpen(true);
  };
  const handlePhoneBlur = () => {
    if (phoneBlurTimerRef.current) clearTimeout(phoneBlurTimerRef.current);
    phoneBlurTimerRef.current = setTimeout(
      () => setPhoneSuggestionsOpen(false),
      120,
    );
  };
  const handleEmailFocus = () => {
    if (emailBlurTimerRef.current) clearTimeout(emailBlurTimerRef.current);
    setEmailSuggestionsOpen(true);
  };
  const handleEmailBlur = () => {
    if (emailBlurTimerRef.current) clearTimeout(emailBlurTimerRef.current);
    emailBlurTimerRef.current = setTimeout(
      () => setEmailSuggestionsOpen(false),
      120,
    );
  };

  /* ================== RENDER ================== */
  return createPortal(
    <div className={s.backdrop} onClick={onClose}>
      <style>{`input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type=number] { -moz-appearance: textfield; }`}</style>

      <div className={s.modal} onClick={(event) => event.stopPropagation()}>
        <div className={s.header}>
          <div className={s.headerLeft}>
            <h3 className={s.title}>
              Hành động bàn <b>{table.code}</b>
            </h3>
            <span className={s.floorBadge}>Tầng {table.floorLevel}</span>
          </div>
          <button className={s.close} onClick={onClose}>
            <IconX />
          </button>
        </div>

        <div className={s.body}>
          <div className={s.tableInfo}>
            <div className={s.kv}>
              <span className={s.k}>Mã bàn</span>
              <span className={s.v}>{table.code}</span>
            </div>
            <div className={s.kv}>
              <span className={s.k}>Sức chứa</span>
              <span className={s.v}>{table.capacity}</span>
            </div>
            <div className={s.kv}>
              <span className={s.k}>Trạng thái</span>
              <span className={s.v}>
                {statusLabels[status] || status}
              </span>
            </div>
          </div>

          <div className={s.group}>
            <div className={s.label}>Thông tin chung</div>
            <div className={s.twoCols}>
              <input
                className={s.input}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Mã bàn"
              />
              <input
                className={s.input}
                type="number"
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                placeholder="Sức chứa"
              />
              <select
                className={s.select}
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="standard">{typeLabels.standard}</option>
                <option value="vip">{typeLabels.vip}</option>
                <option value="outdoor">{typeLabels.outdoor}</option>
              </select>
              <input
                className={s.input}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Thẻ gắn..."
              />
            </div>
            <div className={s.actionsEnd}>
              <button
                className={`${s.btn} ${s.primary}`}
                onClick={handleSaveBasics}
                disabled={busy.save}
              >
                Lưu thông tin bàn
              </button>
            </div>
          </div>

          <div className={s.group}>
            <div className={s.label}>Trạng thái</div>
            <div className={s.chips}>
              {["available", "occupied", "reserved", "cleaning", "offline"].map(
                (nextStatus) => (
                  <button
                    key={nextStatus}
                    className={`${s.chip} ${status === nextStatus ? s.active : ""}`}
                    data-variant={nextStatus}
                    onClick={() => handleChangeStatus(nextStatus)}
                    disabled={busy.status}
                  >
                    {statusLabels[nextStatus] || nextStatus}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className={s.group}>
            <div className={s.groupHeader}>
              <div className={s.label}>Thao tác nhanh</div>
              <button
                type="button"
                className={s.toggleButton}
                onClick={() => setQuickActionsOpen((prev) => !prev)}
              >
                {quickActionsOpen ? "Thu gọn" : "Mở rộng"}
              </button>
            </div>
            {quickActionsOpen && (
              <div className={s.twoCols}>
                <div>
                  <div className={s.hint} style={{ marginBottom: "0.5rem" }}>
                    Chuyển tầng
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <select
                      className={s.select}
                      value={moveLevel ?? ""}
                      onChange={(event) => setMoveLevel(event.target.value)}
                    >
                      {floorsSorted.map((floor) => (
                        <option key={floor.id} value={floor.level}>
                          Tầng {floor.level}
                        </option>
                      ))}
                    </select>
                    <button
                      className={`${s.btn} ${s.ghost}`}
                      onClick={handleMove}
                      disabled={busy.move}
                    >
                      Chuyển
                    </button>
                  </div>
                </div>
                <div>
                  <div className={s.hint} style={{ marginBottom: "0.5rem" }}>
                    Đổi vị trí (cùng tầng)
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className={s.input}
                      placeholder="Mã đích"
                      value={swapWithCode}
                      onChange={(event) => setSwapWithCode(event.target.value)}
                    />
                    <button
                      className={`${s.btn} ${s.ghost}`}
                      onClick={handleSwap}
                      disabled={busy.swap}
                    >
                      Đổi
                    </button>
                  </div>
                </div>
                <div>
                  <div className={s.hint} style={{ marginBottom: "0.5rem" }}>
                    Gộp bàn
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className={s.input}
                      placeholder="A1, A2..."
                      value={mergeCodes}
                      onChange={(event) => setMergeCodes(event.target.value)}
                    />
                    <button
                      className={`${s.btn} ${s.ghost}`}
                      onClick={handleMerge}
                      disabled={busy.merge}
                    >
                      Gộp
                    </button>
                  </div>
                </div>
                <div>
                  <div className={s.hint} style={{ marginBottom: "0.5rem" }}>
                    Tách bàn
                  </div>
                  <button
                    className={`${s.btn} ${canSplit ? s.ghost : s.isDisabled}`}
                    onClick={handleSplitOut}
                    disabled={!canSplit || busy.split}
                    style={{ width: "100%" }}
                  >
                    Tách khỏi nhóm
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={`${s.group} ${s.customerGroup}`}>
            <div className={s.customerHeader}>
              <div>
                <div className={s.label}>Khách hàng & đặt bàn</div>
                <div className={s.customerIntro}>
                  Lưu thông tin người đại diện và thời gian sử dụng bàn.
                </div>
              </div>
              <span className={s.capacityBadge}>
                Tối đa {Number(table.capacity || 0)} khách
              </span>
            </div>
            <div className={`${s.twoCols} ${s.customerGrid}`}>
              <label className={s.field}>
                <span className={s.fieldLabel}>Tên khách</span>
                <input
                  className={s.input}
                  aria-label="Tên khách"
                  value={cust.name}
                  onChange={(event) => {
                    setSelectedCustomer(null);
                    setCust({ ...cust, name: event.target.value });
                  }}
                  placeholder="Nhập tên người đại diện"
                />
              </label>
              <div className={s.field}>
                <label
                  className={s.fieldLabel}
                  htmlFor={`table-phone-${table.id}`}
                >
                  Số điện thoại
                </label>
                <div className={s.inputGroup}>
                  <input
                    id={`table-phone-${table.id}`}
                    className={s.input}
                    value={cust.phone}
                    onChange={(event) => {
                      setSelectedCustomer(null);
                      setCust({ ...cust, phone: event.target.value });
                    }}
                    onFocus={handlePhoneFocus}
                    onBlur={handlePhoneBlur}
                    placeholder="Ví dụ: 0908 123 456"
                  />
                  {phoneSuggestionsOpen &&
                    (phoneSuggestionsLoading || phoneSuggestions.length > 0) && (
                      <div className={s.suggestions}>
                        {phoneSuggestionsLoading && (
                          <div className={s.suggestionEmpty}>
                            Đang tìm kiếm...
                          </div>
                        )}
                        {!phoneSuggestionsLoading &&
                          phoneSuggestions.map((customer) => (
                            <button
                              key={`phone-${customer.id || customer.phone}`}
                              type="button"
                              className={s.suggestionItem}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyCustomerSuggestion(customer);
                              }}
                            >
                              <span className={s.suggestionName}>
                                {customer.name || "Khách hàng"}
                              </span>
                              <span className={s.suggestionMeta}>
                                {customer.phone}
                                {customer.email ? ` · ${customer.email}` : ""}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                </div>
              </div>

              <div className={s.field}>
                <label
                  className={s.fieldLabel}
                  htmlFor={`table-email-${table.id}`}
                >
                  Email
                </label>
                <div className={s.inputGroup}>
                  <input
                    id={`table-email-${table.id}`}
                    className={s.input}
                    value={cust.email}
                    onChange={(event) => {
                      setSelectedCustomer(null);
                      setCust({ ...cust, email: event.target.value });
                    }}
                    onFocus={handleEmailFocus}
                    onBlur={handleEmailBlur}
                    placeholder="Email khách nếu có"
                  />
                  {emailSuggestionsOpen &&
                    (emailSuggestionsLoading || emailSuggestions.length > 0) && (
                      <div className={s.suggestions}>
                        {emailSuggestionsLoading && (
                          <div className={s.suggestionEmpty}>
                            Đang tìm kiếm...
                          </div>
                        )}
                        {!emailSuggestionsLoading &&
                          emailSuggestions.map((customer) => (
                            <button
                              key={`email-${customer.id || customer.email}`}
                              type="button"
                              className={s.suggestionItem}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                applyCustomerSuggestion(customer);
                              }}
                            >
                              <span className={s.suggestionName}>
                                {customer.name || "Khách hàng"}
                              </span>
                              <span className={s.suggestionMeta}>
                                {customer.email}
                                {customer.phone ? ` · ${customer.phone}` : ""}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                </div>
              </div>

              <div className={`${s.guestScheduleRow} ${s.spanFull}`}>
                <div className={s.guestControl}>
                  <div className={s.guestMeta}>
                    <span className={s.fieldLabel}>Số khách</span>
                    <span className={s.fieldHint}>
                      Sức chứa bàn: {Number(table.capacity || 0)}
                    </span>
                  </div>
                  <div className={s.stepper}>
                    <button
                      type="button"
                      className={s.btnIcon}
                      aria-label="Giảm số khách"
                      onClick={() => incGuests(-1)}
                    >
                      −
                    </button>
                    <input
                      className={s.inputCenter}
                      aria-label="Số khách"
                      type="number"
                      min="0"
                      max={Number(table.capacity || 0) || undefined}
                      value={cust.guests}
                      onChange={(event) =>
                        setCust({
                          ...cust,
                          guests: Number(event.target.value),
                        })
                      }
                    />
                    <button
                      type="button"
                      className={s.btnIcon}
                      aria-label="Tăng số khách"
                      onClick={() => incGuests(1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <label className={s.scheduleToggle}>
                  <input
                    type="checkbox"
                    checked={useTimeslot}
                    onChange={(event) => setUseTimeslot(event.target.checked)}
                    disabled={
                      !(status === "available" || status === "reserved")
                    }
                  />
                  <span>
                    <strong>Đặt lịch</strong>
                    <small>Lưu ngày và khung giờ giữ bàn</small>
                  </span>
                </label>
              </div>

              {useTimeslot &&
                (status === "available" || status === "reserved") && (
                  <div className={`${s.scheduleGrid} ${s.spanFull}`}>
                    <label className={s.field}>
                      <span className={s.fieldLabel}>Ngày đặt</span>
                      <input
                        className={s.input}
                        aria-label="Ngày đặt"
                        type="date"
                        min={todayStr}
                        value={cust.checkinDate}
                        onChange={(event) =>
                          setCust({
                            ...cust,
                            checkinDate: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className={s.field}>
                      <span className={s.fieldLabel}>Giờ vào</span>
                      <select
                        className={s.select}
                        aria-label="Giờ vào"
                        value={cust.checkinTime}
                        onChange={(event) => {
                          const value = event.target.value;
                          setCust((prev) => ({
                            ...prev,
                            checkinTime: value,
                            checkinTimeTo: calcDurationMinutes(
                              value,
                              prev.checkinTimeTo,
                            )
                              ? prev.checkinTimeTo
                              : "",
                          }));
                        }}
                      >
                        <option value="" disabled>
                          Chọn giờ vào
                        </option>
                        {(cust.checkinDate
                          ? visibleTimeSlots(cust.checkinDate)
                          : buildTimeSlots
                        ).map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={s.field}>
                      <span className={s.fieldLabel}>Giờ kết thúc</span>
                      <select
                        className={s.select}
                        aria-label="Giờ kết thúc"
                        value={cust.checkinTimeTo}
                        onChange={(event) =>
                          setCust({
                            ...cust,
                            checkinTimeTo: event.target.value,
                          })
                        }
                        disabled={!cust.checkinTime}
                      >
                        <option value="" disabled>
                          Chọn giờ kết thúc
                        </option>
                        {(cust.checkinDate
                          ? visibleTimeSlots(cust.checkinDate)
                          : buildTimeSlots
                        )
                          .filter((slot) =>
                            calcDurationMinutes(cust.checkinTime, slot),
                          )
                          .map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}
              <label className={`${s.field} ${s.spanFull}`}>
                <span className={s.fieldLabel}>Ghi chú</span>
                <textarea
                  className={`${s.input} ${s.textarea}`}
                  aria-label="Ghi chú"
                  value={cust.note}
                  onChange={(event) =>
                    setCust({ ...cust, note: event.target.value })
                  }
                  placeholder="Dị ứng, vị trí ngồi hoặc lưu ý phục vụ..."
                />
              </label>
            </div>
            <div className={s.actionsEnd}>
              <button
                className={`${s.btn} ${s.primary}`}
                onClick={saveCustomerInfo}
                disabled={
                  busy.saveCustomer || (!hasCustomerChanges && !hasTableChanges)
                }
              >
                Lưu thông tin khách
              </button>
            </div>
          </div>

          <div className={s.group}>
            <div className={s.label}>Đặt bàn / Reservation</div>
            {activeReservation ? (
              <div className={s.reservationInfo}>
                <div>
                  <span>Mã</span>
                  <b>{activeReservation.orderCode || activeReservation.id}</b>
                </div>
                <div>
                  <span>Khách</span>
                  {activeReservation.customerName || "-"}
                </div>
                <div>
                  <span>SĐT</span>
                  {activeReservation.customerPhone || "-"}
                </div>
                <div>
                  <span>Số khách</span>
                  {activeReservation.partySize || "-"}
                </div>
                <div>
                  <span>Giờ đặt</span>
                  {activeReservation.timeTo
                    ? new Date(activeReservation.timeTo).toLocaleString("vi-VN")
                    : "-"}
                </div>
                <div>
                  <span>Trạng thái</span>
                  {activeReservation.status || "-"}
                </div>
                <div>
                  <span>Yêu cầu đổi</span>
                  {activeReservation.changeRequestType || "-"} /{" "}
                  {activeReservation.changeRequestStatus || "-"}
                </div>
              </div>
            ) : (
              <div className={s.hint}>
                Chưa có đặt bàn đang hoạt động cho bàn này.
              </div>
            )}
            <div className={s.actionsEnd}>
              {activeReservation?.status === "confirmed" && (
                <button
                  className={`${s.btn} ${s.primary}`}
                  disabled={busy.checkInReservation}
                  onClick={async () => {
                    setBusyKey("checkInReservation", true);
                    const res = await checkInReservation(activeReservation.id);
                    setBusyKey("checkInReservation", false);
                    if (!res?.success)
                      return showNotification?.(
                        mapReservationError(res?.message),
                        "error",
                      );
                    setActiveReservation(res.data || activeReservation);
                    const latest = await findConfirmedByTableRef.current?.({
                      restaurantId,
                      tableId: table.id,
                    });
                    if (latest?.success)
                      setActiveReservation(latest.data || null);
                    showNotification?.("Nhận bàn thành công.", "success");
                    onUpdated?.();
                  }}
                >
                  Nhận bàn
                </button>
              )}
              {(activeReservation?.status === "pending_change" ||
                activeReservation?.changeRequestStatus === "requested") && (
                <>
                  <button
                    className={`${s.btn} ${s.ghost}`}
                    disabled={busy.approveReservationChange}
                    onClick={async () => {
                      setBusyKey("approveReservationChange", true);
                      const res = await approveReservationChange(
                        activeReservation.id,
                      );
                      setBusyKey("approveReservationChange", false);
                      if (!res?.success)
                        return showNotification?.(
                          mapReservationError(res?.message),
                          "error",
                        );
                      setActiveReservation(res.data || activeReservation);
                      const latest = await findConfirmedByTableRef.current?.({
                        restaurantId,
                        tableId: table.id,
                      });
                      if (latest?.success)
                        setActiveReservation(latest.data || null);
                      onUpdated?.();
                      showNotification?.(
                        "Đã duyệt thay đổi đặt bàn.",
                        "success",
                      );
                    }}
                  >
                    Duyệt thay đổi
                  </button>
                  <button
                    className={`${s.btn} ${s.danger}`}
                    disabled={busy.rejectReservationChange}
                    onClick={async () => {
                      setBusyKey("rejectReservationChange", true);
                      const res = await rejectReservationChange(
                        activeReservation.id,
                        "Nhà hàng chưa thể đáp ứng thay đổi này.",
                      );
                      setBusyKey("rejectReservationChange", false);
                      if (!res?.success)
                        return showNotification?.(
                          mapReservationError(res?.message),
                          "error",
                        );
                      setActiveReservation(res.data || activeReservation);
                      const latest = await findConfirmedByTableRef.current?.({
                        restaurantId,
                        tableId: table.id,
                      });
                      if (latest?.success)
                        setActiveReservation(latest.data || null);
                      onUpdated?.();
                      showNotification?.(
                        "Đã từ chối thay đổi đặt bàn.",
                        "success",
                      );
                    }}
                  >
                    Từ chối thay đổi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={s.footer}>
          <button
            className={`${s.btn} ${s.danger}`}
            onClick={handleDelete}
            disabled={busy.delete || !!deleteDisabledReason}
            title={deleteDisabledReason || ""}
          >
            <IconTrash /> Xoá bàn
          </button>
          {deleteDisabledReason && (
            <div className={s.hint}>{deleteDisabledReason}</div>
          )}
          <div className={s.actions}>
            <button className={s.btn} onClick={onClose}>
              Đóng
            </button>
            <button
              className={`${s.btn} ${s.primary}`}
              onClick={handleSaveBasics}
              disabled={busy.save}
            >
              Lưu thông tin bàn
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function TableActionsModal(props) {
  return <TableActionsModalCore {...props} />;
}
export { TableActionsModalCore as TableActionsModal };
