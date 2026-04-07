import React, { useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import { toIngredientCategoryVi } from "../../../../../utils/ingredientCategoryI18n";

const PAGE_SIZE = 8;

const fmtDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
};

const IngredientCategoryManagerModal = ({
  isOpen,
  onClose,
  categories = [],
  syncLogs = [],
  onCreate,
  onRename,
  onDelete,
  onSync,
}) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [lastSyncReport, setLastSyncReport] = useState(null);

  const filtered = useMemo(() => {
    const key = String(search || "").trim().toLowerCase();
    return [...(categories || [])]
      .filter((cat) => {
        if (sourceFilter !== "all" && cat.source !== sourceFilter) return false;
        if (!key) return true;
        return String(cat.name || "").toLowerCase().includes(key);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [categories, search, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  if (!isOpen) return null;

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate?.(name.trim());
      setName("");
    } finally {
      setLoading(false);
    }
  };

  const summary = lastSyncReport || syncLogs?.[0] || null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title="Quản lý danh mục nguyên liệu"
      size="lg"
      closeOnOverlayClick={false}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên danh mục mới"
            style={{ flex: 1, minHeight: 40, padding: "0 12px" }}
          />
          <Button type="button" onClick={create} disabled={loading}>
            Thêm
          </Button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <b>Danh mục hiện có</b>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              if (!window.confirm("Bạn có chắc chắn muốn đồng bộ danh mục từ nguyên liệu?")) return;
              setLoading(true);
              try {
                const report = await onSync?.();
                setLastSyncReport(report || null);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            {loading ? "Đang đồng bộ..." : "Đồng bộ danh mục"}
          </Button>
        </div>

        {summary && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <Metric label="Tạo mới" value={summary.categoriesCreated} />
            <Metric label="Cập nhật" value={summary.categoriesUpdated} />
            <Metric label="Gán lại" value={summary.ingredientsReassigned} />
            <Metric label="Lỗi" value={summary.errors} danger={summary.errors > 0} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm danh mục"
            style={{ flex: 1, minHeight: 36, padding: "0 10px" }}
          />
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            style={{ minHeight: 36, minWidth: 150 }}
          >
            <option value="all">Tất cả nguồn</option>
            <option value="manual">Manual</option>
            <option value="sync">Sync</option>
          </select>
        </div>

        <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          {pageRows.map((cat) => (
            <div
              key={cat.id}
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #eef2f7",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{toIngredientCategoryVi(cat.name)}</div>
                <small style={{ color: "#64748b" }}>
                  {cat.source || "manual"} • usage: {cat.usageCount || 0}
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    const next = window.prompt("Đổi tên danh mục", cat.name || "");
                    if (!next?.trim() || next.trim() === cat.name) return;
                    setLoading(true);
                    try {
                      await onRename?.(cat.id, next.trim());
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Đổi tên
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    if (!window.confirm(`Xóa danh mục "${cat.name}"?`)) return;
                    setLoading(true);
                    try {
                      await onDelete?.(cat.id);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {!pageRows.length && (
            <div style={{ padding: 16, color: "#64748b" }}>Không có danh mục phù hợp bộ lọc.</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <small style={{ color: "#64748b" }}>
            Trang {currentPage}/{pageCount}
          </small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Trước
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Sau
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 10 }}>
          <b>Lịch sử đồng bộ gần đây</b>
          <div style={{ maxHeight: 140, overflow: "auto", marginTop: 8 }}>
            {(syncLogs || []).map((log) => (
              <div key={log.id} style={{ padding: "6px 0", borderBottom: "1px dashed #e2e8f0" }}>
                <small style={{ color: "#475569" }}>
                  {fmtDateTime(log.at)} • {log.summaryText || "Không có mô tả"}
                </small>
              </div>
            ))}
            {!syncLogs?.length && <small style={{ color: "#94a3b8" }}>Chưa có lịch sử đồng bộ.</small>}
          </div>
        </div>
      </div>
    </Modal>
  );
};

const Metric = ({ label, value, danger = false }) => (
  <div style={{ background: "#f8fafc", border: `1px solid ${danger ? "#fca5a5" : "#e2e8f0"}`, borderRadius: 8, padding: 10 }}>
    <small style={{ color: "#64748b" }}>{label}</small>
    <div style={{ fontWeight: 700, color: danger ? "#b91c1c" : "#0f172a" }}>{Number(value) || 0}</div>
  </div>
);

export default IngredientCategoryManagerModal;
