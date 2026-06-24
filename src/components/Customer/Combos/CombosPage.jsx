import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { useCart } from "@/context/CartProvider";
import { useNotification } from "@/hooks/useNotification";
import "./CombosPage.scss";

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

const ADD_CART_ITEM = gql`
  mutation AddComboItemToCart($input: AddCartItemInput!) {
    addCartItem(input: $input) {
      id
      items { id restaurantId menuItemId name price quantity thumbImage note servingVariantKey holdExpiresAt holdStatus }
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
  sourceType: [["", "tất cả"], ["COMBO", "combo cố định"], ["PROMOTION", "combo ưu đãi"]],
};

const normalizeFilter = (filter) => Object.fromEntries(
  Object.entries(filter).filter(([, value]) => value && value !== "unlimited"),
);

export default function CombosPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const { addToCart, refetchServerCart } = useCart();
  const { showNotification } = useNotification();
  const [filter, setFilter] = useState({ search: "", people: "", budget: "", sourceType: "" });
  const [selectedCombo, setSelectedCombo] = useState(null);
  const [addingComboId, setAddingComboId] = useState(null);
  const queryFilter = useMemo(() => ({ ...normalizeFilter(filter), onlyAvailable: true, limit: 36 }), [filter]);
  const { data, loading, error, refetch } = useQuery(CUSTOMER_COMBOS, {
    variables: { filter: queryFilter },
    fetchPolicy: "cache-and-network",
  });
  const [addCartItemMutation] = useMutation(ADD_CART_ITEM);
  const [addComboToCartMutation] = useMutation(ADD_COMBO_TO_CART);
  const combos = data?.customerCombos || [];
  const featured = combos.slice(0, 3);

  const updateFilter = (key, value) => setFilter((prev) => ({ ...prev, [key]: value }));

  const addComboItems = async (combo) => {
    if (combo?.sourceType === "COMBO") {
      if (!isAuthenticated || !user?.id) {
        showNotification("Vui lòng đăng nhập để thêm combo vào giỏ.", "warning");
        navigate("/login", { state: { from: "/combos" } });
        return;
      }
      setAddingComboId(combo.id);
      try {
        await addComboToCartMutation({ variables: { comboId: combo.id, quantity: 1 } });
        await refetchServerCart?.();
        showNotification("Đã thêm combo bundle vào giỏ.", "success");
      } catch (err) {
        showNotification(err?.message || "Không thể thêm combo vào giỏ.", "error");
      } finally {
        setAddingComboId(null);
      }
      return;
    }
    const items = (combo?.items || []).filter((item) => item.menuItemId && combo.restaurantId);
    if (!items.length) return;
    if (!isAuthenticated || !user?.id) {
      showNotification("Vui lòng đăng nhập để thêm món vào giỏ.", "warning");
      navigate("/login", { state: { from: "/combos" } });
      return;
    }
    setAddingComboId(combo.id);
    try {
      for (const item of items) {
        const price = Number(item.price || 0);
        const { data: mutationData } = await addCartItemMutation({
          variables: { input: {
            userId: user.id,
            restaurantId: String(combo.restaurantId),
            menuItemId: item.menuItemId,
            name: item.name,
            price,
            quantity: Number(item.qty || 1),
            thumbImage: item.imageUrl || combo.imageUrl || DEFAULT_IMAGE,
            note: `Từ combo: ${combo.name}`,
            servingVariantKey: "portion",
          } },
        });
        const returned = mutationData?.addCartItem?.items?.find((row) => String(row?.menuItemId) === String(item.menuItemId));
        addToCart({
          id: item.menuItemId,
          dishId: item.menuItemId,
          restaurantId: String(combo.restaurantId),
          servingVariantKey: returned?.servingVariantKey || "portion",
          name: item.name,
          price,
          image: item.imageUrl || combo.imageUrl || DEFAULT_IMAGE,
          method: "Phần tiêu chuẩn",
          quantity: Number(item.qty || 1),
          backendCartId: mutationData?.addCartItem?.id || null,
          backendCartItemId: returned?.id || null,
          holdExpiresAt: returned?.holdExpiresAt || null,
          holdStatus: returned?.holdStatus || null,
          note: returned?.note ?? `Từ combo: ${combo.name}`,
        });
      }
      await refetchServerCart?.();
      showNotification("Đã thêm các món trong combo vào giỏ.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể thêm combo vào giỏ. Vui lòng thử lại.", "error");
    } finally {
      setAddingComboId(null);
    }
  };

  const renderCard = (combo, featuredCard = false) => {
    const canAddItems = combo.restaurantId && combo.items?.some((item) => item.menuItemId);
    return (
      <article className={`combo-card${featuredCard ? " combo-card--featured" : ""}`} key={`${combo.sourceType}-${combo.id}`}>
        <div className="combo-card__image-wrap">
          <img src={combo.imageUrl || DEFAULT_IMAGE} alt={combo.name} className="combo-card__image" loading="lazy" />
          <span className="combo-card__badge">{combo.badge || (combo.sourceType === "PROMOTION" ? "Ưu đãi combo" : "Combo cố định")}</span>
        </div>
        <div className="combo-card__body">
          <p className="combo-card__eyebrow">{combo.sourceType === "PROMOTION" ? "Combo ưu đãi" : "Combo nhà hàng"}</p>
          <h3>{combo.name}</h3>
          <p className="combo-card__restaurant">{combo.restaurantName || "Nhà hàng đang cập nhật"}</p>
          <ul className="combo-card__items" aria-label={`Món trong ${combo.name}`}>
            {(combo.items || []).slice(0, 4).map((item) => <li key={`${combo.id}-${item.menuItemId || item.name}`}>{item.qty}× {item.name}</li>)}
          </ul>
          <div className="combo-card__price-row">
            <strong>{money(combo.comboPrice ?? combo.originalPrice)}đ</strong>
            {combo.originalPrice && combo.comboPrice && combo.originalPrice > combo.comboPrice && <span>{money(combo.originalPrice)}đ</span>}
          </div>
          {combo.discountAmount > 0 && <p className="combo-card__save">Tiết kiệm {money(combo.discountAmount)}đ</p>}
          <div className="combo-card__actions">
            <button type="button" className="combo-card__secondary" onClick={() => setSelectedCombo(combo)}>Xem combo</button>
            {canAddItems && (
              <button type="button" className="combo-card__primary" disabled={addingComboId === combo.id} onClick={() => addComboItems(combo)}>
                {addingComboId === combo.id ? "Đang thêm..." : combo.sourceType === "COMBO" ? "Thêm combo" : "Thêm món"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="combos-page" id="main-content">
      <section className="combos-hero" aria-labelledby="combos-title">
        <div>
          <span className="combos-hero__label">Cohan combo</span>
          <h1 id="combos-title">Combo tiết kiệm hôm nay</h1>
          <p>Chọn set món phù hợp bữa ăn, nhóm người và ngân sách của bạn.</p>
        </div>
        <Link className="combos-hero__link" to="/restaurants">Xem nhà hàng</Link>
      </section>

      <section className="combos-filter" aria-label="Bộ lọc combo">
        <label className="combos-filter__search">
          <span>Tìm combo</span>
          <input aria-label="Tìm combo" value={filter.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Tên combo, nhà hàng..." />
        </label>
        {Object.entries(filters).map(([key, options]) => (
          <label key={key}>
            <span>{key === "people" ? "Số người" : key === "budget" ? "Ngân sách" : "Loại"}</span>
            <select aria-label={key === "people" ? "Lọc theo số người" : key === "budget" ? "Lọc theo ngân sách" : "Lọc theo loại combo"} value={filter[key]} onChange={(e) => updateFilter(key, e.target.value)}>
              {options.map(([value, label]) => <option key={value || key} value={value}>{label}</option>)}
            </select>
          </label>
        ))}
      </section>

      {loading && !combos.length ? <SkeletonGrid /> : error ? (
        <section className="combos-state" role="alert"><h2>Không tải được combo</h2><p>Vui lòng thử lại sau ít phút.</p><button type="button" onClick={() => refetch()}>Thử lại</button></section>
      ) : combos.length ? (
        <>
          <section className="combos-section"><div className="combos-section__heading"><span>Combo nổi bật</span><h2>Set món đáng thử</h2></div><div className="combos-featured">{featured.map((combo) => renderCard(combo, true))}</div></section>
          <section className="combos-section"><div className="combos-section__heading"><span>Tất cả combo</span><h2>Chọn theo bữa ăn của bạn</h2></div><div className="combos-grid">{combos.map((combo) => renderCard(combo))}</div></section>
        </>
      ) : (
        <section className="combos-state"><h2>Chưa có combo phù hợp</h2><p>Bạn có thể xem nhà hàng hoặc để AI gợi ý món tương tự.</p><Link to="/restaurants">Xem nhà hàng</Link></section>
      )}

      {selectedCombo && <ComboModal combo={selectedCombo} onClose={() => setSelectedCombo(null)} onAdd={addComboItems} isAdding={addingComboId === selectedCombo.id} />}
    </main>
  );
}

function SkeletonGrid() {
  return <div className="combos-grid" aria-label="Đang tải combo">{Array.from({ length: 6 }).map((_, i) => <div className="combo-card combo-card--skeleton" key={i}><div /><span /><span /><span /></div>)}</div>;
}

function ComboModal({ combo, onClose, onAdd, isAdding }) {
  const canAddItems = combo.restaurantId && combo.items?.some((item) => item.menuItemId);
  return (
    <div className="combo-modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="combo-modal__panel" role="dialog" aria-modal="true" aria-label={`Chi tiết ${combo.name}`}>
        <button type="button" className="combo-modal__close" aria-label="Đóng chi tiết combo" onClick={onClose}>×</button>
        <img src={combo.imageUrl || DEFAULT_IMAGE} alt={combo.name} />
        <div className="combo-modal__content">
          <span>{combo.badge || "Combo"}</span>
          <h2>{combo.name}</h2>
          <p>{combo.restaurantName || "Nhà hàng đang cập nhật"}</p>
          {combo.description && <p>{combo.description}</p>}
          <ul>{(combo.items || []).map((item) => <li key={`${item.menuItemId || item.name}-modal`}><strong>{item.qty}×</strong> {item.name}{item.price ? <em>{money(item.price)}đ</em> : null}</li>)}</ul>
          <div className="combo-modal__total"><strong>{money(combo.comboPrice ?? combo.originalPrice)}đ</strong>{combo.discountAmount > 0 && <span>Tiết kiệm {money(combo.discountAmount)}đ</span>}</div>
          <p className="combo-modal__note">Combo này gồm nhiều món, bạn có thể kiểm tra trước khi thêm.</p>
          <div className="combo-modal__actions">
            {combo.restaurantId && <Link to={`/restaurant/${combo.restaurantId}`}>Đến nhà hàng</Link>}
            {canAddItems && <button type="button" onClick={() => onAdd(combo)} disabled={isAdding}>{isAdding ? "Đang thêm..." : combo.sourceType === "COMBO" ? "Thêm combo vào giỏ" : "Thêm món vào giỏ"}</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
