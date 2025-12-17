import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "./TableActionsModal.module.scss";
import { usePos } from "../../../../../context/PosContext";
import useOrderManagement from "../../../../../hooks/useOrderManagement";
import { useReservation } from "../../../../../hooks/useReservation";

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

  const { changeOrderStatusByCode, updateOrderCustomerByCode } =
    useOrderManagement();
  const { findConfirmedByTable } = useReservation();

  const [orderCodeForTable, setOrderCodeForTable] = useState(null);

  // Local states
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [type, setType] = useState("standard");
  const [tags, setTags] = useState("");
  const [status, setStatusLocal] = useState("available");

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

  const [busy, setBusy] = useState({});
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
  const hydratedOrderFor = useRef(null);

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
      setUseTimeslot(true);
      setOrderCodeForTable(null);
      hydratedReservationFor.current = null;
      hydratedOrderFor.current = null;

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
    }
  }, [table, reallyOpen]);

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
          const r = res?.data ?? res?.reservation ?? res?.result ?? res ?? null;
          if (r && !cancelled) {
            const { date, time } = isoToDateTimeParts(r.timeTo);
            setCustIfChanged({
              name: r.customerName ?? r.name ?? "",
              phone: r.customerPhone ?? r.phone ?? "",
              email: r.customerEmail ?? r.email ?? "",
              guests: Number(r.partySize || 0),
              checkinDate: date || getTodayLocal(),
              checkinTime: time || "",
              note: r.note ?? "",
            });
          }
        } catch (e) {
          console.warn(e);
        } finally {
          hydratedReservationFor.current = table.id;
        }
      }

      if (hydratedOrderFor.current !== table?.code) {
        try {
          const ores = await fetchOrderByTableRef.current?.(
            restaurantId,
            table.code
          );
          const groups = Array.isArray(ores?.data) ? ores.data : [];
          const firstGroup = groups[0] || null;

          if (firstGroup && !cancelled) {
            setOrderCodeForTable(firstGroup.orderCode || null);
            const u = firstGroup.user || firstGroup.customer || null;
            if (u) {
              setCustIfChanged({
                name: u.fullName || u.name || "",
                phone: u.phone || "",
                email: u.email || "",
                guests: Number(firstGroup.partySize || 0),
              });
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
  }, [reallyOpen, restaurantId, table?.id, table?.code, table?.status]);

  const floorsSorted = useMemo(
    () => (floors || []).slice().sort((a, b) => a.level - b.level),
    [floors]
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
  const isEmail = (s) =>
    !!String(s || "")
      .toLowerCase()
      .match(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
  const isPhoneVN = (s) => /^(0|\+84)\d{9,10}$/.test(String(s || ""));
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
    return diff > 0 ? diff : null; // ❌ không cho <= 0
  };

  const clampGuests = (val) => Math.max(0, Number.isFinite(val) ? val : 0);
  const incGuests = (delta) =>
    setCust((prev) => ({
      ...prev,
      guests: clampGuests((prev.guests || 0) + delta),
    }));

  const validateCustomerForReservation = () => {
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
    const phone = (cust.phone || "").trim();
    const email = (cust.email || "").trim();
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
    if (useTimeslot) {
      if (!cust.checkinDate) {
        alert("Vui lòng chọn ngày.");
        return false;
      }
      if (!cust.checkinTime) {
        alert("Vui lòng chọn giờ.");
        return false;
      }
      if (cust.checkinDate < todayStr) {
        alert("Ngày không hợp lệ.");
        return false;
      }
      if (!cust.checkinTimeTo) {
        alert("Vui lòng chọn giờ đến.");
        return false;
      }
      const dur = calcDurationMinutes(cust.checkinTime, cust.checkinTimeTo);
      if (!dur) {
        alert("Giờ đến phải lớn hơn giờ vào.");
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
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Lỗi cập nhật.");
    } finally {
      setBusyKey("save", false);
    }
  };

  const handleChangeStatus = async (next) => {
    if (!table?.id || next === status) return;
    if (next === "available" && table?.code && restaurantId) {
      try {
        const res = await fetchOrderByTableRef.current?.(
          restaurantId,
          table.code,
          1,
          0
        );
        const activeOrder = res?.data?.[0] || null;
        if (activeOrder) {
          if (
            !window.confirm(
              `Bàn có đơn #${activeOrder.orderCode}. Hủy đơn này?`
            )
          )
            return;
          await changeOrderStatusByCode({
            restaurantId,
            orderCode: activeOrder.orderCode,
            status: "cancelled",
            note: "Cancelled via TableActionsModal",
          });
        }
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setBusyKey("status", true);
    try {
      await setTableStatus({ id: table.id, status: next });
      setStatusLocal(next);
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Lỗi trạng thái.");
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
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => fetchTableByCode(c))
          .filter(Boolean)
          .map((t) => t.id)
      )
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
    } finally {
      setBusyKey("delete", false);
    }
  };

  const saveCustomerInfo = async () => {
    if (status === "occupied" && orderCodeForTable && restaurantId) {
      const customer = {
        fullName: cust.name,
        phone: cust.phone,
        email: cust.email,
      };
      if (!customer.fullName && !customer.phone)
        return alert("Cần tên hoặc SĐT.");
      try {
        setBusyKey("saveCustomer", true);
        const res = await updateOrderCustomerByCode({
          restaurantId,
          orderCode: orderCodeForTable,
          customer,
        });
        if (res?.success) {
          alert("Đã cập nhật đơn hàng.");
          onUpdated?.();
        } else alert("Lỗi cập nhật.");
      } catch (e) {
        console.error(e);
      } finally {
        setBusyKey("saveCustomer", false);
      }
      return;
    }
    if (!onSave) return;
    if (useTimeslot && !validateCustomerForReservation()) return;

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
      await onSave(table.code, {
        ...cust,
        guests: Number(cust.guests || 0),
        checkin,
        durationMinutes,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyKey("saveCustomer", false);
    }
  };

  /* ================== RENDER ================== */
  return createPortal(
    <div className={s.backdrop} onClick={onClose}>
      {/* Ẩn mũi tên input number cho stepper */}
      <style>{`input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type=number] { -moz-appearance: textfield; }`}</style>

      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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

        {/* Body */}
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
              <span className={s.v}>{table.status}</span>
            </div>
          </div>

          <div className={s.group}>
            <div className={s.label}>Thông tin chung</div>
            <div className={s.twoCols}>
              <input
                className={s.input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Mã bàn"
              />
              <input
                className={s.input}
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                placeholder="Sức chứa"
              />
              <select
                className={s.select}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="vip">VIP</option>
                <option value="outdoor">Outdoor</option>
              </select>
              <input
                className={s.input}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags..."
              />
            </div>
            <div className={s.actionsEnd}>
              <button
                className={`${s.btn} ${s.primary}`}
                onClick={handleSaveBasics}
                disabled={busy.save}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>

          <div className={s.group}>
            <div className={s.label}>Trạng thái</div>
            <div className={s.chips}>
              {["available", "occupied", "reserved", "cleaning", "offline"].map(
                (st) => (
                  <button
                    key={st}
                    className={`${s.chip} ${status === st ? s.active : ""}`}
                    data-variant={st}
                    onClick={() => handleChangeStatus(st)}
                    disabled={busy.status}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>

          <div className={s.group}>
            <div className={s.label}>Thao tác nhanh</div>
            <div className={s.twoCols}>
              {/* Move & Swap */}
              <div>
                <div className={s.hint} style={{ marginBottom: "0.5rem" }}>
                  Chuyển tầng
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    className={s.select}
                    value={moveLevel ?? ""}
                    onChange={(e) => setMoveLevel(e.target.value)}
                  >
                    {floorsSorted.map((f) => (
                      <option key={f.id} value={f.level}>
                        Tầng {f.level}
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
                    onChange={(e) => setSwapWithCode(e.target.value)}
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
              {/* Merge & Split */}
              <div>
                <div className={s.hint} style={{ marginBottom: "0.5rem" }}>
                  Gộp bàn
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    className={s.input}
                    placeholder="A1, A2..."
                    value={mergeCodes}
                    onChange={(e) => setMergeCodes(e.target.value)}
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
          </div>

          <div className={s.group}>
            <div className={s.label}>Khách hàng & Đặt bàn</div>
            <div className={s.twoCols}>
              <input
                className={s.input}
                value={cust.name}
                onChange={(e) => setCust({ ...cust, name: e.target.value })}
                placeholder="Tên khách"
              />
              <input
                className={s.input}
                value={cust.phone}
                onChange={(e) => setCust({ ...cust, phone: e.target.value })}
                placeholder="Số điện thoại"
              />

              <div
                style={{ display: "flex", alignItems: "center", gap: "1rem" }}
              >
                <div className={s.stepper}>
                  <button className={s.btnIcon} onClick={() => incGuests(-1)}>
                    −
                  </button>
                  <input
                    className={s.inputCenter}
                    type="number"
                    value={cust.guests}
                    onChange={(e) =>
                      setCust({ ...cust, guests: Number(e.target.value) })
                    }
                  />
                  <button className={s.btnIcon} onClick={() => incGuests(1)}>
                    +
                  </button>
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.9rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useTimeslot}
                    onChange={(e) => setUseTimeslot(e.target.checked)}
                    disabled={
                      !(status === "available" || status === "reserved")
                    }
                  />{" "}
                  Đặt lịch
                </label>
              </div>

              {useTimeslot &&
                (status === "available" || status === "reserved") && (
                  <>
                    <input
                      className={s.input}
                      type="date"
                      min={todayStr}
                      value={cust.checkinDate}
                      onChange={(e) =>
                        setCust({ ...cust, checkinDate: e.target.value })
                      }
                    />
                    <select
                      className={s.select}
                      value={cust.checkinTime}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCust((prev) => ({
                          ...prev,
                          checkinTime: v,
                          // ✅ nếu giờ đến đang <= giờ vào thì reset để user chọn lại
                          checkinTimeTo: calcDurationMinutes(
                            v,
                            prev.checkinTimeTo
                          )
                            ? prev.checkinTimeTo
                            : "",
                        }));
                      }}
                    >
                      <option value="" disabled>
                        Vào lúc --:--
                      </option>
                      {(cust.checkinDate
                        ? visibleTimeSlots(cust.checkinDate)
                        : buildTimeSlots
                      ).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    <select
                      className={s.select}
                      value={cust.checkinTimeTo}
                      onChange={(e) =>
                        setCust({ ...cust, checkinTimeTo: e.target.value })
                      }
                      disabled={!cust.checkinTime}
                    >
                      <option value="" disabled>
                        Đến --:--
                      </option>
                      {(cust.checkinDate
                        ? visibleTimeSlots(cust.checkinDate)
                        : buildTimeSlots
                      )
                        // ✅ chỉ show giờ "đến" > giờ "vào"
                        .filter((t) => calcDurationMinutes(cust.checkinTime, t))
                        .map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                    </select>
                  </>
                )}
              <div style={{ gridColumn: "1/-1" }}>
                <textarea
                  className={`${s.input} ${s.textarea}`}
                  value={cust.note}
                  onChange={(e) => setCust({ ...cust, note: e.target.value })}
                  placeholder="Ghi chú..."
                />
              </div>
            </div>
            <div className={s.actionsEnd}>
              <button
                className={`${s.btn} ${s.primary}`}
                onClick={saveCustomerInfo}
                disabled={busy.saveCustomer}
              >
                Lưu thông tin khách
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={s.footer}>
          <button
            className={`${s.btn} ${s.danger}`}
            onClick={handleDelete}
            disabled={busy.delete}
          >
            <IconTrash /> Xoá bàn
          </button>
          <div className={s.actions}>
            <button className={s.btn} onClick={onClose}>
              Đóng
            </button>
            <button
              className={`${s.btn} ${s.primary}`}
              onClick={handleSaveBasics}
              disabled={busy.save}
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function TableActionsModal(props) {
  return <TableActionsModalCore {...props} />;
}
export { TableActionsModalCore as TableActionsModal };
