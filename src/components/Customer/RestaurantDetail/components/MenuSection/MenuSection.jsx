import React, { useMemo, useState, useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import "./MenuSection.scss";
import Cart from "../../../../Customer/Homepage_Client/components/Cart";
import { useCart } from "../../../../../context/CartProvider";
import { useCustomerCartActions } from "../../../../../hooks/useCustomerCartActions";
import { ShoppingCart, ChevronDown } from "lucide-react";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { buildFoodDetailPath, buildFoodDetailState } from "../../../../../utils/customerFoodNavigation";
import { getCannotOrderReason } from "../../../../../utils/restaurantStatus";
import { getMenuItemAvailability, canCustomerOrderMenuItem } from "../../../../../utils/menuItemAvailability";

const formatPrice = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0);

const GET_CATEGORIES = gql`query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) { customerMenuCategories(restaurantId: $restaurantId, timeSlot: $timeSlot) { id name order isActive } }`;
const GET_MENU_ITEMS_BY_CATEGORY = gql`
query GetMenuItemsByCategory($restaurantId: ID!, $timeSlot: TimeSlot!, $categoryId: ID!, $search: String, $sort: String, $limit: Int = 20, $cursor: ID) {
  menuItemsConnection(limit: $limit, cursor: $cursor, filter: { restaurantId: $restaurantId, timeSlot: $timeSlot, categoryId: $categoryId, search: $search, sort: $sort }) {
    edges { node { id restaurantId menuId categoryId name description basePrice byWeight thumbImage status inventoryStatus stockWarnings maxAvailable avgPrepTimeMin servingVariants { key mode yieldQty yieldUnit name price } } cursor }
    pageInfo { endCursor hasNextPage }
  }
}`;
const GET_FOOD_REVIEWS = gql`query GetFoodReviewsByRestaurant($restaurantId: ID!, $limit: Int = 500) { reviews(restaurantId: $restaurantId, targetType: "food", status: "published", limit: $limit, skip: 0) { items { targetId rating } } }`;

const MenuSection = ({ restaurantId, restaurant, canOrder: canOrderProp, openingStatus: openingStatusProp }) => {
  const navigate = useNavigate();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("breakfast");
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");

  useEffect(() => { const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300); return () => window.clearTimeout(t); }, [searchInput]);
  useEffect(() => { setMenuItems([]); setCursor(null); setHasNextPage(false); }, [debouncedSearch, sortBy, activeCategory, selectedTimeSlot]);

  const { cart, updateQuantity, removeFromCart, clearCart, removeRestaurantItems, getTotalItems, getTotalPrice } = useCart();
  const { updateCartItemQuantity, removeCartLineItem, clearCustomerCart, removeRestaurantScopedItems, isBusy, busyItemIds, busyRestaurantIds, isClearing } = useCustomerCartActions({ cart, updateQuantity, removeFromCart, clearCart, removeRestaurantItems });

  const { data: categoriesData, loading: catLoading } = useQuery(GET_CATEGORIES, { variables: { restaurantId, timeSlot: selectedTimeSlot }, skip: !restaurantId, fetchPolicy: "network-only" });
  useEffect(() => { const next = (categoriesData?.customerMenuCategories || []).filter((c) => c?.id && c.isActive !== false); setCategories(next); setActiveCategory((prev) => (prev && next.some((c) => String(c.id) === String(prev)) ? prev : next[0]?.id || null)); }, [categoriesData]);

  const queryVars = activeCategory ? { restaurantId, timeSlot: selectedTimeSlot, categoryId: activeCategory, search: debouncedSearch || null, sort: sortBy, cursor: null, limit: 20 } : undefined;
  const { data: menuData, loading: menuLoading, error: menuError, fetchMore } = useQuery(GET_MENU_ITEMS_BY_CATEGORY, { variables: queryVars, skip: !activeCategory, fetchPolicy: "network-only" });
  const { data: foodReviewsData } = useQuery(GET_FOOD_REVIEWS, { variables: { restaurantId, limit: 500 }, skip: !restaurantId, fetchPolicy: "cache-first" });

  const foodReviewMap = useMemo(() => { const map = new Map(); (foodReviewsData?.reviews?.items || []).forEach((r) => { const key = String(r.targetId); const cur = map.get(key) || { total: 0, sum: 0 }; cur.total += 1; cur.sum += Number(r.rating || 0); map.set(key, cur); }); return map; }, [foodReviewsData]);

  useEffect(() => {
    if (!menuData?.menuItemsConnection) return;
    const nodes = menuData.menuItemsConnection.edges.map((e) => e.node);
    setMenuItems(nodes);
    setSelectedVariants((prev) => { const next = { ...prev }; for (const it of nodes) if (!next[it.id] && it.servingVariants?.length) next[it.id] = it.servingVariants[0].key; return next; });
    setCursor(menuData.menuItemsConnection.pageInfo?.endCursor || null);
    setHasNextPage(!!menuData.menuItemsConnection.pageInfo?.hasNextPage);
  }, [menuData]);

  const resolvedCanOrder = typeof canOrderProp === "boolean" ? canOrderProp : !!restaurant?.canOrder;
  const cannotOrderReason = getCannotOrderReason(openingStatusProp || restaurant?.openingStatus);
  const isDishOrderable = (item) => resolvedCanOrder && canCustomerOrderMenuItem(item);

  const loadMoreItems = () => { if (!hasNextPage || !cursor) return; fetchMore({ variables: { ...queryVars, cursor, limit: 20 } }); };
  const handleTimeSlotChange = (slot) => { if (slot !== selectedTimeSlot) { setSelectedTimeSlot(slot); setActiveCategory(null); } };
  const handleCategoryChange = (catId) => { if (catId !== activeCategory) setActiveCategory(catId); };
  const handleVariantChange = (itemId, variantKey) => setSelectedVariants((prev) => ({ ...prev, [itemId]: variantKey }));
  const openFoodDetail = (item) => {
    if (!isDishOrderable(item) || !item?.id) return;
    const state = buildFoodDetailState(item, { restaurantId, timeSlot: selectedTimeSlot, categoryId: item?.categoryId || activeCategory || null, selectedVariantKey: selectedVariants[item.id] || item.servingVariants?.[0]?.key || null });
    navigate(buildFoodDetailPath(item.id, state), { state });
  };

  return <div className="menu-section">{/* trimmed unchanged render */}
    <div className="time-slot-tabs">{[{id:"breakfast",label:"🍳 Sáng"},{id:"lunch",label:"🍱 Trưa"},{id:"dinner",label:"🍷 Tối"},{id:"late_night",label:"🌙 Khuya"}].map((slot)=><button key={slot.id} type="button" className={`slot-btn ${selectedTimeSlot===slot.id?"active":""}`} onClick={()=>handleTimeSlotChange(slot.id)}>{slot.label}</button>)}</div>
    <div className="menu-layout"><aside className="category-sidebar"><h3 className="sidebar-header">Thực đơn</h3><div className="category-list">{catLoading?<LoadingSpinner size="small"/>:categories.map((cat)=><button key={cat.id} type="button" className={`category-item ${activeCategory===cat.id?"active":""}`} onClick={()=>handleCategoryChange(cat.id)}>{cat.name}</button>)}</div></aside>
    <main className="menu-content"><div className="menu-toolbar"><input aria-label="Tìm món" value={searchInput} onChange={(e)=>setSearchInput(e.target.value)} placeholder="Tìm món..."/><select aria-label="Sắp xếp món" value={sortBy} onChange={(e)=>setSortBy(e.target.value)}><option value="default">Mặc định</option><option value="name_asc">Tên A-Z</option><option value="price_asc">Giá thấp-cao</option><option value="price_desc">Giá cao-thấp</option></select></div>
    {menuLoading && !menuItems.length ? <div className="loading-state"><LoadingSpinner size="large"/></div> : menuError ? <div className="empty-state" role="alert"><p>Không tải được danh sách món. Vui lòng thử lại.</p></div> : menuItems.length ? <div className="dish-list">{menuItems.map((item)=>{const variants=item.servingVariants||[];const selectedKey=selectedVariants[item.id]||variants[0]?.key;const currentVariant=variants.find((v)=>v.key===selectedKey)||variants[0];const availability=getMenuItemAvailability(item);const orderable=isDishOrderable(item);const review=foodReviewMap.get(String(item.id));return <div key={item.id} className={`dish-card-horizontal ${orderable?"":"is-disabled"}`} onClick={()=>openFoodDetail(item)} role={orderable?"button":undefined} tabIndex={orderable?0:-1} aria-disabled={!orderable||undefined} onKeyDown={(e)=>{if(orderable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openFoodDetail(item);}}}><div className="dish-img-wrapper"><img src={item.thumbImage||"/default-dishes.jpg"} alt={item.name} loading="lazy"/></div><div className="dish-info"><div className="info-top"><div className="header-row"><div className="dish-head-main"><h4 className="dish-name">{item.name}</h4>{review&&<div className="dish-rating">⭐ {(review.sum/review.total).toFixed(1)} ({review.total})</div>}</div><span className="price">{formatPrice(currentVariant?.price ?? item.basePrice)}</span></div><p className="dish-desc">{item.description}</p><span className={`availability-badge ${availability.badgeClassName}`}>{availability.label}</span></div><div className="info-bottom"><div className="variant-control" onClick={(e)=>e.stopPropagation()}>{variants.length>1?<div className="custom-select-wrapper"><select className="variant-select" value={selectedKey} onChange={(e)=>handleVariantChange(item.id,e.target.value)}>{variants.map((v)=><option key={v.key} value={v.key}>{v.name}</option>)}</select><ChevronDown size={14} className="arrow-icon"/></div>:null}</div><button type="button" className="btn-add" disabled={!orderable} onClick={(e)=>{e.stopPropagation();openFoodDetail(item);}}>Chọn món</button></div></div></div>;})}{hasNextPage&&<button type="button" className="btn-load-more" onClick={loadMoreItems} disabled={menuLoading}>{menuLoading?"Đang tải...":"Xem thêm"}</button>}</div> : <div className="empty-state"><span className="icon">🍽️</span><p>Chưa có món ăn phù hợp.</p></div>}
    </main></div>
    {!resolvedCanOrder && <div className="menu-order-status-warning" role="status">{cannotOrderReason}</div>}
    <button type="button" className="cart-fab" onClick={() => setIsCartOpen(true)}><ShoppingCart size={24}/>{getTotalItems()>0&&<span className="count">{getTotalItems()}</span>}</button>
    <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} onUpdateQuantity={updateCartItemQuantity} totalPrice={getTotalPrice()} onClearCart={clearCustomerCart} onRemoveRestaurantItems={removeRestaurantScopedItems} onRemoveItem={removeCartLineItem} isBusy={isBusy} busyItemIds={busyItemIds} busyRestaurantIds={busyRestaurantIds} isClearing={isClearing} />
  </div>;
};

export default MenuSection;
