// src/components/Table/TableActionsLiteModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export default function TableActionsLiteModal({
  open,
  table,
  onClose,
  onUpdated,
  restaurantId,

  // floors: Array<{id, level, name?}>
  floors = [],

  // actions from parent (TableManagement)
  actions = {
    updateTable: async () => {},
    setTableStatus: async () => {},
    moveTable: async () => {},
    swapTableCodes: async () => {},
    mergeTables: async () => {},
    splitTables: async () => {},
    deleteTable: async () => {},
    fetchTableByCode: () => null,
    getIdFromLevel: () => null,
  },

  // save customer back to parent (optional)
  onSaveCustomer, // (table, customer) => Promise<void> | void
}) {
  const isOpen = !!open && !!table;

  // ------- local states -------
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [type, setType] = useState("standard"); // standard | vip | outdoor
  const [tags, setTags] = useState("");
  const [status, setStatusLocal] = useState("available");
  const [vrUrl, setVrUrl] = useState("");

  const [moveLevel, setMoveLevel] = useState(null);
  const [swapWithCode, setSwapWithCode] = useState("");
  const [mergeCodes, setMergeCodes] = useState("");

  // Khách đại diện
  const [cust, setCust] = useState({
    fullName: "",
    phone: "",
    email: "",
    guests: 0,
    checkin: "",
    note: "",
  });

  const [busy, setBusy] = useState({});
  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  useEffect(() => {
    if (!isOpen) return;

    setCode(table?.code || "");
    setCapacity(Number(table?.capacity || 0));
    setType(table?.type || "standard");
    setTags(Array.isArray(table?.tags) ? table.tags.join(", ") : "");
    setStatusLocal(table?.status || "available");
    setVrUrl(table?.vrUrl || "");
    setMoveLevel(table?.floorLevel ?? null);
    setSwapWithCode("");
    setMergeCodes("");

    setCust({
      fullName: table?.customerName || table?.customer?.fullName || "",
      phone: table?.phone || table?.customer?.phone || "",
      email: table?.customer?.email || "",
      guests: table?.guestCount || 0,
      checkin: table?.checkinTime || "",
      note: table?.note || "",
    });
  }, [isOpen, table]);

  // lock scroll + ESC
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const floorsSorted = useMemo(
    () =>
      (floors || []).slice().sort((a, b) => Number(a.level) - Number(b.level)),
    [floors]
  );

  if (!isOpen) return null;

  // ================= Actions =================
  const handleSaveBasics = async () => {
    if (!table?.id) return;
    setBusyKey("save", true);
    try {
      // CHÚ Ý: type chỉ cho phép: standard | vip | outdoor (không có "indoor")
      const patch = {
        id: table.id,
        code: code?.trim(),
        capacity: Number.isFinite(capacity) ? Number(capacity) : 0,
        type: (type || "standard").trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        vrUrl: vrUrl?.trim() || null,
      };
      await actions.updateTable(patch);
      await onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Cập nhật thông tin bàn thất bại.");
    } finally {
      setBusyKey("save", false);
    }
  };

  const handleChangeStatus = async (next) => {
    if (!table?.id || next === status) return;
    setBusyKey("status", true);
    try {
      await actions.setTableStatus({ id: table.id, status: next });
      setStatusLocal(next);
      await onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Đổi trạng thái thất bại.");
    } finally {
      setBusyKey("status", false);
    }
  };

  const handleMove = async () => {
    if (!table?.id || moveLevel == null) return;
    const floorId = actions.getIdFromLevel?.(moveLevel);
    if (!floorId) return alert("Không tìm thấy tầng đích.");
    setBusyKey("move", true);
    try {
      await actions.moveTable({ id: table.id, floorId });
      await onUpdated?.();
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
    const b = actions.fetchTableByCode?.(codeB);
    if (!b) return alert("Không tìm thấy bàn có mã: " + codeB);
    if (String(b.floorId) !== String(table.floorId)) {
      return alert("Đổi chỗ chỉ áp dụng cho 2 bàn cùng tầng.");
    }
    setBusyKey("swap", true);
    try {
      await actions.swapTableCodes({
        restaurantId,
        floorId: table.floorId,
        aId: table.id,
        bId: b.id,
      });
      await onUpdated?.();
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
        [table.number, ...raw.split(/[,\s]+/)]
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => actions.fetchTableByCode?.(c))
          .filter(Boolean)
          .map((t) => t.id)
      )
    );
    if (ids.length < 2) return alert("Cần ít nhất 2 bàn để gộp.");
    setBusyKey("merge", true);
    try {
      await actions.mergeTables({ tableIds: ids, anchorId: table.id });
      await onUpdated?.();
      setMergeCodes("");
    } catch (e) {
      console.error(e);
      alert("Gộp bàn thất bại.");
    } finally {
      setBusyKey("merge", false);
    }
  };

  const handleSplitOut = async () => {
    if (!table?.joinGroupId) return;
    setBusyKey("split", true);
    try {
      await actions.splitTables({
        joinGroupId: table.joinGroupId,
        mode: "PARTIAL",
        tableIds: [table.id],
      });
      await onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Tách bàn thất bại.");
    } finally {
      setBusyKey("split", false);
    }
  };

  const handleDelete = async () => {
    if (!table?.id) return;
    if (!window.confirm(`Xoá bàn ${table.number}?`)) return;
    setBusyKey("delete", true);
    try {
      await actions.deleteTable(table.id);
      await onUpdated?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert("Xoá bàn thất bại.");
    } finally {
      setBusyKey("delete", false);
    }
  };

  // Lưu thông tin khách đại diện
  const saveCustomerInfo = async () => {
    const customer = { ...cust };
    try {
      if (typeof onSaveCustomer === "function") {
        await onSaveCustomer(table, customer);
        await onUpdated?.();
      } else {
        console.warn(
          "[TableActionsLiteModal] onSaveCustomer chưa được truyền từ parent."
        );
      }
      alert("Đã lưu thông tin khách.");
    } catch (e) {
      console.error(e);
      alert("Lưu thông tin khách thất bại.");
    }
  };

  // ================= Render =================
  return createPortal(
    <div className="talite-backdrop" onClick={onClose}>
      <div
        className="talite-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="talite-header">
          <h3 className="talite-title">
            Hành động bàn <b>{table?.code}</b>
          </h3>
          <button className="talite-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="talite-body">
          {/* Info */}
          <div className="talite-info">
            <div className="kv">
              <span className="k">Mã bàn:</span>
              <span className="v">{table?.code}</span>
            </div>
            <div className="kv">
              <span className="k">Tầng:</span>
              <span className="v">Tầng {table?.floorLevel ?? "?"}</span>
            </div>
            <div className="kv">
              <span className="k">Trạng thái:</span>
              <span className="v">{status}</span>
            </div>
          </div>

          {/* 1) Cơ bản */}
          <div className="talite-group">
            <div className="talite-label">Thông tin cơ bản</div>
            <div className="grid2">
              <div>
                <label className="talite-label">Mã bàn</label>
                <input
                  className="talite-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="talite-label">Sức chứa</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="talite-label">Loại</label>
                <select
                  className="talite-input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="vip">VIP</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </div>
              <div>
                <label className="talite-label">
                  Tags (phân tách dấu phẩy)
                </label>
                <input
                  className="talite-input"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="VIP, sân vườn…"
                />
              </div>
              <div>
                <label className="talite-label">Link VR bàn</label>
                <input
                  className="talite-input"
                  value={vrUrl}
                  onChange={(e) => setVrUrl(e.target.value)}
                  placeholder="https://..."
                />
                <div className="actions-end" style={{ marginTop: 6 }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      if (!vrUrl) return alert("Chưa có link VR.");
                      window.open(vrUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    Mở VR bàn
                  </button>
                </div>
              </div>
            </div>
            <div className="actions-end">
              <button
                className="btn primary"
                disabled={busy.save}
                onClick={handleSaveBasics}
              >
                {busy.save ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </div>

          {/* 2) Trạng thái */}
          <div className="talite-group">
            <div className="talite-label">Trạng thái</div>
            <div className="chips">
              {["available", "occupied", "reserved", "cleaning", "offline"].map(
                (st) => (
                  <button
                    type="button"
                    key={st}
                    className={`chip ${status === st ? "active" : ""}`}
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

            {/* Yêu cầu đặc biệt: nếu đang Reserved -> có nút Dọn dẹp; nếu Cleaning -> có nút Sẵn sàng */}
            <div className="actions-end" style={{ marginTop: 8 }}>
              {status === "reserved" && (
                <button
                  className="btn"
                  onClick={() => handleChangeStatus("cleaning")}
                >
                  🧹 Dọn dẹp
                </button>
              )}
              {status === "cleaning" && (
                <button
                  className="btn success"
                  onClick={() => handleChangeStatus("available")}
                >
                  ✅ Sẵn sàng
                </button>
              )}
            </div>
          </div>

          {/* 3) Chuyển tầng */}
          <div className="talite-group">
            <div className="talite-label">Chuyển tầng</div>
            <div className="grid2">
              <div>
                <label className="talite-label">Tầng đích</label>
                <select
                  className="talite-input"
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
              <div className="actions-end" style={{ alignItems: "end" }}>
                <button
                  className="btn ghost"
                  disabled={busy.move}
                  onClick={handleMove}
                >
                  {busy.move ? "Đang chuyển…" : "Chuyển"}
                </button>
              </div>
            </div>
          </div>

          {/* 4) Đổi chỗ */}
          <div className="talite-group">
            <div className="talite-label">Đổi chỗ với bàn khác (swap code)</div>
            <div className="grid2">
              <div>
                <label className="talite-label">Mã bàn muốn đổi</label>
                <input
                  className="talite-input"
                  placeholder="Ví dụ: A10"
                  value={swapWithCode}
                  onChange={(e) => setSwapWithCode(e.target.value)}
                />
                <div className="hint">Chỉ đổi giữa 2 bàn cùng tầng.</div>
              </div>
              <div className="actions-end" style={{ alignItems: "end" }}>
                <button
                  className="btn ghost"
                  disabled={busy.swap}
                  onClick={handleSwap}
                >
                  {busy.swap ? "Đang đổi…" : "Đổi chỗ"}
                </button>
              </div>
            </div>
          </div>

          {/* 5) Gộp / Tách */}
          <div className="talite-group">
            <div className="talite-label">Gộp / Tách</div>
            <div className="grid2">
              <div>
                <label className="talite-label">
                  Gộp với các bàn (mã cách nhau bởi dấu phẩy hoặc khoảng trắng)
                </label>
                <input
                  className="talite-input"
                  placeholder="Ví dụ: A2, A3"
                  value={mergeCodes}
                  onChange={(e) => setMergeCodes(e.target.value)}
                />
              </div>
              <div
                className="actions-end"
                style={{ alignItems: "end", gap: ".5rem" }}
              >
                <button
                  className="btn ghost"
                  disabled={busy.merge}
                  onClick={handleMerge}
                >
                  {busy.merge ? "Đang gộp…" : "Gộp bàn"}
                </button>
                <button
                  className={`btn ${table?.joinGroupId ? "ghost" : "disabled"}`}
                  disabled={!table?.joinGroupId || busy.split}
                  onClick={handleSplitOut}
                >
                  {busy.split ? "Đang tách…" : "Tách bàn này"}
                </button>
              </div>
            </div>
          </div>

          {/* 6) Khách đại diện */}
          <div className="talite-group">
            <div className="talite-label">Khách đại diện</div>
            <div className="grid2">
              <div>
                <label className="talite-label">Họ tên</label>
                <input
                  className="talite-input"
                  value={cust.fullName}
                  onChange={(e) =>
                    setCust({ ...cust, fullName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="talite-label">Số điện thoại</label>
                <input
                  className="talite-input"
                  value={cust.phone}
                  onChange={(e) => setCust({ ...cust, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="talite-label">Email</label>
                <input
                  className="talite-input"
                  value={cust.email}
                  onChange={(e) => setCust({ ...cust, email: e.target.value })}
                />
              </div>
              <div>
                <label className="talite-label">Số khách</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={cust.guests}
                  onChange={(e) =>
                    setCust({ ...cust, guests: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="talite-label">Giờ vào</label>
                <input
                  className="talite-input"
                  type="datetime-local"
                  value={cust.checkin}
                  onChange={(e) =>
                    setCust({ ...cust, checkin: e.target.value })
                  }
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="talite-label">Ghi chú</label>
                <textarea
                  className="talite-input"
                  rows={3}
                  value={cust.note}
                  onChange={(e) => setCust({ ...cust, note: e.target.value })}
                />
              </div>
            </div>
            <div className="actions-end">
              <button className="btn primary" onClick={saveCustomerInfo}>
                Lưu thông tin khách
              </button>
            </div>
          </div>

          {/* Delete */}
          <div className="actions-end">
            <button
              className="btn danger"
              disabled={busy.delete}
              onClick={handleDelete}
            >
              {busy.delete ? "Đang xoá…" : "Xoá bàn"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="talite-footer">
          <div className="actions">
            <button className="btn" onClick={onClose}>
              Đóng
            </button>
            <button
              className="btn primary"
              onClick={handleSaveBasics}
              disabled={busy.save}
            >
              {busy.save ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>

      {/* Style (không dùng jsx attr để tránh warning) */}
      <style>
        {`
        .talite-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
        .talite-modal{width:min(960px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(2,6,23,.35)}
        .talite-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e8f0}
        .talite-title{font-size:18px;font-weight:700;color:#0f172a;margin:0}
        .talite-close{border:none;background:transparent;font-size:28px;line-height:1;cursor:pointer}
        .talite-body{padding:12px 16px 4px}
        .talite-footer{padding:12px 16px;border-top:1px solid #e2e8f0}
        .talite-info{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px}
        .kv{display:flex;gap:6px}
        .k{color:#64748b}
        .v{color:#0f172a;font-weight:600}
        .talite-group{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:10px 0}
        .talite-label{font-weight:600;margin-bottom:6px;color:#0f172a}
        .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .talite-input{width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:14px;outline:none}
        .talite-input:focus{border-color:#b89365;box-shadow:0 0 0 3px rgba(184,147,101,.2)}
        .actions-end{display:flex;justify-content:flex-end;gap:8px}
        .btn{border:1px solid #cbd5e1;background:#fff;padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer}
        .btn.primary{background:#b89365;border-color:#b89365;color:#fff}
        .btn.success{background:#10b981;border-color:#10b981;color:#fff}
        .btn.ghost{background:#fff}
        .btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}
        .btn.disabled{opacity:.5;pointer-events:none}
        .chips{display:flex;flex-wrap:wrap;gap:8px}
        .chip{border:1px solid #e2e8f0;border-radius:999px;padding:6px 10px;background:#fff;cursor:pointer}
        .chip.active{border-color:#b89365;box-shadow:0 0 0 3px rgba(184,147,101,.2)}
        .hint{font-size:12px;color:#64748b;margin-top:4px}
        @media (max-width:680px){.grid2{grid-template-columns:1fr}}
        `}
      </style>
    </div>,
    document.body
  );
}
