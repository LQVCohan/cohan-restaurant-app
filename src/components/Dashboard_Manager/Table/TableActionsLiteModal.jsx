// src/components/Table/TableActionsLiteModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadTableVrImage,
  removeTableVrImage,
  storeTableVrImage,
} from "@/utils/vrStorage";
import { usePromotions } from "@/hooks/usePromotions";

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

}) {
  const isOpen = !!open && !!table;

  // ------- local states -------
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [type, setType] = useState("standard"); // standard | vip | outdoor
  const [tags, setTags] = useState("");
  const [status, setStatusLocal] = useState("available");
  const [vrUrl, setVrUrl] = useState("");
  const [vrUploadStatus, setVrUploadStatus] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedPromotions, setSelectedPromotions] = useState([]);
  const [quickPerk, setQuickPerk] = useState("");
  const [manualPerks, setManualPerks] = useState([]);
  const [zoneLabel, setZoneLabel] = useState("");
  const [posX, setPosX] = useState("");
  const [posY, setPosY] = useState("");
  const [holdMinutes, setHoldMinutes] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [cancelPolicy, setCancelPolicy] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState({
    merge: null,
    promo: null,
    turnover: null,
  });
  const [aiLoading, setAiLoading] = useState({
    merge: false,
    promo: false,
    turnover: false,
  });

  const [moveLevel, setMoveLevel] = useState(null);
  const [swapWithCode, setSwapWithCode] = useState("");
  const [mergeCodes, setMergeCodes] = useState("");

  const [busy, setBusy] = useState({});
  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  const { allPromotions } = usePromotions();
  const areaLabelMap = {
    standard: "Trong nhà",
    vip: "VIP",
    outdoor: "Ngoài trời",
  };
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:4000/graphql").replace(
    /\/graphql$/i,
    ""
  );

  useEffect(() => {
    if (!isOpen) return;

    setCode(table?.code || "");
    setCapacity(Number(table?.capacity || 0));
    setType(table?.type || "standard");
    setTags(Array.isArray(table?.tags) ? table.tags.join(", ") : "");
    setStatusLocal(table?.status || "available");
    const storedImage = loadTableVrImage(table?.id);
    const fallbackVrUrl =
      !table?.vrUrl && storedImage ? `/vr/table/${table?.id}` : "";
    setVrUrl(table?.vrUrl || fallbackVrUrl);
    setVrUploadStatus("");
    setMoveLevel(table?.floorLevel ?? null);
    setSwapWithCode("");
    setMergeCodes("");
    setDepositAmount(
      table?.depositAmount ??
        table?.bookingDeposit ??
        table?.reservationDeposit ??
        ""
    );
    setSelectedPromotions(
      Array.isArray(table?.promotionIds) ? table.promotionIds : []
    );
    setManualPerks(
      Array.isArray(table?.bookingPerks) ? table.bookingPerks : []
    );
    setZoneLabel(table?.zone || table?.areaLabel || "");
    setPosX(
      table?.position?.x != null ? String(Math.round(table.position.x)) : ""
    );
    setPosY(
      table?.position?.y != null ? String(Math.round(table.position.y)) : ""
    );
    setHoldMinutes(
      table?.reservationHoldMinutes ?? table?.holdMinutes ?? ""
    );
    setMinSpend(table?.minSpend ?? table?.minOrderValue ?? "");
    setCancelPolicy(table?.cancelPolicy ?? table?.bookingPolicy ?? "");
    setAiSuggestions({ merge: null, promo: null, turnover: null });
    setQuickPerk("");
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

  const hasStoredImage = !!loadTableVrImage(table?.id);

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
        depositAmount:
          depositAmount === "" ? null : Number.parseFloat(depositAmount),
        promotionIds: selectedPromotions,
        bookingPerks: manualPerks,
        zone: zoneLabel?.trim() || null,
        position:
          posX === "" && posY === ""
            ? table?.position
            : {
                x: posX === "" ? 0 : Number.parseFloat(posX),
                y: posY === "" ? 0 : Number.parseFloat(posY),
              },
        reservationHoldMinutes:
          holdMinutes === "" ? null : Number.parseInt(holdMinutes, 10),
        minSpend: minSpend === "" ? null : Number.parseFloat(minSpend),
        cancelPolicy: cancelPolicy?.trim() || null,
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

  const handleVrFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file || !table?.id) return;
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh 360.");
      return;
    }
    const maxSizeMb = 4;
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn ${maxSizeMb}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      const stored = storeTableVrImage(table.id, dataUrl);
      if (!stored) {
        alert("Không thể lưu ảnh 360. Vui lòng thử ảnh nhỏ hơn.");
        return;
      }
      setVrUrl(`/vr/table/${table.id}`);
      setVrUploadStatus("Đã lưu ảnh 360 vào Local Storage.");
    };
    reader.onerror = () => {
      alert("Không thể đọc file ảnh.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveVrImage = () => {
    if (!table?.id) return;
    removeTableVrImage(table.id);
    setVrUploadStatus("Đã xoá ảnh 360 khỏi Local Storage.");
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

  const togglePromotion = (promoId) => {
    setSelectedPromotions((prev) =>
      prev.includes(promoId)
        ? prev.filter((id) => id !== promoId)
        : [...prev, promoId]
    );
  };

  const handleAddQuickPerk = () => {
    const cleaned = quickPerk.trim();
    if (!cleaned) return;
    setManualPerks((prev) =>
      prev.includes(cleaned) ? prev : [...prev, cleaned]
    );
    setQuickPerk("");
  };

  const removePerk = (perk) => {
    setManualPerks((prev) => prev.filter((item) => item !== perk));
  };


  const buildAiPayload = () => ({
    table: {
      id: table?.id,
      code: code?.trim(),
      capacity,
      status,
      type,
      floorLevel: table?.floorLevel,
      floorId: table?.floorId,
      zone: zoneLabel,
      position:
        posX !== "" && posY !== ""
          ? { x: Number.parseFloat(posX), y: Number.parseFloat(posY) }
          : table?.position,
      depositAmount:
        depositAmount === "" ? null : Number.parseFloat(depositAmount),
      holdMinutes:
        holdMinutes === "" ? null : Number.parseInt(holdMinutes, 10),
      minSpend: minSpend === "" ? null : Number.parseFloat(minSpend),
      cancelPolicy,
      usageCount: table?.usageCount,
    },
    promotions: (allPromotions || []).map((promo) => ({
      id: promo.id,
      name: promo.name,
      code: promo.code,
      level: promo.level,
      usageCount: promo.usageCount,
    })),
    history:
      table?.usageHistory || table?.history || table?.reservationHistory || [],
    tables: table?.tables || table?.nearbyTables || [],
  });

  const callAiEndpoint = async (path, key, fallback) => {
    setAiLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAiPayload()),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      const suggestion = data?.suggestion || fallback.detail;
      setAiSuggestions((prev) => ({
        ...prev,
        [key]: { ...fallback, detail: suggestion },
      }));
    } catch (error) {
      console.error(error);
      setAiSuggestions((prev) => ({ ...prev, [key]: fallback }));
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSuggestMergeAI = () => {
    const seatTarget = Math.max(4, capacity || 0) + 2;
    callAiEndpoint("/api/ai/table/merge-suggestion", "merge", {
      title: "Đề xuất ghép bàn",
      detail: `Ưu tiên ghép bàn gần kề để đạt ${seatTarget} chỗ. Gợi ý: chọn 1-2 bàn trống cùng tầng.`,
    });
  };

  const handleSuggestPromoAI = () => {
    callAiEndpoint("/api/ai/table/promo-suggestion", "promo", {
      title: "Đề xuất ưu đãi",
      detail:
        allPromotions?.length > 0
          ? `Ưu tiên gắn: ${allPromotions
              .slice(0, 2)
              .map((promo) => promo.name || promo.code)
              .join(", ")}`
          : "Chưa có promotion, nên dùng ưu đãi nhanh như tặng nước / tráng miệng.",
    });
  };

  const handlePredictTurnoverAI = () => {
    const base = status === "occupied" ? 60 : status === "reserved" ? 30 : 10;
    callAiEndpoint("/api/ai/table/turnover-prediction", "turnover", {
      title: "AI dự đoán bàn trống",
      detail: `Ước lượng ${base}–${base + 20} phút để bàn trống (phụ thuộc số khách và món).`,
    });
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
          <div>
            <h3 className="talite-title">
              Cấu hình bàn ăn <b>{table?.code}</b>
            </h3>
            <p className="talite-subtitle">
              Thiết lập thông tin, VR và ưu đãi đi kèm cho bàn.
            </p>
          </div>
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
              <span className="k">Sức chứa:</span>
              <span className="v">{table?.capacity ?? 0} chỗ</span>
            </div>
            <div className="kv">
              <span className="k">Loại:</span>
              <span className="v">{table?.type || "standard"}</span>
            </div>
            <div className="kv">
              <span className="k">Khu vực:</span>
              <span className="v">
                {areaLabelMap[table?.type] || table?.type || "Chưa rõ"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Trạng thái:</span>
              <span className="v">{status}</span>
            </div>
            {zoneLabel && (
              <div className="kv">
                <span className="k">Khu:</span>
                <span className="v">{zoneLabel}</span>
              </div>
            )}
            {posX !== "" && posY !== "" && (
              <div className="kv">
                <span className="k">Vị trí:</span>
                <span className="v">
                  X{posX} · Y{posY}
                </span>
              </div>
            )}
          </div>

          {/* 1) Cơ bản */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">📌</span>
              <div>
                <div className="talite-label">Thông tin cơ bản</div>
                <div className="talite-group-sub">
                  Quản lý mã bàn, sức chứa, khu vực và VR.
                </div>
              </div>
            </div>
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
                <label className="talite-label">Khu vực (zone)</label>
                <input
                  className="talite-input"
                  value={zoneLabel}
                  onChange={(e) => setZoneLabel(e.target.value)}
                  placeholder="VD: Sảnh chính, Sân vườn"
                />
              </div>
              <div>
                <label className="talite-label">Vị trí X</label>
                <input
                  className="talite-input"
                  type="number"
                  value={posX}
                  onChange={(e) => setPosX(e.target.value)}
                  placeholder="VD: 120"
                />
              </div>
              <div>
                <label className="talite-label">Vị trí Y</label>
                <input
                  className="talite-input"
                  type="number"
                  value={posY}
                  onChange={(e) => setPosY(e.target.value)}
                  placeholder="VD: 80"
                />
              </div>
              <div className="talite-vr-block">
                <div className="talite-vr-header">
                  <div>
                    <div className="talite-vr-title">Cấu hình VR bàn</div>
                    <div className="talite-vr-sub">
                      Gắn link VR hoặc tải ảnh 360° để xem không gian bàn.
                    </div>
                  </div>
                  <span className="talite-vr-badge">VR 360°</span>
                </div>
                <div className="talite-vr-field">
                  <label className="talite-label">Link VR bàn</label>
                  <input
                    className="talite-input"
                    value={vrUrl}
                    onChange={(e) => setVrUrl(e.target.value)}
                    placeholder="https://... hoặc /vr/table/123"
                  />
                </div>
                <div className="talite-upload">
                  <label className="talite-label">Tải ảnh 360°</label>
                  <input
                    className="talite-input"
                    type="file"
                    accept="image/*"
                    onChange={handleVrFileChange}
                  />
                  <div className="hint">
                    Ảnh 360 được lưu ở Local Storage (máy hiện tại). Nên dùng
                    ảnh nhỏ hơn 4MB để tránh đầy bộ nhớ trình duyệt.
                  </div>
                  {vrUploadStatus && (
                    <div className="hint">{vrUploadStatus}</div>
                  )}
                  {hasStoredImage && (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={handleRemoveVrImage}
                    >
                      Xoá ảnh 360 đã lưu
                    </button>
                  )}
                </div>
                <div className="talite-vr-actions">
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
            <div className="talite-group-header">
              <span className="talite-group-icon">🟢</span>
              <div>
                <div className="talite-label">Trạng thái</div>
                <div className="talite-group-sub">
                  Cập nhật nhanh trạng thái vận hành của bàn.
                </div>
              </div>
            </div>
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
            <div className="talite-group-header">
              <span className="talite-group-icon">🏢</span>
              <div>
                <div className="talite-label">Chuyển tầng</div>
                <div className="talite-group-sub">
                  Di chuyển bàn đến tầng mới khi cần bố trí lại.
                </div>
              </div>
            </div>
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
            <div className="talite-group-header">
              <span className="talite-group-icon">🔁</span>
              <div>
                <div className="talite-label">
                  Đổi chỗ với bàn khác (swap code)
                </div>
                <div className="talite-group-sub">
                  Hoán đổi mã bàn trong cùng tầng để tối ưu sơ đồ.
                </div>
              </div>
            </div>
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
            <div className="talite-group-header">
              <span className="talite-group-icon">🧩</span>
              <div>
                <div className="talite-label">Gộp / Tách</div>
                <div className="talite-group-sub">
                  Kết hợp bàn phục vụ nhóm lớn hoặc tách lại khi kết thúc.
                </div>
              </div>
            </div>
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

          {/* 6) Đặt cọc & Ưu đãi */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🎁</span>
              <div>
                <div className="talite-label">Đặt cọc & Ưu đãi khi đặt bàn</div>
                <div className="talite-group-sub">
                  Gắn ưu đãi để hiển thị khi khách đặt bàn.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">Giá đặt cọc (VND)</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="VD: 200000"
                />
                <div className="hint">
                  Giá đặt cọc sẽ hiển thị khi khách đặt bàn.
                </div>
              </div>
              <div className="talite-promo-box">
                <div className="talite-label">Ưu đãi từ Promotion</div>
                {allPromotions?.length ? (
                  <div className="talite-promo-list">
                    {allPromotions.map((promo) => (
                      <label key={promo.id} className="talite-check">
                        <input
                          type="checkbox"
                          checked={selectedPromotions.includes(promo.id)}
                          onChange={() => togglePromotion(promo.id)}
                        />
                        <span>
                          {promo.name || promo.code || "Ưu đãi chưa đặt tên"}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="hint">Chưa có ưu đãi từ Promotion.</div>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="talite-label">
                  Tiện ích / ưu đãi nhanh (nhập tay)
                </label>
                <div className="talite-quick">
                  <input
                    className="talite-input"
                    value={quickPerk}
                    onChange={(e) => setQuickPerk(e.target.value)}
                    placeholder="VD: Tặng ly nước, free tráng miệng..."
                  />
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={handleAddQuickPerk}
                  >
                    Thêm
                  </button>
                </div>
                {manualPerks.length ? (
                  <div className="talite-perk-tags">
                    {manualPerks.map((perk) => (
                      <span key={perk} className="talite-perk">
                        {perk}
                        <button
                          type="button"
                          onClick={() => removePerk(perk)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="hint">Chưa có tiện ích/ưu đãi nhanh.</div>
                )}
              </div>
            </div>
          </div>

          {/* 7) Chính sách đặt bàn */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">📝</span>
              <div>
                <div className="talite-label">Chính sách đặt bàn</div>
                <div className="talite-group-sub">
                  Thiết lập thời lượng giữ bàn và điều kiện tối thiểu.
                </div>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="talite-label">Giữ bàn (phút)</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={holdMinutes}
                  onChange={(e) => setHoldMinutes(e.target.value)}
                  placeholder="VD: 15"
                />
              </div>
              <div>
                <label className="talite-label">Chi tiêu tối thiểu</label>
                <input
                  className="talite-input"
                  type="number"
                  min={0}
                  value={minSpend}
                  onChange={(e) => setMinSpend(e.target.value)}
                  placeholder="VD: 500000"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="talite-label">Chính sách huỷ</label>
                <textarea
                  className="talite-input"
                  rows={3}
                  value={cancelPolicy}
                  onChange={(e) => setCancelPolicy(e.target.value)}
                  placeholder="VD: Hủy trước 2 giờ để hoàn cọc..."
                />
              </div>
            </div>
          </div>

          {/* 8) AI gợi ý */}
          <div className="talite-group">
            <div className="talite-group-header">
              <span className="talite-group-icon">🤖</span>
              <div>
                <div className="talite-label">Gợi ý AI cho bàn ăn</div>
                <div className="talite-group-sub">
                  Tạo gợi ý nhanh để tối ưu ghép bàn, ưu đãi và thời gian trống.
                </div>
              </div>
            </div>
            <div className="talite-ai-grid">
              <button
                className="btn ghost"
                onClick={handleSuggestMergeAI}
                disabled={aiLoading.merge}
              >
                {aiLoading.merge ? "Đang gợi ý..." : "Đề xuất ghép bàn"}
              </button>
              <button
                className="btn ghost"
                onClick={handleSuggestPromoAI}
                disabled={aiLoading.promo}
              >
                {aiLoading.promo ? "Đang gợi ý..." : "Đề xuất ưu đãi"}
              </button>
              <button
                className="btn ghost"
                onClick={handlePredictTurnoverAI}
                disabled={aiLoading.turnover}
              >
                {aiLoading.turnover
                  ? "Đang dự đoán..."
                  : "AI dự đoán bàn trống & thời gian quay vòng"}
              </button>
            </div>
            <div className="talite-ai-results">
              {aiSuggestions.merge && (
                <div className="talite-ai-card">
                  <strong>{aiSuggestions.merge.title}</strong>
                  <p>{aiSuggestions.merge.detail}</p>
                </div>
              )}
              {aiSuggestions.promo && (
                <div className="talite-ai-card">
                  <strong>{aiSuggestions.promo.title}</strong>
                  <p>{aiSuggestions.promo.detail}</p>
                </div>
              )}
              {aiSuggestions.turnover && (
                <div className="talite-ai-card">
                  <strong>{aiSuggestions.turnover.title}</strong>
                  <p>{aiSuggestions.turnover.detail}</p>
                </div>
              )}
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
        .talite-subtitle{margin:4px 0 0;font-size:12px;color:#64748b}
        .talite-close{border:none;background:transparent;font-size:28px;line-height:1;cursor:pointer}
        .talite-body{padding:12px 16px 4px}
        .talite-footer{padding:12px 16px;border-top:1px solid #e2e8f0}
        .talite-info{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px}
        .kv{display:flex;gap:6px}
        .k{color:#64748b}
        .v{color:#0f172a;font-weight:600}
        .talite-group{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:10px 0}
        .talite-label{font-weight:600;margin-bottom:6px;color:#0f172a}
        .talite-group-header{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
        .talite-group-icon{width:28px;height:28px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;display:inline-flex;align-items:center;justify-content:center}
        .talite-group-sub{font-size:12px;color:#94a3b8}
        .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .talite-input{width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:14px;outline:none}
        .talite-input:focus{border-color:#b89365;box-shadow:0 0 0 3px rgba(184,147,101,.2)}
        .talite-vr-block{grid-column:1/-1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}
        .talite-vr-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .talite-vr-title{font-weight:700;color:#0f172a}
        .talite-vr-sub{font-size:12px;color:#64748b}
        .talite-vr-badge{background:#fff;border:1px solid #b89365;color:#b89365;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}
        .talite-upload{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px dashed #e2e8f0;border-radius:10px;padding:10px}
        .talite-vr-actions{display:flex;justify-content:flex-end}
        .talite-promo-box{grid-column:1/-1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}
        .talite-promo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .talite-check{display:flex;align-items:center;gap:8px;font-size:13px;color:#0f172a}
        .talite-quick{display:flex;gap:8px;align-items:center}
        .talite-perk-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
        .talite-perk{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:12px}
        .talite-perk button{border:none;background:transparent;cursor:pointer;font-weight:700}
        .talite-ai-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
        .talite-ai-results{display:grid;gap:10px;margin-top:12px}
        .talite-ai-card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc}
        .talite-ai-card p{margin:6px 0 0;font-size:12px;color:#64748b}
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
        @media (max-width:680px){.grid2{grid-template-columns:1fr}.talite-promo-list{grid-template-columns:1fr}.talite-quick{flex-direction:column;align-items:stretch}}
        `}
      </style>
    </div>,
    document.body
  );
}
