import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import TableQrPreviewModal from "./TableQrPreviewModal";
import "./TableQrManagementPage.scss";

const TABLE_QR_FIELDS = gql`
  fragment TableQrFields on Table {
    id restaurantId floorId floorLevel code status capacity
    tableAccessUrl tableQrCodeDataUrl tableQrGeneratedAt tableQrExpiresAt
  }
`;
const TABLE_QR_LIST = gql`
  query TableQrList($restaurantId: ID!) {
    tableQrAccessList(restaurantId: $restaurantId) { ...TableQrFields }
  }
  ${TABLE_QR_FIELDS}
`;
const GENERATE_TABLE_QR = gql`
  mutation GenerateTableAccessQr($input: GenerateTableAccessQrInput!) {
    generateTableAccessQr(input: $input) { ...TableQrFields }
  }
  ${TABLE_QR_FIELDS}
`;
const REVOKE_TABLE_QR = gql`
  mutation RevokeTableAccessQr($tableId: ID!) {
    revokeTableAccessQr(tableId: $tableId) { ...TableQrFields }
  }
  ${TABLE_QR_FIELDS}
`;

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
});
const formatDateTime = (value) => {
  if (!value) return "Chưa tạo";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không xác định" : dateTimeFormatter.format(date);
};
const isQrExpired = (table) => table?.tableQrExpiresAt && new Date(table.tableQrExpiresAt).getTime() <= Date.now();
const getTableQrState = (table) => {
  if (!table?.tableAccessUrl || !table?.tableQrCodeDataUrl) return "missing";
  return isQrExpired(table) ? "expired" : "ready";
};
const getTableQrLabel = (state) => state === "ready" ? "Đang hoạt động" : state === "expired" ? "Hết hạn" : "Chưa tạo";
const getPublicTableBaseUrl = () =>
  import.meta.env.VITE_PUBLIC_TABLE_BASE_URL || import.meta.env.VITE_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173");

export default function TableQrManagementPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const restaurantList = useMemo(() => restaurants || [], [restaurants]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [busyTableId, setBusyTableId] = useState("");
  const [copiedTableId, setCopiedTableId] = useState("");
  const [previewTableId, setPreviewTableId] = useState("");
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [qrFilter, setQrFilter] = useState("all");

  useEffect(() => {
    if (!selectedRestaurantId && restaurantList.length) {
      setSelectedRestaurantId(String(restaurantList[0].id || restaurantList[0].restaurantId));
    }
  }, [restaurantList, selectedRestaurantId]);

  const { data, loading, error, refetch } = useQuery(TABLE_QR_LIST, {
    variables: { restaurantId: selectedRestaurantId }, skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [generateTableQr] = useMutation(GENERATE_TABLE_QR);
  const [revokeTableQr] = useMutation(REVOKE_TABLE_QR);

  const tables = useMemo(() => [...(data?.tableQrAccessList || [])].sort(
    (a, b) => Number(a.floorLevel || 0) - Number(b.floorLevel || 0) ||
      String(a.code || "").localeCompare(String(b.code || ""), "vi", { numeric: true }),
  ), [data?.tableQrAccessList]);
  const floors = useMemo(() => [...new Set(tables.map((table) => Number(table.floorLevel || 0)))].sort((a, b) => a - b), [tables]);
  const filteredTables = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return tables.filter((table) => {
      const state = getTableQrState(table);
      return (!keyword || String(table.code || "").toLowerCase().includes(keyword)) &&
        (floorFilter === "all" || String(table.floorLevel || 0) === floorFilter) &&
        (qrFilter === "all" || state === qrFilter);
    });
  }, [floorFilter, qrFilter, search, tables]);
  const previewTable = useMemo(
    () => tables.find((table) => String(table.id) === String(previewTableId)) || null,
    [previewTableId, tables],
  );

  const readyCount = tables.filter((table) => getTableQrState(table) === "ready").length;
  const expiredCount = tables.filter((table) => getTableQrState(table) === "expired").length;
  const missingTables = useMemo(() => tables.filter((table) => ["missing", "expired"].includes(getTableQrState(table))), [tables]);
  const isMutating = Boolean(busyTableId);

  const handleGenerate = async (table) => {
    if (!table?.id || busyTableId) return;
    setBusyTableId(table.id);
    try {
      await generateTableQr({ variables: { input: { tableId: table.id, baseUrl: getPublicTableBaseUrl() } } });
      await refetch?.();
      showNotification(`Đã tạo mã QR cho bàn ${table.code || ""}.`, "success");
    } catch {
      showNotification("Chưa thể tạo mã QR. Vui lòng thử lại.", "error");
    } finally { setBusyTableId(""); }
  };

  const handleGenerateMissing = async () => {
    if (busyTableId || !missingTables.length) return;
    if (!window.confirm(`Tạo mới hoặc thay thế mã QR cho ${missingTables.length} bàn cần xử lý?`)) return;
    setBusyTableId("__bulk__");
    let successCount = 0;
    let failedCount = 0;
    try {
      for (const table of missingTables) {
        try {
          await generateTableQr({ variables: { input: { tableId: table.id, baseUrl: getPublicTableBaseUrl() } } });
          successCount += 1;
        } catch { failedCount += 1; }
      }
      await refetch?.();
      showNotification(failedCount ? `Đã tạo ${successCount} mã; còn ${failedCount} bàn cần thử lại.` : `Đã tạo mã QR cho ${successCount} bàn.`, failedCount ? "warning" : "success");
    } finally { setBusyTableId(""); }
  };

  const handleRevoke = async (table) => {
    if (!table?.id || busyTableId) return;
    if (!window.confirm(`Thu hồi mã QR của bàn ${table.code || "--"}?`)) return;
    setBusyTableId(table.id);
    try {
      await revokeTableQr({ variables: { tableId: table.id } });
      if (String(previewTableId) === String(table.id)) setPreviewTableId("");
      await refetch?.();
      showNotification("Đã thu hồi mã QR của bàn.", "success");
    } catch { showNotification("Chưa thể thu hồi mã QR. Vui lòng thử lại.", "error"); }
    finally { setBusyTableId(""); }
  };

  const handleCopy = async (table) => {
    if (!table?.tableAccessUrl) return;
    try {
      await navigator.clipboard.writeText(table.tableAccessUrl);
      setCopiedTableId(table.id);
      window.setTimeout(() => setCopiedTableId(""), 1500);
      showNotification("Đã sao chép địa chỉ truy cập.", "success");
    } catch { showNotification("Không thể tự sao chép. Hãy chọn và sao chép địa chỉ thủ công.", "warning"); }
  };
  const handleOpen = (table) => table?.tableAccessUrl && window.open(table.tableAccessUrl, "_blank", "noopener,noreferrer");
  const handlePreview = (table) => table?.tableQrCodeDataUrl && setPreviewTableId(table.id);
  const handlePrint = (table) => {
    if (!table?.tableQrCodeDataUrl) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=520,height=720");
    if (!printWindow) return showNotification("Trình duyệt đang chặn cửa sổ in.", "warning");
    printWindow.document.write(`<!doctype html><html><head><title>Mã QR bàn ${table.code || ""}</title><style>body{font-family:Arial;text-align:center;padding:28px;color:#1f2937}img{width:320px;height:320px}.card{border:1px solid #ddd;border-radius:20px;padding:24px;display:inline-block}p{word-break:break-word;color:#4b5563}</style></head><body><div class="card"><h1>Bàn ${table.code || "--"}</h1><p>Quét mã để gọi món và liên hệ nhân viên.</p><img src="${table.tableQrCodeDataUrl}"/><p>${table.tableAccessUrl || ""}</p></div><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  return <div className="table-qr-page" aria-busy={loading}>
    <ManagementPageHeader className="table-qr-page-header" density="compact" statsPlacement="none" showTimeWidget={false}
      eyebrow="QUẢN LÝ MÃ QR" title="Mã QR tại bàn" subtitle="Tạo, tìm và kiểm tra mã QR theo tầng và từng bàn." icon="📱"
      selectedRestaurant={selectedRestaurantId} onRestaurantChange={(value) => { setSelectedRestaurantId(value); setFloorFilter("all"); setQrFilter("all"); setSearch(""); setPreviewTableId(""); }}
      restaurantList={restaurantList.map((restaurant) => ({ id: String(restaurant.id || restaurant.restaurantId), name: restaurant.name }))}
      primaryAction={{ label: "Tải lại", icon: "↻", onClick: () => refetch?.(), disabled: !selectedRestaurantId || loading }} />

    <section className="table-qr-overview">
      <div className="table-qr-overview__top">
        <div className="table-qr-summary">
          <span className="table-qr-summary__item"><strong>{tables.length}</strong><span>Tổng bàn</span></span>
          <span className="table-qr-summary__item table-qr-summary__item--ready"><strong>{readyCount}</strong><span>Đang hoạt động</span></span>
          <span className="table-qr-summary__item table-qr-summary__item--attention"><strong>{missingTables.length}</strong><span>Cần xử lý</span></span>
          <span className="table-qr-summary__item table-qr-summary__item--expired"><strong>{expiredCount}</strong><span>Hết hạn</span></span>
        </div>
        <button className="table-qr-bulk-action" type="button" onClick={handleGenerateMissing} disabled={isMutating || !missingTables.length}>
          {busyTableId === "__bulk__" ? "Đang tạo mã…" : missingTables.length ? `Tạo mã cho ${missingTables.length} bàn` : "Không có mã cần tạo"}
        </button>
      </div>
      <div className="table-qr-filters" aria-label="Lọc mã QR theo tầng và bàn">
        <label><span>Tìm bàn</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập mã bàn, ví dụ T201" /></label>
        <label><span>Tầng</span><select value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}><option value="all">Tất cả tầng</option>{floors.map((floor) => <option key={floor} value={String(floor)}>Tầng {floor || "?"}</option>)}</select></label>
        <label><span>Trạng thái mã</span><select value={qrFilter} onChange={(event) => setQrFilter(event.target.value)}><option value="all">Tất cả</option><option value="ready">Đang hoạt động</option><option value="missing">Chưa tạo</option><option value="expired">Hết hạn</option></select></label>
        <button type="button" onClick={() => { setSearch(""); setFloorFilter("all"); setQrFilter("all"); }}>Xóa lọc</button>
      </div>
    </section>

    {error ? <section className="table-qr-state" role="alert">Không thể tải danh sách bàn. Hãy tải lại trang.</section> :
      loading && !tables.length ? <section className="table-qr-state">Đang tải danh sách bàn…</section> :
      !tables.length ? <section className="table-qr-state">Nhà hàng chưa có bàn để tạo mã QR.</section> :
      !filteredTables.length ? <section className="table-qr-state">Không tìm thấy bàn phù hợp. Hãy đổi bộ lọc.</section> :
      <section className="table-qr-grid" aria-label="Danh sách mã QR theo bàn">
        {filteredTables.map((table) => {
          const qrState = getTableQrState(table);
          const isBusy = busyTableId === table.id;
          const tableLabel = `bàn ${table.code || "--"}`;
          return <article className={`table-qr-card table-qr-card--${qrState}`} key={table.id}>
            <div className="table-qr-card__head"><div><p>Tầng {table.floorLevel || "?"}</p><h2>Bàn {table.code || "--"}</h2><small>{table.capacity || 0} chỗ · {table.status === "available" ? "Đang trống" : "Đang sử dụng"}</small></div><span>{getTableQrLabel(qrState)}</span></div>
            <div className="table-qr-card__body">
              {table.tableQrCodeDataUrl ? <button type="button" className="table-qr-card__preview-trigger" onClick={() => handlePreview(table)} aria-label={`Mở rộng mã QR của ${tableLabel}`} title="Mở rộng mã QR"><img src={table.tableQrCodeDataUrl} alt={`Mã QR truy cập bàn ${table.code || ""}`} width="128" height="128" loading="lazy" /><span aria-hidden="true">Mở rộng</span></button> : <div className="table-qr-card__placeholder">QR</div>}
              <div className="table-qr-card__meta"><p><strong>Ngày tạo</strong><span>{formatDateTime(table.tableQrGeneratedAt)}</span></p><p><strong>Hết hạn</strong><span>{formatDateTime(table.tableQrExpiresAt)}</span></p>{table.tableAccessUrl && <code title={table.tableAccessUrl}>{table.tableAccessUrl}</code>}</div>
            </div>
            <div className="table-qr-card__actions">
              <button type="button" onClick={() => handleGenerate(table)} disabled={isMutating}>{isBusy ? "Đang xử lý…" : qrState === "ready" ? "Tạo lại" : "Tạo mã"}</button>
              <button type="button" onClick={() => handlePreview(table)} disabled={!table.tableQrCodeDataUrl}>Mở rộng</button>
              <button type="button" onClick={() => handleOpen(table)} disabled={!table.tableAccessUrl}>Mở trang</button>
              <button type="button" onClick={() => handleCopy(table)} disabled={!table.tableAccessUrl}>{copiedTableId === table.id ? "Đã sao chép" : "Sao chép"}</button>
              <button type="button" onClick={() => handlePrint(table)} disabled={!table.tableQrCodeDataUrl}>In mã</button>
              <button type="button" className="danger" onClick={() => handleRevoke(table)} disabled={isMutating || !table.tableAccessUrl} aria-label={`Thu hồi mã QR của ${tableLabel}`}>Thu hồi</button>
            </div>
          </article>;
        })}
      </section>}

    <TableQrPreviewModal
      table={previewTable}
      copied={Boolean(previewTable && copiedTableId === previewTable.id)}
      onClose={() => setPreviewTableId("")}
      onCopy={handleCopy}
      onOpen={handleOpen}
      onPrint={handlePrint}
    />
  </div>;
}
