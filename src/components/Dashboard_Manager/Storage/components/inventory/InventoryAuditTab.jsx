import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  AlertCircle,
  ArrowDownUp,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  History,
  Search,
} from "lucide-react";
import {
  CLOSE_INVENTORY_COUNT,
  CREATE_INVENTORY_COUNT,
  INVENTORY_COUNTS_QUERY,
  INVENTORY_DOCUMENT_MOVEMENTS_QUERY,
  RECONCILE_STOCK_MOVEMENT_DOCUMENT,
  UPDATE_INVENTORY_COUNT_LINE,
} from "../../graphql/inventoryAudit.gql";
import "./InventoryAuditTab.scss";

const PAGE_SIZE = 10;

const movementLabel = {
  inbound: "Nhập",
  outbound: "Xuất",
  adjustment: "Điều chỉnh",
  transfer: "Chuyển kho",
};

const documentStatusLabel = {
  pending: "Chờ đối chiếu",
  matched: "Khớp chứng từ",
  mismatch: "Lệch chứng từ",
  missing: "Thiếu chứng từ",
};

const countStatusLabel = {
  draft: "Đang kiểm",
  closed: "Đã chốt",
  cancelled: "Đã hủy",
};

const hasCountedQty = (value) =>
  value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

const formatQty = (value) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN").format(date);
};

const todayInput = () => new Date().toISOString().slice(0, 10);
const monthStartInput = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

function InventoryAuditTab({
  restaurantId,
  warehouseId,
  ingredients = [],
  stockItems = [],
  movements = [],
  warehouses = [],
  loading = false,
  error = null,
  onReload,
}) {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);
  const [countTitle, setCountTitle] = useState("Kiểm kê cuối kỳ");
  const [periodStart, setPeriodStart] = useState(monthStartInput());
  const [periodEnd, setPeriodEnd] = useState(todayInput());
  const [activeCountId, setActiveCountId] = useState("");
  const [draftLines, setDraftLines] = useState({});
  const [documentDrafts, setDocumentDrafts] = useState({});
  const [feedback, setFeedback] = useState("");

  const ingredientMap = useMemo(() => {
    const m = new Map();
    ingredients.forEach((it) => m.set(it.id, it));
    return m;
  }, [ingredients]);
  const warehouseMap = useMemo(() => {
    const m = new Map();
    warehouses.forEach((w) => m.set(String(w.id), w.name || w.id));
    return m;
  }, [warehouses]);

  const canUseCount = Boolean(restaurantId && warehouseId);

  const {
    data: countData,
    loading: countsLoading,
    error: countsError,
    refetch: refetchCounts,
  } = useQuery(INVENTORY_COUNTS_QUERY, {
    variables: { restaurantId, warehouseId, limit: 8 },
    skip: !canUseCount,
    fetchPolicy: "cache-and-network",
  });

  const {
    data: documentData,
    loading: documentsLoading,
    error: documentsError,
    refetch: refetchDocuments,
  } = useQuery(INVENTORY_DOCUMENT_MOVEMENTS_QUERY, {
    variables: { restaurantId, warehouseId, limit: 50 },
    skip: !canUseCount,
    fetchPolicy: "cache-and-network",
  });

  const [createCount, { loading: creatingCount }] = useMutation(CREATE_INVENTORY_COUNT);
  const [updateCountLine, { loading: updatingLine }] = useMutation(UPDATE_INVENTORY_COUNT_LINE);
  const [closeCount, { loading: closingCount }] = useMutation(CLOSE_INVENTORY_COUNT);
  const [reconcileDocument, { loading: reconcilingDocument }] = useMutation(
    RECONCILE_STOCK_MOVEMENT_DOCUMENT,
  );

  const counts = countData?.inventoryCounts || [];
  const activeCount =
    counts.find((count) => count.id === activeCountId) || counts[0] || null;
  const documentMovements = documentData?.inventoryDocumentMovements || movements;

  const rows = useMemo(() => {
    const agg = new Map();

    for (const s of stockItems) {
      const key = s.ingredientId;
      if (!key) continue;
      const current = agg.get(key) || {
        ingredientId: key,
        onHand: 0,
        reserved: 0,
        available: 0,
        warehouseCount: 0,
      };

      const onHand = Number(s.onHand) || 0;
      const reserved = Number(s.reserved) || 0;

      current.onHand += onHand;
      current.reserved += reserved;
      current.available += onHand - reserved;
      current.warehouseCount += 1;

      agg.set(key, current);
    }

    const q = search.trim().toLowerCase();

    let list = Array.from(agg.values()).map((it) => {
      const ing = ingredientMap.get(it.ingredientId);
      const minStock = Number(ing?.minStock) || 0;
      let status = "ok";
      if (it.available <= 0) status = "out";
      else if (it.available <= minStock) status = "low";

      return {
        ...it,
        name: ing?.name || "(Không xác định)",
        sku: ing?.sku || "",
        unit: ing?.baseUnit || "",
        minStock,
        status,
      };
    });

    if (q) {
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          String(it.ingredientId).toLowerCase().includes(q),
      );
    }

    if (stockFilter !== "all") {
      list = list.filter((it) => it.status === stockFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "available") return b.available - a.available;
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return a.name.localeCompare(b.name, "vi");
    });

    return list;
  }, [ingredientMap, search, stockFilter, sortBy, stockItems]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const movementRows = useMemo(() => {
    return movements
      .map((mv) => {
        const ing = ingredientMap.get(mv.ingredientId);
        const unit = ing?.baseUnit || "";
        const cost = Number(mv?.meta?.costPerBaseUnit);
        const totalValue =
          Number(mv?.meta?.totalValue) ||
          ((Number(mv.qty) || 0) * (Number.isFinite(cost) ? cost : 0));
        return {
          ...mv,
          ingredientName: ing?.name || mv.ingredientId,
          unit,
          warehouseName: warehouseMap.get(String(mv.warehouseId)) || mv.warehouseId,
          toWarehouseName:
            warehouseMap.get(String(mv?.meta?.toWarehouseId)) ||
            mv?.meta?.toWarehouseId,
          fromWarehouseName:
            warehouseMap.get(String(mv?.meta?.fromWarehouseId)) ||
            mv?.meta?.fromWarehouseId,
          cost: Number.isFinite(cost) ? cost : null,
          totalValue: Number.isFinite(totalValue) ? totalValue : null,
        };
      })
      .slice(0, 30);
  }, [ingredientMap, movements, warehouseMap]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, it) => {
        acc.total += 1;
        if (it.status === "low") acc.low += 1;
        if (it.status === "out") acc.out += 1;
        return acc;
      },
      { total: 0, low: 0, out: 0 },
    );
  }, [rows]);

  const countSummary = useMemo(() => {
    const lines = activeCount?.lines || [];
    return lines.reduce(
      (acc, line) => {
        acc.total += 1;
        if (hasCountedQty(line.countedQty)) acc.counted += 1;
        const variance = Number(line.variance || 0);
        if (variance !== 0) {
          acc.varianceLines += 1;
          acc.netVariance += variance;
        }
        return acc;
      },
      { total: 0, counted: 0, varianceLines: 0, netVariance: 0 },
    );
  }, [activeCount]);

  const refreshAudit = async () => {
    await Promise.allSettled([refetchCounts?.(), refetchDocuments?.(), onReload?.()]);
  };

  const handleCreateCount = async () => {
    if (!canUseCount) {
      setFeedback("Vui lòng chọn một kho cụ thể trước khi tạo kỳ kiểm kê.");
      return;
    }
    setFeedback("");
    const { data } = await createCount({
      variables: {
        input: {
          restaurantId,
          warehouseId,
          title: countTitle || "Kiểm kê cuối kỳ",
          periodStart,
          periodEnd,
        },
      },
    });
    const next = data?.createInventoryCount;
    if (next?.id) setActiveCountId(next.id);
    await refreshAudit();
    setFeedback(`Đã tạo kỳ ${next?.code || "kiểm kê"}.`);
  };

  const lineDraft = (line) => {
    const key = String(line.ingredientId);
    return draftLines[key] || {
      countedQty: line.countedQty ?? "",
      note: line.note || "",
    };
  };

  const setLineDraft = (line, patch) => {
    const key = String(line.ingredientId);
    setDraftLines((prev) => ({
      ...prev,
      [key]: { ...lineDraft(line), ...patch },
    }));
  };

  const handleSaveLine = async (line) => {
    const draft = lineDraft(line);
    setFeedback("");
    await updateCountLine({
      variables: {
        input: {
          countId: activeCount.id,
          ingredientId: line.ingredientId,
          countedQty: Number(draft.countedQty),
          note: draft.note || null,
        },
      },
    });
    await refetchCounts?.();
    setFeedback("Đã lưu số kiểm đếm.");
  };

  const handleCloseCount = async () => {
    if (!activeCount) return;
    if (countSummary.counted < countSummary.total) {
      setFeedback("Cần nhập đủ số lượng thực tế trước khi chốt kỳ.");
      return;
    }
    if (!window.confirm(`Chốt kỳ ${activeCount.code}? Hệ thống sẽ tạo bút toán điều chỉnh tồn kho.`)) {
      return;
    }
    setFeedback("");
    await closeCount({ variables: { input: { countId: activeCount.id } } });
    await refreshAudit();
    setFeedback(`Đã chốt kỳ ${activeCount.code}.`);
  };

  const documentDraft = (movement) => {
    const key = String(movement.id);
    return documentDrafts[key] || {
      documentNo: movement?.meta?.documentNo || "",
      status: movement?.meta?.documentStatus || "pending",
      note: movement?.meta?.documentNote || "",
    };
  };

  const setDocumentDraft = (movement, patch) => {
    const key = String(movement.id);
    setDocumentDrafts((prev) => ({
      ...prev,
      [key]: { ...documentDraft(movement), ...patch },
    }));
  };

  const handleSaveDocument = async (movement) => {
    const draft = documentDraft(movement);
    setFeedback("");
    await reconcileDocument({
      variables: {
        input: {
          movementId: movement.id,
          documentNo: draft.documentNo || null,
          status: draft.status,
          note: draft.note || null,
        },
      },
    });
    await refetchDocuments?.();
    setFeedback("Đã lưu đối chiếu chứng từ.");
  };

  if (loading) {
    return (
      <div className="inventory-audit-tab" aria-label="Đang tải kiểm kê">
        <div className="inv-summary-grid inv-summary-grid--skeleton">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="inv-summary-card inv-skeleton" key={index} aria-hidden="true" />
          ))}
        </div>
        <div className="inv-skeleton inv-skeleton--toolbar" aria-hidden="true" />
        <div className="inv-table-wrap inv-skeleton-table" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="inv-state inv-state--error">
        <AlertCircle size={18} /> Không tải được kiểm kê: {error.message}
      </div>
    );
  }

  return (
    <div className="inventory-audit-tab">
      <div className="inv-summary-grid">
        <div className="inv-summary-card">
          <Boxes size={16} /> Tổng mặt hàng: <b>{summary.total}</b>
        </div>
        <div className="inv-summary-card inv-summary-card--warn">
          <AlertCircle size={16} /> Sắp hết: <b>{summary.low}</b>
        </div>
        <div className="inv-summary-card inv-summary-card--danger">
          <AlertCircle size={16} /> Hết hàng: <b>{summary.out}</b>
        </div>
      </div>

      {feedback && <div className="inv-feedback" role="status" aria-live="polite">{feedback}</div>}
      {!canUseCount && (
        <div className="inv-state inv-state--error">
          <AlertCircle size={18} /> Vui lòng chọn một kho cụ thể để kiểm tồn cuối kỳ.
        </div>
      )}

      <section className="inv-count-panel" aria-labelledby="inventory-count-title">
        <div className="inv-section-heading">
          <div>
            <h3 id="inventory-count-title">
              <ClipboardCheck size={18} /> Kiểm tồn cuối kỳ
            </h3>
            <p>Tạo kỳ kiểm kê, nhập số lượng thực tế và chốt chênh lệch về tồn hệ thống.</p>
          </div>
          <button
            type="button"
            className="inv-primary-btn"
            onClick={handleCreateCount}
            disabled={!canUseCount || creatingCount}
          >
            {creatingCount ? "Đang tạo…" : "Tạo kỳ kiểm kê"}
          </button>
        </div>

        <div className="inv-count-form">
          <label>
            Tên kỳ
            <input
              name="inventory-count-title"
              autoComplete="off"
              value={countTitle}
              onChange={(event) => setCountTitle(event.target.value)}
              placeholder="VD: Kiểm kê cuối tháng…"
            />
          </label>
          <label>
            Từ ngày
            <input
              name="inventory-count-from"
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              name="inventory-count-to"
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
            />
          </label>
          <label>
            Kỳ hiện có
            <select
              name="inventory-count-select"
              value={activeCount?.id || ""}
              onChange={(event) => setActiveCountId(event.target.value)}
              disabled={!counts.length}
            >
              {counts.length ? (
                counts.map((count) => (
                  <option key={count.id} value={count.id}>
                    {count.code} • {countStatusLabel[count.status] || count.status}
                  </option>
                ))
              ) : (
                <option value="">Chưa có kỳ kiểm kê</option>
              )}
            </select>
          </label>
        </div>

        {countsError && <div className="inv-state inv-state--error">{countsError.message}</div>}
        {countsLoading && <div className="inv-state">Đang tải kỳ kiểm kê…</div>}

        {activeCount && (
          <>
            <div className="inv-count-summary">
              <span><b>{activeCount.code}</b></span>
              <span>{formatDate(activeCount.periodStart)} → {formatDate(activeCount.periodEnd)}</span>
              <span>Đã đếm: {countSummary.counted}/{countSummary.total}</span>
              <span>Lệch: {countSummary.varianceLines} dòng / {formatQty(countSummary.netVariance)}</span>
              <span className={`inv-badge inv-badge--${activeCount.status === "closed" ? "ok" : "low"}`}>
                {activeCount.status === "closed" ? "Đã chốt" : "Đang kiểm"}
              </span>
              {activeCount.status !== "closed" && (
                <button
                  type="button"
                  className="inv-primary-btn"
                  onClick={handleCloseCount}
                  disabled={closingCount || countSummary.counted < countSummary.total}
                >
                  {closingCount ? "Đang chốt…" : "Chốt kỳ & điều chỉnh"}
                </button>
              )}
            </div>

            <div className="inv-table-wrap inv-count-table-wrap">
              <table className="inv-table inv-count-table">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>SKU</th>
                    <th>Hệ thống</th>
                    <th>Thực tế</th>
                    <th>Chênh lệch</th>
                    <th>Ghi chú</th>
                    <th>Lưu</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeCount.lines || []).slice(0, 80).map((line) => {
                    const draft = lineDraft(line);
                    const variance =
                      hasCountedQty(draft.countedQty)
                        ? Number(draft.countedQty) - Number(line.systemQty || 0)
                        : Number(line.variance || 0);
                    return (
                      <tr key={line.ingredientId}>
                        <td>{line.nameSnapshot || line.ingredientId}</td>
                        <td>{line.skuSnapshot || "—"}</td>
                        <td>{formatQty(line.systemQty)} {line.unit}</td>
                        <td>
                          <input
                            name={`counted-${line.ingredientId}`}
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            value={draft.countedQty}
                            onChange={(event) => setLineDraft(line, { countedQty: event.target.value })}
                            disabled={activeCount.status === "closed"}
                            aria-label={`Số thực tế ${line.nameSnapshot}`}
                          />
                        </td>
                        <td className={variance === 0 ? "" : variance > 0 ? "inv-positive" : "inv-negative"}>
                          {formatQty(variance)} {line.unit}
                        </td>
                        <td>
                          <input
                            name={`count-note-${line.ingredientId}`}
                            autoComplete="off"
                            value={draft.note}
                            onChange={(event) => setLineDraft(line, { note: event.target.value })}
                            disabled={activeCount.status === "closed"}
                            placeholder="Ghi chú…"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="inv-small-btn"
                            onClick={() => handleSaveLine(line)}
                            disabled={activeCount.status === "closed" || updatingLine || !hasCountedQty(draft.countedQty)}
                          >
                            Lưu
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="inv-toolbar">
        <label className="inv-search">
          <Search size={16} />
          <input
            name="inventory-search"
            autoComplete="off"
            aria-label="Tìm kiếm kiểm kê theo tên hoặc SKU"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Tìm theo tên/SKU…"
          />
        </label>

        <select
          name="inventory-status-filter"
          aria-label="Lọc trạng thái tồn kho"
          value={stockFilter}
          onChange={(e) => {
            setPage(1);
            setStockFilter(e.target.value);
          }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="ok">Còn hàng</option>
          <option value="low">Sắp hết</option>
          <option value="out">Hết hàng</option>
        </select>

        <button
          type="button"
          className="inv-sort-btn"
          onClick={() =>
            setSortBy((s) =>
              s === "name" ? "available" : s === "available" ? "status" : "name",
            )
          }
        >
          <ArrowDownUp size={16} /> Sắp xếp: {sortBy}
        </button>
      </div>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Nguyên liệu</th>
              <th>SKU</th>
              <th>Tồn khả dụng</th>
              <th>Định mức</th>
              <th>Kho</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((it) => (
              <tr key={it.ingredientId}>
                <td>{it.name}</td>
                <td>{it.sku || "—"}</td>
                <td>{formatQty(it.available)} {it.unit}</td>
                <td>{formatQty(it.minStock)} {it.unit}</td>
                <td>{it.warehouseCount}</td>
                <td>
                  <span className={`inv-badge inv-badge--${it.status}`}>
                    {it.status === "ok"
                      ? "Còn hàng"
                      : it.status === "low"
                        ? "Sắp hết"
                        : "Hết hàng"}
                  </span>
                </td>
              </tr>
            ))}
            {!pagedRows.length && (
              <tr>
                <td colSpan={6} className="inv-empty-row">
                  Không có dữ liệu phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="inv-pagination">
        <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
          Trước
        </button>
        <span>
          Trang {safePage}/{totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Sau
        </button>
      </div>

      <section className="inv-document-block" aria-labelledby="inventory-document-title">
        <div className="inv-section-heading">
          <div>
            <h3 id="inventory-document-title">
              <FileCheck2 size={18} /> Đối chiếu chứng từ nhập/xuất
            </h3>
            <p>Cập nhật số phiếu/hóa đơn và trạng thái khớp giấy tờ cho từng biến động kho.</p>
          </div>
          {documentsLoading && <span className="inv-muted">Đang tải…</span>}
        </div>
        {documentsError && <div className="inv-state inv-state--error">{documentsError.message}</div>}
        <div className="inv-document-list">
          {documentMovements.slice(0, 20).map((movement) => {
            const draft = documentDraft(movement);
            const ing = ingredientMap.get(movement.ingredientId);
            return (
              <article className="inv-document-item" key={movement.id}>
                <div>
                  <strong>{ing?.name || movement.ingredientId}</strong>
                  <span>{movementLabel[movement.type] || movement.type} • {formatQty(movement.qty)} {ing?.baseUnit || ""}</span>
                  <span>{formatDate(movement.createdAt)} • {movement.reason || "Không có lý do"}</span>
                </div>
                <label>
                  Số phiếu
                  <input
                    name={`doc-no-${movement.id}`}
                    autoComplete="off"
                    value={draft.documentNo}
                    onChange={(event) => setDocumentDraft(movement, { documentNo: event.target.value })}
                    placeholder="VD: PN-0001…"
                  />
                </label>
                <label>
                  Trạng thái
                  <select
                    name={`doc-status-${movement.id}`}
                    value={draft.status}
                    onChange={(event) => setDocumentDraft(movement, { status: event.target.value })}
                  >
                    {Object.entries(documentStatusLabel).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Ghi chú
                  <input
                    name={`doc-note-${movement.id}`}
                    autoComplete="off"
                    value={draft.note}
                    onChange={(event) => setDocumentDraft(movement, { note: event.target.value })}
                    placeholder="Nội dung lệch/thiếu…"
                  />
                </label>
                <button
                  type="button"
                  className="inv-small-btn"
                  onClick={() => handleSaveDocument(movement)}
                  disabled={reconcilingDocument}
                >
                  <CheckCircle2 size={15} /> Lưu
                </button>
              </article>
            );
          })}
          {!documentMovements.length && <div className="inv-state">Chưa có biến động để đối chiếu.</div>}
        </div>
      </section>

      <div className="inv-movement-block">
        <h4>
          <History size={16} /> Lịch sử biến động gần nhất
        </h4>
        <div className="inv-movement-list">
          {movementRows.map((mv) => (
            <div key={mv.id} className="inv-movement-item">
              <strong>{mv.ingredientName}</strong>
              <span>{movementLabel[mv.type] || mv.type}</span>
              <span>
                {mv.qty > 0 ? `+${formatQty(mv.qty)}` : formatQty(mv.qty)} {mv.unit}
              </span>
              <span>{mv.warehouseName}</span>
              {mv.toWarehouseName && <span>→ {mv.toWarehouseName}</span>}
              {mv.fromWarehouseName && <span>← {mv.fromWarehouseName}</span>}
              <span>
                {mv.cost !== null
                  ? `${Number(mv.cost).toLocaleString("vi-VN")} đ/${mv.unit}`
                  : "—"}
              </span>
              <span>
                {mv.totalValue !== null
                  ? `${Number(mv.totalValue).toLocaleString("vi-VN")} đ`
                  : "—"}
              </span>
              {mv.reason && <span>{mv.reason}</span>}
              <span>{new Date(mv.createdAt).toLocaleString("vi-VN")}</span>
            </div>
          ))}
          {!movementRows.length && <div className="inv-state">Chưa có biến động.</div>}
        </div>
      </div>
    </div>
  );
}

export default InventoryAuditTab;
