import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import { toIngredientCategoryVi } from "../../../../../utils/ingredientCategoryI18n";
import {
  FolderPlus,
  RefreshCw,
  Search,
  Filter,
  Edit2,
  Trash2,
  Clock,
  AlertCircle,
  Database,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import "./IngredientCategoryManagerModal.scss";

const PAGE_SIZE = 7;

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const matchCategory = (cat, search, sourceFilter) => {
  if (sourceFilter !== "all" && cat.source !== sourceFilter) return false;
  const key = normalizeText(search);
  if (!key) return true;
  return normalizeText(cat.name).includes(key);
};

const fmtDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatSyncSummary = (report) => {
  if (!report) return "Chưa có lịch sử đồng bộ.";
  if (report.summaryText && !/^processed=/i.test(report.summaryText)) return report.summaryText;

  const total = Number(report.totalIngredients || 0);
  const created = Number(report.categoriesCreated || 0);
  const updated = Number(report.categoriesUpdated || 0);
  const reassigned = Number(report.ingredientsReassigned || 0);
  const errors = Number(report.errors || 0);
  return `${total} nguyên liệu · ${created} danh mục mới · ${updated} cập nhật · ${reassigned} gán lại · ${errors} lỗi`;
};

const getCategoryId = (cat) => cat?.id || cat?._id || cat?.name;

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
  const [error, setError] = useState("");
  const [pendingCreatedCategory, setPendingCreatedCategory] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setLoading(false);
    setSearch("");
    setSourceFilter("all");
    setPage(1);
    setLastSyncReport(null);
    setError("");
    setPendingCreatedCategory(null);
  }, [isOpen]);

  const manualCount = useMemo(
    () => categories.filter((cat) => cat.source !== "sync").length,
    [categories],
  );
  const syncCount = useMemo(
    () => categories.filter((cat) => cat.source === "sync").length,
    [categories],
  );

  const filtered = useMemo(() => {
    const key = normalizeText(search);
    return [...categories]
      .filter((cat) => matchCategory(cat, key, sourceFilter))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
  }, [categories, search, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    if (!pendingCreatedCategory) return;
    const sortedAll = [...categories].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "vi"),
    );
    const created = sortedAll.find((cat) => {
      if (pendingCreatedCategory.id && getCategoryId(cat) === pendingCreatedCategory.id) {
        return true;
      }
      return normalizeText(cat.name) === normalizeText(pendingCreatedCategory.name);
    });
    if (!created) return;

    const visibleWithCurrentFilters = matchCategory(created, search, sourceFilter);
    const nextSearch = visibleWithCurrentFilters ? search : "";
    const nextSourceFilter = visibleWithCurrentFilters ? sourceFilter : "all";

    if (!visibleWithCurrentFilters) {
      setSearch("");
      setSourceFilter("all");
    }

    const nextFiltered = sortedAll.filter((cat) =>
      matchCategory(cat, nextSearch, nextSourceFilter),
    );
    const createdIndex = nextFiltered.findIndex(
      (cat) => getCategoryId(cat) === getCategoryId(created),
    );

    setPage(createdIndex >= 0 ? Math.floor(createdIndex / PAGE_SIZE) + 1 : 1);
    setPendingCreatedCategory(null);
  }, [categories, pendingCreatedCategory, search, sourceFilter]);

  const create = async () => {
    if (!name.trim()) return;
    setError("");
    setLoading(true);
    try {
      const nextName = name.trim();
      const created = await onCreate?.(nextName);
      setName("");
      setPendingCreatedCategory({
        id: created?.id || created?._id || null,
        name: created?.name || nextName,
      });
    } catch (err) {
      setError(err?.message || "Không thể tạo danh mục mới.");
    } finally {
      setLoading(false);
    }
  };

  const canClose = useCallback(() => {
    if (loading) return false;
    if (name.trim()) {
      const ok = window.confirm(
        "Bạn đang nhập danh mục mới. Đóng cửa sổ có thể làm mất dữ liệu. Tiếp tục?",
      );
      if (!ok) return false;
    }
    return true;
  }, [loading, name]);

  const requestClose = useCallback(() => {
    if (!canClose()) return;
    onClose?.();
  }, [canClose, onClose]);

  const summary = lastSyncReport || syncLogs?.[0] || null;
  const lastSyncAt = lastSyncReport?.syncedAt || syncLogs?.[0]?.at;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      onBeforeClose={canClose}
      title="Danh mục nguyên liệu"
      size="lg"
      className="storage-category-modal-shell"
      closeOnOverlayClick={false}
      closeOnEscape={!loading}
    >
      <Modal.Body className="cat-manager-modal-body">
        <div className="cat-manager-premium cat-manager-workbench">
          <section className="cat-manager-compact-hero">
            <div className="hero-copy">
              <span className="hero-kicker">
                <Sparkles size={14} /> Sắp xếp kho dễ hơn
              </span>
              <h4>Tạo, tìm và đồng bộ danh mục tại một nơi</h4>
              <p>Tên danh mục tiếng Việt có dấu được giữ nguyên; đồng bộ chỉ chuẩn hóa nhóm và liên kết nguyên liệu.</p>
            </div>
            <div className="hero-stats compact" aria-label="Thống kê danh mục">
              <div><strong>{categories.length}</strong><span>Tổng danh mục</span></div>
              <div><strong>{filtered.length}</strong><span>Đang hiển thị</span></div>
            </div>
          </section>

          {!!error && (
            <div className="alert-box danger" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="cat-manager-main-grid">
            <aside className="cat-manager-side-panel">
              <div className="category-action-card manual-card primary-action">
                <div className="im-section-header compact">
                  <div className="icon-box"><FolderPlus size={16} /></div>
                  <div className="header-text">
                    <h4 className="im-section-title">Tạo danh mục mới</h4>
                    <p className="im-section-desc">Có thể nhập đầy đủ dấu tiếng Việt.</p>
                  </div>
                </div>
                <div className="quick-create-row">
                  <div className="input-with-icon flex-1">
                    <Layers size={16} className="icon" />
                    <input
                      className="standard-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          create();
                        }
                      }}
                      placeholder="Ví dụ: Hải sản, Đồ khô..."
                      aria-label="Tên danh mục mới"
                      disabled={loading}
                    />
                  </div>
                  <Button type="button" onClick={create} disabled={loading || !name.trim()} className="btn-save">
                    Thêm
                  </Button>
                </div>
              </div>

              <div className="category-action-card sync-card secondary-action">
                <div className="im-section-header compact">
                  <div className="icon-box warning"><Database size={16} /></div>
                  <div className="header-text">
                    <h4 className="im-section-title">Quét và đồng bộ</h4>
                    <p className="im-section-desc">Tự gom nguyên liệu vào nhóm phù hợp, tên nhóm có dấu.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="btn-outline-primary w-full sync-button"
                  onClick={async () => {
                    if (!window.confirm("Quét lại nguyên liệu và đồng bộ danh mục ngay?")) return;
                    setLoading(true);
                    try {
                      const report = await onSync?.();
                      setLastSyncReport(report || null);
                      setError("");
                    } catch (err) {
                      setError(err?.message || "Đồng bộ danh mục thất bại.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading-state"><span className="spinner" /> Đang quét...</span>
                  ) : (
                    <><RefreshCw size={16} /> Quét nguyên liệu</>
                  )}
                </Button>
              </div>

              <div className="metrics-grid compact-metrics">
                <Metric label="Tự tạo" value={manualCount} />
                <Metric label="Từ dữ liệu" value={syncCount} />
                <Metric label="Đã gán lại" value={summary?.ingredientsReassigned || 0} />
                <Metric label="Lỗi" value={summary?.errors || 0} danger={summary?.errors > 0} />
              </div>

              <section className="last-sync-card">
                <div className="im-section-header compact">
                  <div className="icon-box bg-slate"><Clock size={16} /></div>
                  <div className="header-text">
                    <h4 className="im-section-title">Lần quét gần nhất</h4>
                    <p className="im-section-desc">Tóm tắt kết quả để kiểm tra nhanh.</p>
                  </div>
                </div>
                {summary ? (
                  <div className="last-sync-content">
                    <div className="last-sync-time"><CheckCircle2 size={15} /> {fmtDateTime(lastSyncAt)}</div>
                    <p>{formatSyncSummary(summary)}</p>
                  </div>
                ) : (
                  <div className="last-sync-empty">Chưa quét dữ liệu nguyên liệu.</div>
                )}
              </section>
            </aside>

            <section className="category-list-panel manager-grade-list">
              <div className="list-panel-top">
                <div className="im-section-header list-header">
                  <div className="icon-box"><Layers size={18} /></div>
                  <div className="header-text">
                    <h4 className="im-section-title">Danh mục hiện có</h4>
                    <p className="im-section-desc">{filtered.length} kết quả · Trang {currentPage}/{pageCount}</p>
                  </div>
                </div>
                <span className="list-count-pill">{pageRows.length}/{filtered.length}</span>
              </div>

              <div className="toolbar">
                <div className="input-with-icon search-box flex-1">
                  <Search size={16} className="icon" />
                  <input
                    className="standard-input"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm danh mục..."
                    aria-label="Tìm danh mục"
                    disabled={loading}
                  />
                </div>
                <div className="input-with-icon filter-box">
                  <Filter size={16} className="icon" />
                  <select
                    className="standard-input"
                    value={sourceFilter}
                    onChange={(e) => {
                      setSourceFilter(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Lọc nguồn danh mục"
                    disabled={loading}
                  >
                    <option value="all">Tất cả danh mục</option>
                    <option value="manual">Tự tạo</option>
                    <option value="sync">Từ dữ liệu</option>
                  </select>
                </div>
              </div>

              <div className="list-container main-scroll-list">
                {pageRows.map((cat) => (
                  <div key={getCategoryId(cat)} className="list-item">
                    <div className="item-info">
                      <div className="item-name">{toIngredientCategoryVi(cat.name)}</div>
                      <div className="item-meta">
                        <span className={`badge ${cat.source === "sync" ? "badge-sync" : "badge-manual"}`}>
                          {cat.source === "sync" ? "TỪ DỮ LIỆU" : "TỰ TẠO"}
                        </span>
                        <span className="usage-count">Đang dùng cho <b>{cat.usageCount || 0}</b> nguyên liệu</span>
                      </div>
                    </div>
                    <div className="item-actions">
                      <button
                        type="button"
                        className="action-btn edit"
                        disabled={loading}
                        title="Đổi tên"
                        aria-label={`Đổi tên danh mục ${cat.name || ""}`}
                        onClick={async () => {
                          const next = window.prompt("Đổi tên danh mục:", cat.name || "");
                          if (!next?.trim() || next.trim() === cat.name) return;
                          setLoading(true);
                          try {
                            await onRename?.(getCategoryId(cat), next.trim());
                            setError("");
                          } catch (err) {
                            setError(err?.message || "Đổi tên thất bại.");
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        className="action-btn delete"
                        disabled={loading}
                        title="Xóa danh mục"
                        aria-label={`Xóa danh mục ${cat.name || ""}`}
                        onClick={async () => {
                          if (!window.confirm(`Xóa danh mục "${cat.name}"?`)) return;
                          setLoading(true);
                          try {
                            await onDelete?.(getCategoryId(cat));
                            setError("");
                          } catch (err) {
                            setError(err?.message || "Xóa thất bại.");
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {!pageRows.length && (
                  <div className="empty-state">
                    <Search size={32} />
                    <p>Không tìm thấy danh mục phù hợp.</p>
                    <span>Thử đổi từ khóa hoặc chọn tất cả danh mục.</span>
                  </div>
                )}
              </div>

              <div className="pagination-premium">
                <span className="page-info">Hiển thị {pageRows.length} / {filtered.length} danh mục</span>
                <div className="page-controls">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} /> Trước
                  </button>
                  <button
                    type="button"
                    className="page-btn"
                    disabled={currentPage >= pageCount || loading}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Sau <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="cat-manager-footer">
        <span className="footer-helper">Danh mục được dùng để lọc nguyên liệu, kiểm kê và lập công thức.</span>
        <Button type="button" variant="secondary" onClick={requestClose} disabled={loading} className="btn-cancel">
          Đóng
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const Metric = ({ label, value, danger = false }) => (
  <div className={`metric-card ${danger ? "danger" : ""}`}>
    <span className="metric-label">{label}</span>
    <span className="metric-value">{Number(value) || 0}</span>
  </div>
);

export default IngredientCategoryManagerModal;