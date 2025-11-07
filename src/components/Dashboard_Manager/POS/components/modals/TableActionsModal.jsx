import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import s from "./TableActionsModal.module.scss";
import { usePos } from "../../../../../context/PosContext";
import useOrderManagement from "../../../../../hooks/useOrderManagement";
import { useReservation } from "../../../../../hooks/useReservation";

function TableActionsModalCore({
  open,
  isOpen,
  table,
  onClose,
  onUpdated,
  // giữ lại để tương thích cũ (không bắt buộc)
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

    // NEW: từ PosContext, đã export
    attachCustomerToOrder,
    saveTableCustomer, // local-only để đồng bộ UI
  } = usePos();

  const { changeOrderStatusByCode } = useOrderManagement();
  const { createReservationForTable } = useReservation();

  // ----- local states -----
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [type, setType] = useState("standard");
  const [tags, setTags] = useState("");
  const [status, setStatusLocal] = useState("available");

  const [moveLevel, setMoveLevel] = useState(null);
  const [swapWithCode, setSwapWithCode] = useState("");
  const [mergeCodes, setMergeCodes] = useState("");

  // thông tin khách (chỉ cho UI)
  const [cust, setCust] = useState({
    name: "",
    phone: "",
    email: "",
    guests: 0,
    checkin: "",
    note: "",
  });

  const [busy, setBusy] = useState({});
  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  // khi mở modal -> fill dữ liệu
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

      // reset form khách khi mở modal
      setCust({
        name: "",
        phone: "",
        email: "",
        guests: 0,
        checkin: "",
        note: "",
      });
    }
  }, [table, reallyOpen]);

  const floorsSorted = useMemo(
    () => (floors || []).slice().sort((a, b) => a.level - b.level),
    [floors]
  );
  const canSplit = !!table?.joinGroupId;

  // lock scroll + ESC
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

  /* ================== helpers ================== */

  const isEmail = (s) =>
    !!String(s || "")
      .toLowerCase()
      .match(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);

  const isPhoneVN = (s) => /^(0|\+84)\d{9,10}$/.test(String(s || ""));

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
      alert(
        `Số khách (${size}) vượt quá sức chứa của bàn (${table.capacity}).`
      );
      return false;
    }
    const phone = (cust.phone || "").trim();
    const email = (cust.email || "").trim();
    if (!phone && !email) {
      alert("Cần ít nhất SĐT hoặc Email của khách.");
      return false;
    }
    if (phone && !isPhoneVN(phone)) {
      alert("Số điện thoại không hợp lệ.");
      return false;
    }
    if (email && !isEmail(email)) {
      alert("Email không hợp lệ.");
      return false;
    }
    return true;
  };

  /* ================== ACTIONS ================== */

  const handleSaveBasics = async () => {
    if (!table?.id) return;
    setBusyKey("save", true);
    try {
      const patch = {
        id: table.id,
        code: code?.trim(),
        capacity: Number.isFinite(capacity) ? Number(capacity) : 0,
        type: (type || "standard").trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      await updateTable(patch);
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Cập nhật thông tin bàn thất bại.");
    } finally {
      setBusyKey("save", false);
    }
  };

  const handleChangeStatus = async (next) => {
    if (!table?.id || next === status) return;
    if (next === "available" && table?.code && restaurantId) {
      try {
        const res = await fetchOrderByTable?.(restaurantId, table.code, 1, 0);
        const activeOrder = res?.data?.[0] || null;

        if (activeOrder) {
          const ok = window.confirm(
            `Bàn ${table.code} đang có đơn #${activeOrder.orderCode}. Chuyển về Trống sẽ hủy đơn này. Bạn có chắc muốn tiếp tục?`
          );
          if (!ok) return;

          await changeOrderStatusByCode({
            restaurantId,
            orderCode: activeOrder.orderCode,
            status: "cancelled",
            note: "Cancelled via TableActionsModal when freeing table",
          });
        }
      } catch (e) {
        console.error("Check/cancel active order failed:", e);
        alert("Không thể kiểm tra/hủy đơn đang hoạt động. Vui lòng thử lại.");
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
      alert("Đổi trạng thái thất bại.");
    } finally {
      setBusyKey("status", false);
    }
  };

  const handleMove = async () => {
    if (!table?.id || moveLevel == null) return;
    const floorId = getIdFromLevel(moveLevel);
    if (!floorId) return alert("Không tìm thấy tầng đích.");
    setBusyKey("move", true);
    try {
      await moveTable({ id: table.id, floorId });
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Chuyển tầng thất bại.");
    } finally {
      setBusyKey("move", false);
    }
  };

  const handleSwap = async () => {
    const codeB = (swapWithCode || "").trim();
    if (!codeB) return;
    const b = fetchTableByCode(codeB);
    if (!b) return alert("Không tìm thấy bàn có mã: " + codeB);
    if (String(b.floorId) !== String(table.floorId)) {
      return alert("Đổi chỗ chỉ áp dụng cho 2 bàn cùng tầng.");
    }
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
      alert("Đổi chỗ (swap code) thất bại.");
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
    if (ids.length < 2) return alert("Cần ít nhất 2 bàn để gộp.");
    setBusyKey("merge", true);
    try {
      await mergeTables({ tableIds: ids, anchorId: table.id });
      onUpdated?.();
      setMergeCodes("");
    } catch (e) {
      console.error(e);
      alert("Gộp bàn thất bại.");
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
      alert("Tách bàn thất bại.");
    } finally {
      setBusyKey("split", false);
    }
  };

  const handleDelete = async () => {
    if (!table?.id) return;
    if (!window.confirm(`Xoá bàn ${table.code}?`)) return;
    setBusyKey("delete", true);
    try {
      await deleteTable(table.id);
      onUpdated?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert("Xoá bàn thất bại.");
    } finally {
      setBusyKey("delete", false);
    }
  };

  // ✅ Lưu thông tin khách
  const saveCustomerInfo = async () => {
    const customer = {
      fullName: (cust.name || "").trim(),
      phone: (cust.phone || "").trim(),
      email: (cust.email || "").trim(),
      note: cust.note || "",
    };

    try {
      // Luôn đồng bộ local để UI RightPanel/LeftPanel hiển thị tức thì
      await saveTableCustomer(table.code, {
        ...customer,
        guests: Number(cust.guests || 0),
        checkin: cust.checkin || "",
      });

      // Cho parent hook cũ nếu họ truyền (giữ tương thích)
      // await onSave?.(table.code, {
      //   ...customer,
      //   guests: Number(cust.guests || 0),
      //   checkin: cust.checkin || "",
      // });

      // --- LUỒNG CHÍNH ---
      if (status === "available") {
        // Bàn trống -> tạo reservation mới
        if (!validateCustomerForReservation()) return;

        setBusyKey("saveCustomer", true);
        const res = await createReservationForTable({
          restaurantId,
          tableId: table.id,
          customer,
          partySize: Number(cust.guests || 0),
          timeTo: cust.checkin || new Date().toISOString(),
          durationMinutes: 90,
          note: cust.note || "",
          restaurantName: "",
          maxCapacity: table.capacity,
        });
        setBusyKey("saveCustomer", false);

        if (!res?.success) {
          alert(res?.message || "Tạo đặt bàn thất bại.");
          return;
        }
        alert("Đã tạo đặt bàn và chuyển bàn sang trạng thái ĐÃ ĐẶT.");
        onUpdated?.();
        return;
      }

      if (status === "occupied" || table?.orderCode) {
        // Có khách/đang có order -> chỉ cập nhật order.user
        const r = await attachCustomerToOrder(table.code, customer);
        if (!r?.success) {
          alert(r?.message || "Cập nhật khách vào đơn thất bại.");
          return;
        }
        alert("Đã lưu thông tin khách vào đơn hiện tại.");
        onUpdated?.();
        return;
      }

      if (status === "reserved") {
        // Tránh TABLE_UNAVAILABLE do tạo mới
        alert(
          "Bàn đang ở trạng thái ĐÃ ĐẶT. Nếu khách đã tới, hãy đổi trạng thái sang CÓ KHÁCH rồi cập nhật thông tin đơn."
        );
        return;
      }

      alert("Đã lưu thông tin khách.");
    } catch (e) {
      console.error(e);
      alert("Lưu thông tin khách thất bại.");
    }
  };

  /* ================== RENDER ================== */
  return createPortal(
    <div className={s.backdrop} onClick={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={s.header}>
          <h3 className={s.title}>
            Hành động bàn <b>{table.code}</b>
          </h3>
          <button className={s.close} onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        {/* Body */}
        <div className={s.body}>
          {/* Info */}
          <div className={s.tableInfo}>
            <div className={s.kv}>
              <span className={s.k}>Mã bàn:</span>
              <span className={s.v}>{table.code}</span>
            </div>
            <div className={s.kv}>
              <span className={s.k}>Tầng:</span>
              <span className={s.v}>Tầng {table.floorLevel ?? "?"}</span>
            </div>
            <div className={s.kv}>
              <span className={s.k}>Trạng thái:</span>
              <span className={s.v}>{table.status}</span>
            </div>
          </div>

          {/* 1) Cơ bản */}
          <div className={s.group}>
            <div className={s.label}>Thông tin cơ bản</div>
            <div className={s.twoCols}>
              <div>
                <label className={s.label}>Mã bàn</label>
                <input
                  className={s.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className={s.label}>Sức chứa</label>
                <input
                  className={s.input}
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className={s.label}>Loại</label>
                <select
                  className={`${s.input} ${s.select || ""}`}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="vip">VIP</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </div>
              <div>
                <label className={s.label}>Tags (phân tách dấu phẩy)</label>
                <input
                  className={s.input}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="VIP, sân vườn…"
                />
              </div>
            </div>
            <div className={s.actionsEnd}>
              <button
                className={`${s.btn} ${s.primary}`}
                disabled={busy.save}
                onClick={handleSaveBasics}
              >
                {busy.save ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </div>

          {/* 2) Trạng thái */}
          <div className={s.group}>
            <div className={s.label}>Trạng thái</div>
            <div className={s.chips}>
              {["available", "occupied", "reserved", "cleaning", "offline"].map(
                (st) => (
                  <button
                    type="button"
                    key={st}
                    className={`${s.chip} ${status === st ? s.active : ""}`}
                    onClick={() => handleChangeStatus(st)}
                    disabled={busy.status}
                  >
                    {st === "available" && "Trống"}
                    {st === "occupied" && "Có khách"}
                    {st === "reserved" && "Đã đặt"}
                    {st === "cleaning" && "Đang dọn"}
                    {st === "offline" && "Ngưng"}
                  </button>
                )
              )}
            </div>
          </div>

          {/* 3) Chuyển tầng */}
          <div className={s.group}>
            <div className={s.label}>Chuyển tầng</div>
            <div className={s.twoCols}>
              <div>
                <label className={s.label}>Tầng đích</label>
                <select
                  className={`${s.input} ${s.select || ""}`}
                  value={moveLevel ?? ""}
                  onChange={(e) =>
                    setMoveLevel(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  {floorsSorted.map((f) => (
                    <option key={f.id} value={f.level}>
                      Tầng {f.level}
                      {f.name ? ` — ${f.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.actionsEnd} style={{ alignItems: "end" }}>
                <button
                  className={`${s.btn} ${s.ghost}`}
                  disabled={busy.move}
                  onClick={handleMove}
                >
                  {busy.move ? "Đang chuyển…" : "Chuyển"}
                </button>
              </div>
            </div>
          </div>

          {/* 4) Đổi chỗ */}
          <div className={s.group}>
            <div className={s.label}>Đổi chỗ với bàn khác (swap code)</div>
            <div className={s.twoCols}>
              <div>
                <label className={s.label}>Mã bàn muốn đổi</label>
                <input
                  className={s.input}
                  placeholder="Ví dụ: A10"
                  value={swapWithCode}
                  onChange={(e) => setSwapWithCode(e.target.value)}
                />
                <div className={s.hint}>Chỉ đổi giữa 2 bàn cùng tầng.</div>
              </div>
              <div className={s.actionsEnd} style={{ alignItems: "end" }}>
                <button
                  className={`${s.btn} ${s.ghost}`}
                  disabled={busy.swap}
                  onClick={handleSwap}
                >
                  {busy.swap ? "Đang đổi…" : "Đổi chỗ"}
                </button>
              </div>
            </div>
          </div>

          {/* 5) Gộp / Tách */}
          <div className={s.group}>
            <div className={s.label}>Gộp / Tách</div>
            <div className={s.twoCols}>
              <div>
                <label className={s.label}>
                  Gộp với các bàn (mã cách nhau bởi dấu phẩy hoặc khoảng trắng)
                </label>
                <input
                  className={s.input}
                  placeholder="Ví dụ: A2, A3"
                  value={mergeCodes}
                  onChange={(e) => setMergeCodes(e.target.value)}
                />
              </div>
              <div
                className={s.actionsEnd}
                style={{ alignItems: "end", gap: ".5rem" }}
              >
                <button
                  className={`${s.btn} ${s.ghost}`}
                  disabled={busy.merge}
                  onClick={handleMerge}
                >
                  {busy.merge ? "Đang gộp…" : "Gộp bàn"}
                </button>
                <button
                  className={`${s.btn} ${canSplit ? s.ghost : s.isDisabled}`}
                  disabled={!canSplit || busy.split}
                  onClick={handleSplitOut}
                >
                  {busy.split ? "Đang tách…" : "Tách bàn này"}
                </button>
              </div>
            </div>
          </div>

          {/* 6) Thông tin khách */}
          <div className={s.group}>
            <div className={s.label}>Thông tin khách</div>
            <div className={s.twoCols}>
              <div>
                <label className={s.label}>Tên khách</label>
                <input
                  className={s.input}
                  value={cust.name}
                  onChange={(e) => setCust({ ...cust, name: e.target.value })}
                />
              </div>
              <div>
                <label className={s.label}>Số điện thoại</label>
                <input
                  className={s.input}
                  value={cust.phone}
                  onChange={(e) => setCust({ ...cust, phone: e.target.value })}
                />
              </div>
              <div>
                <label className={s.label}>Email</label>
                <input
                  className={s.input}
                  value={cust.email}
                  onChange={(e) => setCust({ ...cust, email: e.target.value })}
                />
              </div>
              <div>
                <label className={s.label}>Số khách</label>
                <input
                  className={s.input}
                  type="number"
                  min={0}
                  value={cust.guests}
                  onChange={(e) =>
                    setCust({ ...cust, guests: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className={s.label}>Thời gian vào</label>
                <input
                  className={s.input}
                  type="datetime-local"
                  value={cust.checkin}
                  onChange={(e) =>
                    setCust({ ...cust, checkin: e.target.value })
                  }
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className={s.label}>Ghi chú</label>
                <textarea
                  className={`${s.input} ${s.textarea || ""}`}
                  rows={3}
                  value={cust.note}
                  onChange={(e) => setCust({ ...cust, note: e.target.value })}
                />
              </div>
            </div>
            <div className={s.actionsEnd}>
              <button
                className={`${s.btn} ${s.primary}`}
                onClick={saveCustomerInfo}
                disabled={busy.saveCustomer}
              >
                {busy.saveCustomer ? "Đang lưu…" : "Lưu thông tin khách"}
              </button>
            </div>
          </div>

          {/* Delete */}
          <div className={s.actionsEnd}>
            <button
              className={`${s.btn} ${s.danger}`}
              disabled={busy.delete}
              onClick={handleDelete}
            >
              {busy.delete ? "Đang xoá…" : "Xoá bàn"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={s.footer}>
          <div className={s.actions}>
            <button className={s.btn} onClick={onClose}>
              Đóng
            </button>
            <button
              className={`${s.btn} ${s.primary}`}
              onClick={handleSaveBasics}
              disabled={busy.save}
            >
              {busy.save ? "Đang lưu…" : "Lưu thay đổi"}
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
