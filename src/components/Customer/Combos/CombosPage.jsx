import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { useCart } from "@/context/CartProvider";
import { useNotification } from "@/hooks/useNotification";
import "./CombosPage.scss";
import "./CombosLayoutRepair.scss";

export const CUSTOMER_COMBOS = gql`
  query CustomerCombos($filter: CustomerComboFilterInput) {
    customerCombos(filter: $filter) {
      id
      sourceType
      restaurantId
      restaurantName
      name
      description
      imageUrl
      originalPrice
      comboPrice
      discountAmount
      discountPercent
      badge
      isAvailable
      startsAt
      endsAt
      items { menuItemId name qty imageUrl price }
    }
  }
`;

const ADD_COMBO_TO_CART = gql`
  mutation AddComboToCart($comboId: ID!, $quantity: Int = 1) {
    addComboToCart(comboId: $comboId, quantity: $quantity) {
      id
      totalQuantity
      totalAmount
      items { id itemType comboId comboSnapshot restaurantId menuItemId name price quantity thumbImage note servingVariantKey holdExpiresAt holdStatus }
    }
  }
`;

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80";
const money = (value) => Number(value || 0).toLocaleString("vi-VN");
const filters = {
  people: [
    ["", "Số người"], ["one", "1 người"], ["two", "2 người"], ["three_four", "3-4 người"], ["group", "nhóm lớn"],
  ],
  budget: [
    ["", "Ngân sách"], ["under_100k", "dưới 100k"], ["100k_200k", "100k-200k"], ["200k_400k", "200k-400k"], ["unlimited", "không giới hạn"],
  ],
  sourceType: [["", "tất cả"], ["COMBO", "combo trọn gói"], ["PROMOTION", "ưu đãi thanh toán"]],
};

const normalizeFilter = (filter) => Object.fromEntries(
  Object.entries(filter).filter(([, value]) => value && value !== "unlimited"),
);

const optionLabel = (key, value) => filters[key]?.find(([optionValue]) => optionValue === value)?.[1] || "";
const isBundleCombo = (combo) => combo?.sourceType === "COMBO";

export default function CombosPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const { refetchServerCart } = useCart();
  const { showNotification } = useNotification();
  const [filter, setFilter] = useState({ search: "", people: "", budget: "", sourceType: "" });
  const [selectedCombo, setSelectedCombo] = useState(null);
  const [addingComboId, setAddingComboId] = useState(null);
  const queryFilter = useMemo(() => ({ ...normalizeFilter(filter), onlyAvailable: true, limit: 36 }), [filter]);
  const { data, loading, error, refetch } = useQuery(CUSTOMER_COMBOS, {
    variables: { filter: queryFilter },
    fetchPolicy: "cache-and-network",
  });
  const [addComboToCartMutation] = useMutation(ADD_COMBO_TO_CART);
  const combos = data?.customerCombos || [];
  const featured = combos.slice(0, Math.min(3, combos.length));
  const remainingCombos = combos.slice(featured.length);
  const bestSaving = combos.reduce((max, combo) => Math.max(max, Number(combo.discountAmount || 0)), 0);
  const comboOnlyCount = combos.filter((combo) => combo.sourceType === "COMBO").length;
  const promotionCount = combos.filter((combo) => combo.sourceType === "PROMOTION").length;
  const activeFilters = [
    filter.search && `Tìm: ${filter.search}`,
    filter.people && optionLabel("people", filter.people),
    filter.budget && optionLabel("budget", filter.budget),
    filter.sourceType && optionLabel("sourceType", filter.sourceType),
  ].filter(Boolean);

  const updateFilter = (key, value) => setFilter((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilter({ search: "", people: "", budget: "", sourceType: "" });

  const addBundleCombo = async (combo) => {
    if (!isBundleCombo(combo)) {
      setSelectedCombo(combo);
      return;
    }
    if (!isAuthenticated || !user?.id) {
      showNotification("Vui lòng đăng nhập để thêm combo vào giỏ.", "warning");
      navigate("/login", { state: { from: "/combos" } });
      return;
    }
    setAddingComboId(combo.id);
    try {
      await addComboToCartMutation({ variables: { comboId: combo.id, quantity: 1 } });
      await refetchServerCart?.();
      showNotification("Đã thêm combo vào giỏ.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể thêm combo vào giỏ.", "error");
    } finally {
      setAddingComboId(null);
    }
  };

  const renderCard = (combo, featuredCard = false) => {
    const bundle = isBundleCombo(combo);
    const canAddBundle = bundle && combo.restaurantId && combo.items?.some((item) => item.menuItemId);
    const itemCount = (combo.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0);
    const titleId = `combo-title-${combo.sourceType}-${combo.id}`;
    return (
      <article className={`combo-card${featuredCard ? " combo-card--featured" : ""} ${bundle ? "combo-card--bundle" : "combo-card--promotion"}`} key={`${combo.sourceType}-${combo.id}`} aria-labelledby={titleId}>
        <div className="combo-card__image-wrap">
          <img src={combo.imageUrl || DEFAULT_IMAGE} alt={combo.name} className="combo-card__image" loading="lazy" />
          <span className="combo-card__badge">{combo.badge || (bundle ? "Combo trọn gói" : "Ưu đãi thanh toán")}</span>
          {combo.discountAmount > 0 && <span className="combo-card__saving-flag">- {money(combo.discountAmount)}đ</span>}
        </div>
        <div className="combo-card__body">
          <div className="combo-card__meta-row">
            <p className="combo-card__eyebrow">{bundle ? "Combo trọn gói" : "Ưu đãi khi thanh toán"}</p>
            <span>{itemCount || combo.items?.length || 0} món</span>
          </div>
          <h3 id={titleId}>{combo.name}</h3>
          <p className="combo-card__restaurant">{combo.restaurantName || "Nhà hàng đang cập nhật"}</p>
          <ul className="combo-card__items" aria-label={`Món trong ${combo.name}`}>
            {(combo.items || []).slice(0, 4).map((item) => <li key={`${combo.id}-${item.menuItemId || item.name}`}><span>{item.qty}×</span>{item.name}</li>)}
          </ul>
          <div className="combo-card__price-row">
            <strong>{money(combo.comboPrice ?? combo.originalPrice)}đ</strong>
            {combo.originalPrice && combo.comboPrice && combo.originalPrice > combo.comboPrice && <span>{money(combo.originalPrice)}đ</span>}
          </div>
          {bundle ? (
            combo.discountAmount > 0 && <p className="combo-card__save">Tiết kiệm {money(combo.discountAmount)}đ so với gọi lẻ</p>
          ) : (
            <p className="combo-card__save combo-card__save--notice">Ưu đãi sẽ tự áp dụng ở bước thanh toán khi giỏ hàng đủ điều kiện.</p>
          )}
          <div className="combo-card__actions">
            <button type="button" className="combo-card__secondary" onClick={() => setSelectedCombo(combo)}>{bundle ? "Xem combo" : "Xem ưu đãi"}</button>
            {canAddBundle ? (
              <button type="button" className="combo-card__primary" disabled={addingComboId === combo.id} onClick={() => addBundleCombo(combo)}>
                {addingComboId === combo.id ? "Đang thêm..." : "Thêm combo"}
              </button>
            ) : !bundle && combo.restaurantId ? (
              <Link className="combo-card__primary combo-card__primary--link" to={`/restaurant/${combo.restaurantId}`}>Chọn món</Link>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="combos-page" id="main-content" aria-labelledby="combos-title">
      <div className="combos-page__glow combos-page__glow--left" aria-hidden="true" />
      <div className="combos-page__glow combos-page__glow--right" aria-hidden="true" />

      <section className="combos-hero" aria-labelledby="combos-title">
        <div className="combos-hero__content">
          <span className="combos-hero__label">Cohan combo</span>
          <h1 id="combos-title">Combo tiết kiệm hôm nay</h1>
          <p>Chọn combo trọn gói để thêm nhanh vào giỏ, hoặc dùng ưu đãi thanh toán khi đơn hàng đủ điều kiện.</p>
          <div className="combos-hero__actions">
            <a href="#combo-results" className="combos-hero__primary">Xem combo</a>
            <Link className="combos-hero__link" to="/restaurants">Xem nhà hàng</Link>
          </div>
        </div>
        <aside className="combos-hero__panel" aria-label="Tóm tắt combo">
          <div>
            <span>{combos.length || "—"}</span>
            <small>combo khả dụng</small>
          </div>
          <div>
            <span>{bestSaving ? `${money(bestSaving)}đ` : "—"}</span>
            <small>tiết kiệm cao nhất</small>
          </div>
          <div>
            <span>{comboOnlyCount}/{promotionCount}</span>
            <small>trọn gói / ưu đãi</small>
          </div>
        </aside>
      </section>

      <section className="combos-filter" aria-label="Bộ lọc combo">
        <label className="combos-filter__search">
          <span>Tìm combo</span>
          <input value={filter.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Tên combo, nhà hàng..." />
        </label>
        {Object.entries(filters).map(([key, options]) => (
          <label key={key}>
            <span>{key === "people" ? "Số người" : key === "budget" ? "Ngân sách" : "Loại"}</span>
            <select value={filter[key]} onChange={(e) => updateFilter(key, e.target.value)}>
              {options.map(([value, label]) => <option key={value || key} value={value}>{label}</option>)}
            </select>
          </label>
        ))}
        {activeFilters.length > 0 && (
          <div className="combos-filter__chips" aria-label="Bộ lọc đang áp dụng">
            {activeFilters.map((label) => <span key={label}>{label}</span>)}
            <button type="button" onClick={clearFilters}>Xóa lọc</button>
          </div>
        )}
      </section>

      <section className="combos-curation" aria-label="Gợi ý chọn combo">
        <article>
          <span>01</span>
          <strong>Combo trọn gói</strong>
          <p>Thêm cả set món vào giỏ chỉ với một lần bấm.</p>
        </article>
        <article>
          <span>02</span>
          <strong>Ưu đãi rõ ràng</strong>
          <p>Ưu đãi thanh toán sẽ tự tính khi giỏ hàng đủ điều kiện.</p>
        </article>
        <article>
          <span>03</span>
          <strong>Dễ kiểm tra</strong>
          <p>Xem món con, giá gốc và mức tiết kiệm trước khi quyết định.</p>
        </article>
      </section>

      <div id="combo-results" />
      {loading && !combos.length ? <SkeletonGrid /> : error ? (
        <section className="combos-state combos-state--error" role="alert">
          <span className="combos-state__mark">Tạm thời chưa tải được</span>
          <h2>Combo chưa sẵn sàng để hiển thị</h2>
          <p>Vui lòng thử lại sau vài phút hoặc khám phá các nhà hàng đang mở.</p>
          <div className="combos-state__actions">
            <button type="button" onClick={() => refetch()}>Thử lại</button>
            <Link to="/restaurants">Xem nhà hàng</Link>
          </div>
        </section>
      ) : combos.length ? (
        <>
          <section className="combos-section combos-section--featured" aria-labelledby="featured-combos-title">
            <div className="combos-section__heading">
              <span>Combo nổi bật</span>
              <h2 id="featured-combos-title">Set món đáng thử</h2>
              <p>Ưu tiên combo có mức tiết kiệm tốt và dễ kiểm tra điều kiện trước khi chọn món.</p>
            </div>
            <div className={`combos-featured ${featured.length === 1 ? "combos-featured--single" : ""}`}>
              {featured.map((combo) => renderCard(combo, true))}
              {featured.length === 1 && (
                <aside className="combos-section__helper" aria-label="Gợi ý sử dụng combo">
                  <span>Gợi ý nhanh</span>
                  <h3>Đọc nhãn trước khi thêm vào giỏ</h3>
                  <p><strong>Combo trọn gói</strong> sẽ vào giỏ như một set món riêng. <strong>Ưu đãi thanh toán</strong> chỉ giảm giá khi bạn chọn đủ món điều kiện.</p>
                  <Link to="/restaurants">Xem thêm nhà hàng</Link>
                </aside>
              )}
            </div>
          </section>
          {remainingCombos.length > 0 && (
            <section className="combos-section combos-section--all" aria-labelledby="all-combos-title">
              <div className="combos-section__heading">
                <span>Tất cả combo</span>
                <h2 id="all-combos-title">Chọn theo bữa ăn của bạn</h2>
                <p>So sánh các combo còn lại theo số người, ngân sách và loại ưu đãi.</p>
              </div>
              <div className="combos-grid">{remainingCombos.map((combo) => renderCard(combo))}</div>
            </section>
          )}
        </>
      ) : (
        <section className="combos-state" role="status">
          <span className="combos-state__mark">Bộ sưu tập trống</span>
          <h2>Chưa có combo phù hợp</h2>
          <p>Bạn có thể xem nhà hàng hoặc quay lại sau khi có combo mới.</p>
          <div className="combos-state__actions"><Link to="/restaurants">Xem nhà hàng</Link><button type="button" onClick={clearFilters}>Xóa bộ lọc</button></div>
        </section>
      )}

      {selectedCombo && <ComboModal combo={selectedCombo} onClose={() => setSelectedCombo(null)} onAdd={addBundleCombo} isAdding={addingComboId === selectedCombo.id} />}
    </main>
  );
}

function SkeletonGrid() {
  return <div className="combos-grid combos-grid--loading" role="status" aria-live="polite" aria-label="Đang tải combo">{Array.from({ length: 6 }).map((_, i) => <div className="combo-card combo-card--skeleton" key={i}><div /><span /><span /><span /></div>)}</div>;
}

function ComboModal({ combo, onClose, onAdd, isAdding }) {
  const bundle = isBundleCombo(combo);
  const canAddBundle = bundle && combo.restaurantId && combo.items?.some((item) => item.menuItemId);
  const titleId = "combo-modal-title";
  return (
    <div className="combo-modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="combo-modal__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="combo-modal__close" aria-label="Đóng chi tiết combo" onClick={onClose}>×</button>
        <div className="combo-modal__media"><img src={combo.imageUrl || DEFAULT_IMAGE} alt={combo.name} /><span>{combo.badge || (bundle ? "Combo" : "Ưu đãi")}</span></div>
        <div className="combo-modal__content">
          <span className="combo-modal__eyebrow">{bundle ? "Combo trọn gói" : "Ưu đãi thanh toán"}</span>
          <h2 id={titleId}>{combo.name}</h2>
          <p>{combo.restaurantName || "Nhà hàng đang cập nhật"}</p>
          {combo.description && <p>{combo.description}</p>}
          <ul>{(combo.items || []).map((item) => <li key={`${item.menuItemId || item.name}-modal`}><strong>{item.qty}× {item.name}</strong>{item.price ? <em>{money(item.price)}đ</em> : null}</li>)}</ul>
          <div className="combo-modal__total"><strong>{money(combo.comboPrice ?? combo.originalPrice)}đ</strong>{combo.discountAmount > 0 && <span>Tiết kiệm {money(combo.discountAmount)}đ</span>}</div>
          <p className="combo-modal__note">
            {bundle ? "Combo này sẽ được thêm vào giỏ như một set món riêng." : "Ưu đãi này sẽ tự áp dụng ở bước thanh toán khi giỏ hàng đủ điều kiện."}
          </p>
          <div className="combo-modal__actions">
            {combo.restaurantId && <Link to={`/restaurant/${combo.restaurantId}`}>{bundle ? "Đến nhà hàng" : "Chọn món đủ điều kiện"}</Link>}
            {canAddBundle && <button type="button" onClick={() => onAdd(combo)} disabled={isAdding}>{isAdding ? "Đang thêm..." : "Thêm combo vào giỏ"}</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
