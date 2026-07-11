import React from "react";
import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Database,
  LayoutGrid,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import "./MenuEngineeringAssistantWidget.scss";

const nf = (value) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const quadrantLabel = {
  star: "Chủ lực",
  plowhorse: "Bán tốt, lời thấp",
  puzzle: "Lời cao, bán chậm",
  dog: "Cần xem lại",
};

const methodLabel = (method = "") =>
  ({
    menu_engineering_v1: "Phân loại theo dữ liệu bán món",
  })[method] || "Phân tích doanh thu và giá vốn";

const normalizeSuggestion = (value = "") =>
  String(value)
    .replace(/Tối ưu\s*cost\/portion\s*cho/gi, "Rà soát định lượng cho")
    .replace(/cost\/portion/gi, "định lượng và chi phí")
    .replace(/Đẩy truyền thông cho/gi, "Tăng hiển thị cho")
    .replace(/để tăng độ phổ biến/gi, "để tăng lượt gọi món")
    .replace(/để tăng lợi nhuận/gi, "để cải thiện lợi nhuận")
    .replace(/\bSTAR\b/g, "chủ lực")
    .replace(/\bPLOWHORSE\b/g, "bán tốt")
    .replace(/\bPUZZLE\b/g, "lời cao, bán chậm")
    .replace(/\bDOG\b/g, "cần xem lại")
    .trim();

const normalizeDataNote = (value = "") =>
  String(value)
    .replace(/cost/gi, "giá vốn")
    .replace(/snapshot/gi, "dữ liệu tại thời điểm bán")
    .replace(/recipe/gi, "công thức")
    .replace(/fallback/gi, "ước tính mặc định")
    .trim();

const MetaStrip = ({ meta }) =>
  meta ? (
    <div className="ai-meta-strip">
      {meta.fallbackUsed ? (
        <span className="verify-badge">Có giá vốn ước tính</span>
      ) : null}
      <span>{methodLabel(meta.method)}</span>
      <span>
        {meta.sampleOrders ?? "-"} đơn / {meta.sampleDays ?? "-"} ngày
      </span>
      {meta.generatedAt ? (
        <span>Cập nhật {new Date(meta.generatedAt).toLocaleString("vi-VN")}</span>
      ) : null}
    </div>
  ) : null;

const DishCard = ({ dish }) => (
  <li className="menu-dish-card">
    <div className="dish-main">
      <span className="dish-name">{dish.dishName}</span>
      <span className={`quadrant ${dish.quadrant}`}>
        {quadrantLabel[dish.quadrant] || dish.quadrant}
      </span>
    </div>
    <div className="dish-metrics" aria-label={`Hiệu quả món ${dish.dishName}`}>
      <span>
        <small>Đã bán</small>
        <strong>{nf(dish.quantity)}</strong>
      </span>
      <span>
        <small>Doanh thu</small>
        <strong>{nf(dish.revenue)}đ</strong>
      </span>
      <span>
        <small>Lợi nhuận</small>
        <strong>{nf(dish.profit)}đ</strong>
      </span>
      <span>
        <small>Biên</small>
        <strong>{nf(dish.marginPct)}%</strong>
      </span>
    </div>
  </li>
);

const MenuEngineeringAssistantWidget = ({ assistant, loading, onNavigate }) => {
  const summary = assistant?.summary || {};
  const dishes = assistant?.dishes || [];
  const recommendations = assistant?.recommendations || [];
  const meta = assistant?.meta || {};
  const dataNotes = summary.notes || [];
  const visibleDishes = dishes.slice(0, 3);
  const moreDishes = dishes.slice(3, 8);
  const primaryAction = recommendations[0] || null;
  const moreActions = recommendations.slice(1, 4);
  const fallbackMarginPct = Math.round(Number(meta.fallbackMarginRate || 0.65) * 100);

  return (
    <div className="widget-card menu-engineering-assistant-widget">
      <div className="widget-head">
        <div className="title-wrap">
          <div className="icon-wrap">
            <BarChart3 size={18} />
          </div>
          <div>
            <h3>Phân tích hiệu quả menu</h3>
            <p>Xếp hạng món từ doanh thu, số lượng bán và giá vốn</p>
          </div>
        </div>
        <button
          type="button"
          className="meta-pill data"
          onClick={() => onNavigate?.("menu")}
        >
          Mở menu
        </button>
      </div>

      <MetaStrip meta={meta} />

      <div className="menu-data-source">
        <div className="source-icon" aria-hidden="true">
          <Database size={17} />
        </div>
        <div>
          <div className="source-title-row">
            <strong>Nguồn và cách tính</strong>
            <span className={meta.fallbackUsed ? "source-mode estimated" : "source-mode"}>
              {meta.fallbackUsed ? "Có phần ước tính" : "Giá vốn đã ghi nhận"}
            </span>
          </div>
          <p>
            Đơn hàng {meta.sampleDays ?? 30} ngày → giá vốn lưu tại thời điểm bán →
            công thức món và giá nguyên liệu → biên mặc định {fallbackMarginPct}% khi thiếu dữ liệu.
          </p>
          <small>
            Phân nhóm theo số lượng bán và lãi trên mỗi phần so với mức trung bình;
            không dùng AI để thay đổi số liệu.
          </small>
        </div>
      </div>

      {loading ? (
        <div className="state-message">Đang tổng hợp hiệu suất từng món...</div>
      ) : null}

      {!loading ? (
        <>
          <div className="menu-summary-grid" aria-label="Tóm tắt phân loại menu">
            <div className="menu-summary-item">
              <span>Chủ lực</span>
              <strong>{nf(summary.starCount)}</strong>
            </div>
            <div className="menu-summary-item">
              <span>Bán tốt</span>
              <strong>{nf(summary.plowhorseCount)}</strong>
            </div>
            <div className="menu-summary-item">
              <span>Lời cao</span>
              <strong>{nf(summary.puzzleCount)}</strong>
            </div>
            <div className="menu-summary-item">
              <span>Cần xem lại</span>
              <strong>{nf(summary.dogCount)}</strong>
            </div>
          </div>

          <div className="menu-insight-row">
            <span>
              <CircleDollarSign size={15} />
              Biên lợi nhuận TB <strong>{nf(summary.avgMarginPct)}%</strong>
            </span>
            <span>
              <Target size={15} />
              Món phân tích <strong>{nf(summary.totalDishes)}</strong>
            </span>
          </div>

          {visibleDishes.length ? (
            <section className="menu-list-section">
              <h4>
                <TrendingUp size={16} /> Món nổi bật theo doanh thu
              </h4>
              <ul className="menu-dish-list">
                {visibleDishes.map((dish) => (
                  <DishCard key={dish.dishId} dish={dish} />
                ))}
              </ul>

              {moreDishes.length ? (
                <details className="menu-disclosure">
                  <summary>
                    <span>Xem thêm {moreDishes.length} món</span>
                    <ChevronDown size={17} />
                  </summary>
                  <ul className="menu-dish-list more-dishes">
                    {moreDishes.map((dish) => (
                      <DishCard key={dish.dishId} dish={dish} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          ) : (
            <div className="state-message compact">
              <LayoutGrid size={16} />
              <p>Chưa có món đủ dữ liệu để phân tích.</p>
            </div>
          )}

          <section className="menu-action-section">
            <h4>
              <Sparkles size={16} /> Hành động đề xuất
            </h4>
            {primaryAction ? (
              <div className="menu-primary-action">{normalizeSuggestion(primaryAction)}</div>
            ) : (
              <div className="state-message compact">
                Chưa có hành động đủ cơ sở để đề xuất.
              </div>
            )}

            {moreActions.length ? (
              <details className="menu-disclosure">
                <summary>
                  <span>Xem thêm {moreActions.length} hành động</span>
                  <ChevronDown size={17} />
                </summary>
                <ul className="menu-action-list">
                  {moreActions.map((note, index) => (
                    <li key={`${index}-${note}`}>{normalizeSuggestion(note)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          {dataNotes.length ? (
            <details className="menu-disclosure data-notes">
              <summary>
                <span>Ghi chú chất lượng dữ liệu</span>
                <ChevronDown size={17} />
              </summary>
              <ul>
                {dataNotes.map((note, index) => (
                  <li key={`${index}-${note}`}>{normalizeDataNote(note)}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default MenuEngineeringAssistantWidget;
