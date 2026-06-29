import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { ArrowLeft, Heart, Search, ShoppingBag, MapPin, Star, Trash2, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import { buildFoodDetailPath } from "@/utils/customerFoodNavigation";
import "./FavoritePage.scss";

const MY_FAVORITES = gql`
  query MyFavorites($type: String) {
    myFavorites(type: $type) {
      id
      type
      targetId
      createdAt
      restaurant {
        id
        name
        avatar
        coverImage
        avgRating
        reviewCount
        openingStatus
        address { line1 line2 ward district city }
      }
      food {
        id
        name
        basePrice
        thumbImage
        rate
        orderCounter
        restaurantId
        menuId
        categoryId
        status
      }
    }
  }
`;

const REMOVE_FAVORITE = gql`
  mutation RemoveFavorite($id: ID!) {
    removeFavorite(id: $id)
  }
`;

const TABS = [
  { id: "all", label: "Tất cả", Icon: Heart },
  { id: "restaurant", label: "Nhà hàng", Icon: MapPin },
  { id: "food", label: "Món ăn", Icon: ShoppingBag },
];

const FALLBACK_RESTAURANT_IMAGE = "/restaurant-placeholder.jpg";
const FALLBACK_FOOD_IMAGE = "/default-dishes.jpg";

const formatAddress = (address) => {
  const parts = [address?.line1, address?.line2, address?.ward, address?.district, address?.city]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "Địa chỉ đang cập nhật";
};

const normalizeFavorite = (favorite) => {
  if (favorite?.type === "restaurant" && favorite.restaurant) {
    const restaurant = favorite.restaurant;
    return {
      favoriteId: favorite.id,
      id: restaurant.id,
      type: "restaurant",
      name: restaurant.name || "Nhà hàng",
      image: restaurant.coverImage || restaurant.avatar || FALLBACK_RESTAURANT_IMAGE,
      rating: typeof restaurant.avgRating === "number" ? restaurant.avgRating.toFixed(1) : "—",
      reviews: restaurant.reviewCount || 0,
      address: formatAddress(restaurant.address),
      status: restaurant.openingStatus,
    };
  }

  if (favorite?.type === "food" && favorite.food) {
    const food = favorite.food;
    return {
      favoriteId: favorite.id,
      id: food.id,
      type: "food",
      name: food.name || "Món ăn",
      image: food.thumbImage || FALLBACK_FOOD_IMAGE,
      price: Number(food.basePrice || 0),
      rating: typeof food.rate === "number" ? food.rate.toFixed(1) : null,
      sold: food.orderCounter || 0,
      restaurantId: food.restaurantId,
      menuId: food.menuId,
      categoryId: food.categoryId,
      status: food.status,
    };
  }

  return null;
};

const FavoritePage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, loading, error, refetch } = useQuery(MY_FAVORITES, {
    variables: { type: activeTab === "all" ? null : activeTab },
    skip: !user?.id,
    fetchPolicy: "cache-and-network",
  });

  const [removeFavorite, { loading: removing }] = useMutation(REMOVE_FAVORITE, {
    onCompleted: () => {
      showNotification("Đã bỏ khỏi danh sách yêu thích.", "success");
      refetch?.();
    },
    onError: () => showNotification("Không thể bỏ yêu thích. Vui lòng thử lại.", "error"),
  });

  const rawFavorites = useMemo(() => (data?.myFavorites || []).map(normalizeFavorite).filter(Boolean), [data?.myFavorites]);

  const favorites = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return rawFavorites;
    return rawFavorites.filter((item) => [item.name, item.address].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword)));
  }, [rawFavorites, searchTerm]);

  const stats = useMemo(() => ({
    all: rawFavorites.length,
    restaurant: rawFavorites.filter((item) => item.type === "restaurant").length,
    food: rawFavorites.filter((item) => item.type === "food").length,
  }), [rawFavorites]);

  const handleRemove = (favoriteId) => {
    if (!favoriteId || removing) return;
    removeFavorite({ variables: { id: favoriteId } });
  };

  const openItem = (item) => {
    if (item.type === "restaurant") navigate(`/cus-menu?restaurantId=${encodeURIComponent(item.id)}`);
    if (item.type === "food") navigate(buildFoodDetailPath(item.id, { restaurantId: item.restaurantId, menuId: item.menuId, categoryId: item.categoryId }));
  };

  const openItemByKeyboard = (event, item) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openItem(item);
  };

  const showUnsupportedNote = activeTab === "all";

  return (
    <main className="favorite-page" aria-labelledby="favorite-title">
      <div className="fav-container">
        <section className="fav-hero" aria-labelledby="favorite-title">
          <div className="fav-hero__copy">
            <button type="button" className="fav-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={17} aria-hidden="true" /> Quay lại
            </button>
            <span className="fav-eyebrow"><Sparkles size={15} aria-hidden="true" /> Bộ sưu tập cá nhân</span>
            <h1 id="favorite-title">Danh sách yêu thích</h1>
            <p>Lưu lại nhà hàng và món ăn muốn quay lại, lọc nhanh để đặt món tiếp mà không phải tìm lại từ đầu.</p>
          </div>
          <div className="fav-summary" aria-label="Tổng quan yêu thích">
            <article><Heart aria-hidden="true" /><strong>{stats.all}</strong><span>Tổng mục</span></article>
            <article><MapPin aria-hidden="true" /><strong>{stats.restaurant}</strong><span>Nhà hàng</span></article>
            <article><ShoppingBag aria-hidden="true" /><strong>{stats.food}</strong><span>Món ăn</span></article>
          </div>
        </section>

        <section className="fav-toolbar" aria-label="Bộ lọc yêu thích">
          <label className="search-bar-mini">
            <Search size={18} aria-hidden="true" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm trong yêu thích..." aria-label="Tìm trong danh sách yêu thích" />
          </label>
          <div className="tabs-wrapper" role="tablist" aria-label="Lọc loại yêu thích">
            {TABS.map((tab) => {
              const Icon = tab.Icon;
              return (
                <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={`tab-pill ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                  <Icon size={18} aria-hidden="true" /><span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {showUnsupportedNote && <div className="unsupported-note" role="status">Đầu bếp và bộ sưu tập chưa hỗ trợ dữ liệu yêu thích thật.</div>}

        {loading ? (
          <div className="fav-grid" role="status" aria-busy="true" aria-live="polite" aria-label="Đang tải danh sách yêu thích">
            {Array.from({ length: 6 }).map((_, index) => <div className="fav-card skeleton-card" key={index}><div className="skeleton-image" /><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}
          </div>
        ) : error ? (
          <div className="empty-state error-state" role="alert"><div className="empty-icon"><Heart size={64} aria-hidden="true" /></div><h3>Không thể tải yêu thích</h3><p>Vui lòng kiểm tra kết nối và thử lại.</p><button className="btn-primary-outline" type="button" onClick={() => refetch?.()}>Tải lại</button></div>
        ) : favorites.length === 0 ? (
          <div className="empty-state" role="status"><div className="empty-icon"><Heart size={64} aria-hidden="true" /></div><h3>Chưa có mục yêu thích nào</h3><p>Hãy khám phá thêm và thả tim cho những món ngon nhé.</p></div>
        ) : (
          <div className="fav-grid">
            {favorites.map((item) => {
              const titleId = `favorite-title-${item.favoriteId}`;
              return (
                <article key={item.favoriteId} className="fav-card" aria-labelledby={titleId}>
                  <div className="card-image" onClick={() => openItem(item)} onKeyDown={(event) => openItemByKeyboard(event, item)} role="button" tabIndex={0} aria-label={`Mở ${item.name}`}>
                    <img src={item.image} alt={item.name} loading="lazy" />
                    <button className="btn-remove-fav" type="button" title="Bỏ yêu thích" aria-label={`Bỏ yêu thích ${item.name}`} onClick={(e) => { e.stopPropagation(); handleRemove(item.favoriteId); }} disabled={removing}>
                      <Trash2 size={16} color="#ff4d4f" aria-hidden="true" />
                    </button>
                    {item.status === "closed" && <div className="overlay-closed">Đã đóng cửa</div>}
                  </div>
                  <div className="card-info">
                    {item.type === "restaurant" ? <>
                      <div className="top-row"><h3 className="name" id={titleId}>{item.name}</h3><div className="rating" aria-label={`Đánh giá ${item.rating}`}><Star size={12} fill="#ffc107" color="#ffc107" aria-hidden="true" /> {item.rating}</div></div>
                      <p className="sub-text"><MapPin size={12} aria-hidden="true" /> {item.address}</p>
                      <div className="action-row"><button className="btn-primary-outline" type="button" onClick={() => openItem(item)}>Xem menu</button><button className="btn-primary-solid" type="button" onClick={() => navigate(`/restaurant/${item.id}`)}>Đến quán</button></div>
                    </> : <>
                      <div className="top-row"><h3 className="name" id={titleId}>{item.name}</h3></div>
                      <p className="sub-text">Món ăn yêu thích</p>
                      <div className="price-row"><span className="price">{item.price.toLocaleString("vi-VN")}đ</span>{item.rating && <span className="food-rating" aria-label={`Đánh giá ${item.rating}`}><Star size={12} fill="#ffc107" color="#ffc107" aria-hidden="true" /> {item.rating}</span>}</div>
                      <div className="action-row"><button className="btn-cart" type="button" onClick={() => openItem(item)}><Plus size={16} aria-hidden="true" /> Xem món</button></div>
                    </>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default FavoritePage;
