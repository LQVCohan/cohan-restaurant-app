import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  AlertCircle,
  ArrowDownUp,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  History,
  RefreshCw,
  Search,
  Scale,
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

const documentStatusTone = {
  pending: "pending",
  matched: "ok",
  mismatch: "warn",
  missing: "danger",
};

const countStatusLabel = {
  draft: "Đang kiểm",
  closed: "Đã chốt",
  cancelled: "Đã hủy",
};

const countStatusTone = {
  draft: "low",
  closed: "ok",
  cancelled: "out",
};

const sortLabel = {
  name: "Tên A–Z",
  available: "Tồn khả dụng",
  status: "Mức cảnh báo",
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

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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
  const [feedback, setFeedback] = useState(null);

  const ingredientMap = useMemo(() => {
    const map = new Map();
    ingredients.forEach((item) => map.set(item.id, item));
    return map;
  }, [ingredients]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouses.forEach((warehouse) => map.set(String(warehouse.id), warehouse.name || warehouse.id));
    return map;
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

  const inventoryRows = useMemo(() => {
    const aggregate = new Map();

    for (const stockItem of stockItems) {
      const key = stockItem.ingredientId;
      if (!key) continue;

      const current = aggregate.get(key) || {
        ingredientId: key,
        onHand: 0,
        reserved: 0,
        available: 0,
        warehouseCount: 0,
      };
      const onHand = Number(stockItem.onHand) || 0;
      const reserved = Number(stockItem.reserved) || 0;

      current.onHand += onHand;
      current.reserved += reserved;
      current.available += onHand - reserved;
      current.warehouseCount += 1;
      aggregate.set(key, current);
    }

    return Array.from(aggregate.values()).map((item) => {
      const ingredient = ingredientMap.get(item.ingredientId);
      const minStock = Number(ingredient?.minStock) || 0;
      let status = "ok";
      if (item.available <= 0) status = "out";
      else if (item.available <= minStock) status = "low";

      return {
        ...item,
        name: ingredient?.name || "Nguyên liệu chưa xác định",
        sku: ingredient?.sku || "",
        unit: ingredient?.baseUnit || "",
        minStock,
        status,
      };
    });
  }, [ingredientMap, stockItems]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = inventoryRows.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        String(item.ingredientId).toLowerCase().includes(query);
      const matchesStatus = stockFilter === "all" || item.status === stockFilter;
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      if (sortBy === "available") return b.available - a.available;
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return a.name.localeCompare(b.name, "vi");
    });

    return filtered;
  }, [inventoryRows, search, sortBy, stockFilter]);

  const summary = useMemo(
    () => inventoryRows.reduce(
      (result, item) => {
        result.total += 1;
        result[item.status] += 1;
        return result;
      },
      { total: 0, ok: 0, low: 0, out: 0 },
    ),
    [inventoryRows],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const movementRows = useMemo(() => movements.map((movement) => {
    const ingredient = ingredientMap.get(movement.ingredientId);
    const unit = ingredient?.baseUnit || "";
    const cost = Number(movement?.meta?.costPerBaseUnit);
    const totalValue =
      Number(movement?.meta?.totalValue) ||
      ((Number(movement.qty) || 0) * (Number.isFinite(cost) ? cost : 0));

    return {
      ...movement,
      ingredientName:
        ingredient?.name || (movement.ingredientId ? "Nguyên liệu chưa xác định" : "Vật tư kho"),
      unit,
      warehouseName: warehouseMap.get(String(movement.warehouseId)) || movement.warehouseId,
      toWarehouseName:
        warehouseMap.get(String(movement?.meta?.toWarehouseId)) || movement?.meta?.toWarehouseId,
      fromWarehouseName:
        warehouseMap.get(String(movement?.meta?.fromWarehouseId)) || movement?.meta?.fromWarehouseId,
      cost: Number.isFinite(cost) ? cost : null,
      totalValue: Number.isFinite(totalValue) ? totalValue : null,
    };
  }).slice(0, 30), [ingredientMap, movements, warehouseMap]);

  const countSummary = useMemo(() => {
    const lines = activeCount?.lines || [];
    return lines.reduce(
      (result, line) => {
        result.total += 1;
        if (hasCountedQty(line.countedQty)) result.counted += 1;
        const variance = Number(line.variance || 0);
        if (variance !== 0) {
          result.varianceLines += 1;
          result.netVariance += variance;
        }
        return result;
      },
      { total: 0, counted: 0, varianceLines: 0, netVariance: 0 },
    );
  }, [activeCount]);

  const completionPercent = countSummary.total
    ? Math.round((countSummary.counted / countSummary.total) * 100)
    : 0;
  const hasActiveFilters = Boolean(search.trim() || stockFilter !== "all");

  const refreshAudit = async () => {
    await Promise.allSettled([refetchCounts?.(), refetchDocuments?.(), onReload?.()]);
  };

  const handleRefresh = async () => {
    setFeedback(null);
    await refreshAudit();
    setFeedback({ tone: "success", message: "Đã cập nhật dữ liệu kiểm kê mới nhất." });
  };

  const handleCreateCount = async () => {
    if (!canUseCount) {
      setFeedback({ tone: "error", message: "Vui lòng chọn một kho cụ thể trước khi tạo kỳ kiểm kê." });
      return;
    }

    setFeedback(null);
    try {
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
      setFeedback({ tone: "success", message: `Đã tạo kỳ ${next?.code || "kiểm kê"}.` });
    } catch (actionError) {
      setFeedback({ tone: "error", message: actionError?.message || "Không thể tạo kỳ kiểm kê." });
    }
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
    setDraftLines((previous) => ({
      ...previous,
      [key]: { ...lineDraft(line), ...patch },
    }));
  };

  const handleSaveLine = async (line) => {
    const draft = lineDraft(line);
    setFeedback(null);
    try {
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
      setFeedback({ tone: "success", message: `Đã lưu số kiểm đếm của ${line.nameSnapshot}.` });
    } catch (actionError) {
      setFeedback({ tone: "error", message: actionError?.message || "Không thể lưu số kiểm đếm." });
    }
  };

  const handleCloseCount = async () => {
    if (!activeCount) return;
    if (countSummary.counted < countSummary.total) {
      setFeedback({ tone: "error", message: "Cần nhập đủ số lượng thực tế trước khi chốt kỳ." });
      return;
    }
    if (!window.confirm(`Chốt kỳ ${activeCount.code}? Hệ thống sẽ tạo bút toán điều chỉnh tồn kho.`)) {
      return;
    }

    setFeedback(null);
    try {
      await closeCount({ variables: { input: { countId: activeCount.id } } });
      await refreshAudit();
      setFeedback({ tone: "success", message: `Đã chốt kỳ ${activeCount.code}.` });
    } catch (actionError) {
      setFeedback({ tone: "error", message: actionError?.message || "Không thể chốt kỳ kiểm kê." });
    }
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
    setDocumentDrafts((previous) => ({
      ...previous,
      [key]: { ...documentDraft(movement), ...patch },
    }));
  };

  const handleSaveDocument = async (movement) => {
    const draft = documentDraft(movement);
    setFeedback(null);
    try {
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
      setFeedback({ tone: "success", message: "Đã lưu kết quả đối chiếu chứng từ." });
    } catch (actionError) {
      setFeedback({ tone: "error", message: actionError?.message || "Không thể lưu đối chiếu chứng từ." });
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStockFilter("all");
    setPage(1);
  };

  if (loading) {
    return (
      <div className="inventory-audit-tab" aria-label="Đang tải kiểm kê">
        <div className="inv-hero inv-skeleton" aria-hidden="true" />
        <div className="inv-overview-grid inv-overview-grid--skeleton">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="inv-overview-card inv-skeleton" key={index} aria-hidden="true" />
          ))}
        </div>
        <div className="inv-workspace-panel inv-skeleton inv-skeleton--panel" aria-hidden="true" />
        <div className="inv-table-shell inv-skeleton-table" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inv-error-state" role="alert">
        <span className="inv-error-state__icon" aria-hidden="true"><AlertCircle size={24} /></span>
        <div>
          <p className="inv-eyebrow">Không thể tải dữ liệu</p>
          <h2>Kiểm kê đang tạm gián đoạn</h2>
          <p>{error.message}</p>
        </div>
        {onReload && (
          <button type="button" className="inv-primary-btn" onClick={onReload}>
            <RefreshCw size={16} /> Thử tải lại
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inventory-audit-tab">
      <header className="inv-hero">
        <div className="inv-hero__copy">
          <p className="inv-eyebrow">Bảng điều hành kiểm kê</p>
          <h2>Kiểm tồn, đối soát và theo dõi biến động</h2>
          <p>
            Tập trung cảnh báo tồn kho, kỳ kiểm đếm đang thực hiện và chứng từ cần xử lý trong cùng một luồng công việc.
          </p>
        </div>

        <div className="inv-hero__actions">
          <nav className="inv-section-nav" aria-label="Đi đến khu vực kiểm kê">
            <a href="#inv-count-workspace"><ClipboardCheck size={15} /> Kiểm tồn <ChevronRight size={14} /></a>
            <a href="#inv-stock-workspace"><Boxes size={15} /> Tồn kho <ChevronRight size={14} /></a>
            <a href="#inv-document-workspace"><FileCheck2 size={15} /> Chứng từ <ChevronRight size={14} /></a>
          </nav>
          <button type="button" className="inv-refresh-btn" onClick={handleRefresh}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </header>

      <section className="inv-overview-grid" aria-label="Tình trạng tồn kho">
        <article className="inv-overview-card">
          <span className="inv-overview-card__icon" aria-hidden="true"><Boxes size={18} /></span>
          <div><span>Đang theo dõi</span><strong>{summary.total}</strong><small>mặt hàng có tồn kho</small></div>
        </article>
        <article className="inv-overview-card inv-overview-card--ok">
          <span className="inv-overview-card__icon" aria-hidden="true"><CheckCircle2 size={18} /></span>
          <div><span>Ổn định</span><strong>{summary.ok}</strong><small>trên ngưỡng cảnh báo</small></div>
        </article>
        <article className="inv-overview-card inv-overview-card--warn">
          <span className="inv-overview-card__icon" aria-hidden="true"><AlertCircle size={18} /></span>
          <div><span>Sắp hết</span><strong>{summary.low}</strong><small>cần lên kế hoạch nhập</small></div>
        </article>
        <article className="inv-overview-card inv-overview-card--danger">
          <span className="inv-overview-card__icon" aria-hidden="true"><AlertCircle size={18} /></span>
          <div><span>Hết hàng</span><strong>{summary.out}</strong><small>cần xử lý ngay</small></div>
        </article>
      </section>

      {feedback && (
        <div
          className={`inv-feedback inv-feedback--${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {feedback.tone === "error" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {!canUseCount && (
        <div className="inv-scope-warning" role="status">
          <AlertCircle size={18} />
          <div>
            <strong>Chọn một kho cụ thể để bắt đầu kiểm tồn.</strong>
            <span>Bảng tổng hợp vẫn hiển thị, nhưng tạo và chốt kỳ cần có phạm vi kho.</span>
          </div>
        </div>
      )}

      <section
        id="inv-count-workspace"
        className="inv-workspace-panel inv-count-panel"
        aria-labelledby="inventory-count-title"
      >
        <div className="inv-section-heading">
          <div>
            <p className="inv-section-kicker">Bước 1 · Kiểm đếm thực tế</p>
            <h3 id="inventory-count-title"><ClipboardCheck size={19} /> Kỳ kiểm kê</h3>
            <p>Tạo kỳ, nhập số lượng thực tế và chốt chênh lệch về tồn hệ thống.</p>
          </div>
          <span className="inv-section-number">01</span>
        </div>

        <div className="inv-count-layout">
          <form
            className="inv-count-create"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateCount();
            }}
          >
            <div className="inv-card-heading">
              <div>
                <span>Tạo kỳ mới</span>
                <strong>Chụp lại tồn hệ thống tại thời điểm bắt đầu</strong>
              </div>
              <CalendarDays size={19} aria-hidden="true" />
            </div>

            <label>
              Tên kỳ
              <input
                name="inventory-count-title"
                autoComplete="off"
                value={countTitle}
                onChange={(event) => setCountTitle(event.target.value)}
                placeholder="Ví dụ: Kiểm kê cuối tháng"
              />
            </label>

            <div className="inv-date-grid">
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
            </div>

            <button
              type="submit"
              className="inv-primary-btn inv-primary-btn--wide"
              disabled={!canUseCount || creatingCount}
            >
              <ClipboardCheck size={17} /> {creatingCount ? "Đang tạo kỳ…" : "Tạo kỳ kiểm kê"}
            </button>
          </form>

          <div className="inv-active-count">
            <div className="inv-card-heading">
              <div>
                <span>Kỳ đang theo dõi</span>
                <strong>{activeCount ? activeCount.title || activeCount.code : "Chưa có kỳ kiểm kê"}</strong>
              </div>
              <Scale size={19} aria-hidden="true" />
            </div>

            <label className="inv-count-selector">
              Chọn kỳ hiện có
              <select
                name="inventory-count-select"
                value={activeCount?.id || ""}
                onChange={(event) => setActiveCountId(event.target.value)}
                disabled={!counts.length}
              >
                {counts.length ? counts.map((count) => (
                  <option key={count.id} value={count.id}>
                    {count.code} • {countStatusLabel[count.status] || count.status}
                  </option>
                )) : <option value="">Chưa có kỳ kiểm kê</option>}
              </select>
            </label>

            {countsError && <div className="inv-inline-error">{countsError.message}</div>}
            {countsLoading && <div className="inv-muted">Đang tải danh sách kỳ…</div>}

            {activeCount ? (
              <div className="inv-active-count__body">
                <div className="inv-active-count__topline">
                  <span className={`inv-badge inv-badge--${countStatusTone[activeCount.status] || "low"}`}>
                    {countStatusLabel[activeCount.status] || activeCount.status}
                  </span>
                  <strong>{activeCount.code}</strong>
                </div>

                <div className="inv-count-meta-grid">
                  <div><span>Khoảng kiểm</span><strong>{formatDate(activeCount.periodStart)} → {formatDate(activeCount.periodEnd)}</strong></div>
                  <div><span>Đã đếm</span><strong>{countSummary.counted}/{countSummary.total} dòng</strong></div>
                  <div><span>Dòng chênh lệch</span><strong>{countSummary.varianceLines}</strong></div>
                  <div><span>Lệch ròng</span><strong className={countSummary.netVariance === 0 ? "" : countSummary.netVariance > 0 ? "inv-positive" : "inv-negative"}>{formatQty(countSummary.netVariance)}</strong></div>
                </div>

                <div className="inv-progress-block">
                  <div><span>Tiến độ kiểm đếm</span><strong>{completionPercent}%</strong></div>
                  <progress value={countSummary.counted} max={Math.max(countSummary.total, 1)}>
                    {completionPercent}%
                  </progress>
                </div>

                {activeCount.status === "draft" && (
                  <button
                    type="button"
                    className="inv-primary-btn inv-primary-btn--wide"
                    onClick={handleCloseCount}
                    disabled={closingCount || countSummary.counted < countSummary.total}
                  >
                    <CheckCircle2 size={17} /> {closingCount ? "Đang chốt kỳ…" : "Chốt kỳ và điều chỉnh tồn"}
                  </button>
                )}
              </div>
            ) : (
              <div className="inv-empty-state inv-empty-state--compact">
                <ClipboardCheck size={24} />
                <strong>Chưa có kỳ kiểm kê</strong>
                <span>Tạo kỳ đầu tiên để bắt đầu nhập số lượng thực tế.</span>
              </div>
            )}
          </div>
        </div>

        {activeCount && (
          <div className="inv-count-lines">
            <div className="inv-subsection-heading">
              <div>
                <span>Phiếu kiểm</span>
                <h4>Nhập số lượng thực tế</h4>
              </div>
              <small>{activeCount.status === "closed" ? "Kỳ đã chốt, dữ liệu chỉ đọc" : "Lưu từng dòng sau khi kiểm đếm"}</small>
            </div>

            <div className="inv-table-shell inv-count-table-shell">
              <table className="inv-table inv-count-table">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>SKU</th>
                    <th>Hệ thống</th>
                    <th>Thực tế</th>
                    <th>Chênh lệch</th>
                    <th>Ghi chú</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeCount.lines || []).slice(0, 80).map((line) => {
                    const draft = lineDraft(line);
                    const variance = hasCountedQty(draft.countedQty)
                      ? Number(draft.countedQty) - Number(line.systemQty || 0)
                      : Number(line.variance || 0);
                    return (
                      <tr key={line.ingredientId}>
                        <td data-label="Nguyên liệu"><strong>{line.nameSnapshot || line.ingredientId}</strong></td>
                        <td data-label="SKU">{line.skuSnapshot || "—"}</td>
                        <td data-label="Hệ thống">{formatQty(line.systemQty)} {line.unit}</td>
                        <td data-label="Thực tế">
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
                        <td
                          data-label="Chênh lệch"
                          className={variance === 0 ? "" : variance > 0 ? "inv-positive" : "inv-negative"}
                        >
                          {formatQty(variance)} {line.unit}
                        </td>
                        <td data-label="Ghi chú">
                          <input
                            name={`count-note-${line.ingredientId}`}
                            autoComplete="off"
                            value={draft.note}
                            onChange={(event) => setLineDraft(line, { note: event.target.value })}
                            disabled={activeCount.status === "closed"}
                            placeholder="Lý do chênh lệch"
                          />
                        </td>
                        <td data-label="Thao tác">
                          <button
                            type="button"
                            className="inv-small-btn"
                            onClick={() => handleSaveLine(line)}
                            disabled={activeCount.status === "closed" || updatingLine || !hasCountedQty(draft.countedQty)}
                          >
                            Lưu dòng
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section
        id="inv-stock-workspace"
        className="inv-workspace-panel inv-stock-panel"
        aria-labelledby="inventory-stock-title"
      >
        <div className="inv-section-heading">
          <div>
            <p className="inv-section-kicker">Bước 2 · Quan sát tồn</p>
            <h3 id="inventory-stock-title"><Boxes size={19} /> Tồn khả dụng</h3>
            <p>Tìm nhanh mặt hàng cần xử lý và so sánh tồn hiện tại với định mức cảnh báo.</p>
          </div>
          <span className="inv-section-number">02</span>
        </div>

        <div className="inv-toolbar">
          <label className="inv-search">
            <Search size={17} />
            <input
              name="inventory-search"
              autoComplete="off"
              aria-label="Tìm kiếm tồn kho theo tên hoặc SKU"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Tìm tên, SKU hoặc mã nguyên liệu"
            />
          </label>

          <div className="inv-filter-group" role="group" aria-label="Lọc trạng thái tồn kho">
            {[
              ["all", "Tất cả", summary.total],
              ["ok", "Ổn định", summary.ok],
              ["low", "Sắp hết", summary.low],
              ["out", "Hết hàng", summary.out],
            ].map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                className={`inv-filter-btn ${stockFilter === value ? "is-active" : ""}`}
                aria-pressed={stockFilter === value}
                onClick={() => {
                  setPage(1);
                  setStockFilter(value);
                }}
              >
                {label}<span>{count}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="inv-sort-btn"
            onClick={() => setSortBy((current) => (
              current === "name" ? "available" : current === "available" ? "status" : "name"
            ))}
          >
            <ArrowDownUp size={16} /> {sortLabel[sortBy]}
          </button>

          {hasActiveFilters && (
            <button type="button" className="inv-text-btn" onClick={resetFilters}>Xóa bộ lọc</button>
          )}
        </div>

        <div className="inv-result-line" aria-live="polite">
          <span>Hiển thị <strong>{rows.length}</strong>/{summary.total} mặt hàng</span>
          <span>Kho đã chọn: <strong>{warehouseMap.get(String(warehouseId)) || "Tất cả kho"}</strong></span>
        </div>

        <div className="inv-table-shell">
          <table className="inv-table inv-stock-table">
            <thead>
              <tr>
                <th>Nguyên liệu</th>
                <th>SKU</th>
                <th>Tồn khả dụng</th>
                <th>Định mức</th>
                <th>Số kho</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((item) => (
                <tr key={item.ingredientId} className={`inv-stock-row inv-stock-row--${item.status}`}>
                  <td data-label="Nguyên liệu"><strong>{item.name}</strong></td>
                  <td data-label="SKU">{item.sku || "—"}</td>
                  <td data-label="Tồn khả dụng"><strong>{formatQty(item.available)}</strong> {item.unit}</td>
                  <td data-label="Định mức">{formatQty(item.minStock)} {item.unit}</td>
                  <td data-label="Số kho">{item.warehouseCount}</td>
                  <td data-label="Trạng thái">
                    <span className={`inv-badge inv-badge--${item.status}`}>
                      {item.status === "ok" ? "Ổn định" : item.status === "low" ? "Sắp hết" : "Hết hàng"}
                    </span>
                  </td>
                </tr>
              ))}
              {!pagedRows.length && (
                <tr>
                  <td colSpan={6} className="inv-empty-row">
                    <div className="inv-empty-state">
                      <Search size={24} />
                      <strong>Không có mặt hàng phù hợp</strong>
                      <span>Đổi từ khóa hoặc xóa bộ lọc để xem lại danh sách.</span>
                      {hasActiveFilters && <button type="button" className="inv-text-btn" onClick={resetFilters}>Xóa bộ lọc</button>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inv-pagination">
          <span>Trang {safePage}/{totalPages}</span>
          <div>
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)}>Trước</button>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => current + 1)}>Sau</button>
          </div>
        </div>
      </section>

      <div className="inv-operations-grid">
        <section
          id="inv-document-workspace"
          className="inv-workspace-panel inv-document-block"
          aria-labelledby="inventory-document-title"
        >
          <div className="inv-section-heading inv-section-heading--compact">
            <div>
              <p className="inv-section-kicker">Bước 3 · Kiểm soát giấy tờ</p>
              <h3 id="inventory-document-title"><FileCheck2 size={19} /> Đối chiếu chứng từ</h3>
              <p>Gắn số phiếu và đánh dấu tình trạng khớp cho từng biến động.</p>
            </div>
            {documentsLoading && <span className="inv-muted">Đang tải…</span>}
          </div>

          {documentsError && <div className="inv-inline-error">{documentsError.message}</div>}

          <div className="inv-document-list">
            {documentMovements.slice(0, 20).map((movement) => {
              const draft = documentDraft(movement);
              const ingredient = ingredientMap.get(movement.ingredientId);
              return (
                <article
                  className={`inv-document-item inv-document-item--${documentStatusTone[draft.status] || "pending"}`}
                  key={movement.id}
                >
                  <div className="inv-document-item__head">
                    <div>
                      <strong>{ingredient?.name || "Nguyên liệu chưa xác định"}</strong>
                      <span>
                        {movementLabel[movement.type] || movement.type} · {formatQty(movement.qty)} {ingredient?.baseUnit || ""}
                      </span>
                      <small>{formatDateTime(movement.createdAt)} · {movement.reason || "Không có lý do"}</small>
                    </div>
                    <span className={`inv-doc-status inv-doc-status--${documentStatusTone[draft.status] || "pending"}`}>
                      {documentStatusLabel[draft.status] || draft.status}
                    </span>
                  </div>

                  <div className="inv-document-fields">
                    <label>
                      Số phiếu
                      <input
                        name={`doc-no-${movement.id}`}
                        autoComplete="off"
                        value={draft.documentNo}
                        onChange={(event) => setDocumentDraft(movement, { documentNo: event.target.value })}
                        placeholder="Ví dụ: PN-0001"
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
                    <label className="inv-document-note">
                      Ghi chú
                      <input
                        name={`doc-note-${movement.id}`}
                        autoComplete="off"
                        value={draft.note}
                        onChange={(event) => setDocumentDraft(movement, { note: event.target.value })}
                        placeholder="Nội dung lệch hoặc thiếu"
                      />
                    </label>
                    <button
                      type="button"
                      className="inv-small-btn"
                      onClick={() => handleSaveDocument(movement)}
                      disabled={reconcilingDocument}
                    >
                      <CheckCircle2 size={15} /> Lưu đối chiếu
                    </button>
                  </div>
                </article>
              );
            })}

            {!documentMovements.length && (
              <div className="inv-empty-state inv-empty-state--compact">
                <FileCheck2 size={24} />
                <strong>Chưa có biến động cần đối chiếu</strong>
                <span>Phiếu nhập, xuất hoặc điều chỉnh mới sẽ xuất hiện tại đây.</span>
              </div>
            )}
          </div>
        </section>

        <section className="inv-workspace-panel inv-movement-block" aria-labelledby="inventory-movement-title">
          <div className="inv-section-heading inv-section-heading--compact">
            <div>
              <p className="inv-section-kicker">Dòng thời gian kho</p>
              <h3 id="inventory-movement-title"><History size={19} /> Biến động gần nhất</h3>
              <p>Theo dõi nguồn phát sinh, số lượng, giá trị và tuyến kho.</p>
            </div>
          </div>

          <div className="inv-table-shell inv-movement-table-shell">
            <table className="inv-table inv-movement-table">
              <thead>
                <tr>
                  <th>Mặt hàng</th>
                  <th>Loại</th>
                  <th>Số lượng</th>
                  <th>Kho / tuyến</th>
                  <th>Giá trị</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {movementRows.map((movement) => {
                  const route = movement.fromWarehouseName || movement.toWarehouseName
                    ? `${movement.fromWarehouseName || movement.warehouseName || "—"} → ${movement.toWarehouseName || movement.warehouseName || "—"}`
                    : movement.warehouseName || "—";
                  return (
                    <tr key={movement.id}>
                      <td data-label="Mặt hàng">
                        <strong>{movement.ingredientName}</strong>
                        <small>{movement.reason || "Không có ghi chú"}</small>
                      </td>
                      <td data-label="Loại">{movementLabel[movement.type] || movement.type}</td>
                      <td
                        data-label="Số lượng"
                        className={Number(movement.qty) >= 0 ? "inv-positive" : "inv-negative"}
                      >
                        {Number(movement.qty) > 0 ? "+" : ""}{formatQty(movement.qty)} {movement.unit}
                      </td>
                      <td data-label="Kho / tuyến">{route}</td>
                      <td data-label="Giá trị">
                        {movement.totalValue !== null
                          ? `${Math.abs(Number(movement.totalValue)).toLocaleString("vi-VN")} đ`
                          : "—"}
                      </td>
                      <td data-label="Thời gian">{formatDateTime(movement.createdAt)}</td>
                    </tr>
                  );
                })}
                {!movementRows.length && (
                  <tr>
                    <td colSpan={6} className="inv-empty-row">
                      <div className="inv-empty-state inv-empty-state--compact">
                        <History size={24} />
                        <strong>Chưa có biến động kho</strong>
                        <span>Lịch sử nhập, xuất và điều chỉnh sẽ được ghi tại đây.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default InventoryAuditTab;
