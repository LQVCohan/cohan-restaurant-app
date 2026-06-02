import React from "react";
import "./ReviewsNavTabs.scss";

const tabs = [
  { key: "all", label: "Tất cả đánh giá" },
  { key: "restaurant", label: "Nhà hàng" },
  { key: "food", label: "Món ăn" },
  { key: "service", label: "Dịch vụ" },
  { key: "reported", label: "Đang xem xét", hasBadge: true },
];

const ReviewsNavTabs = ({ currentTab, onChangeTab, underReviewCount = 0 }) => {
  return (
    <nav className="reviews-nav-tabs">
      <div className="reviews-nav-tabs__list">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={
              "reviews-nav-tabs__tab" +
              (currentTab === tab.key ? " reviews-nav-tabs__tab--active" : "")
            }
            onClick={() => onChangeTab(tab.key)}
            type="button"
          >
            {tab.label}
            {tab.hasBadge && (
              <span className="reviews-nav-tabs__tab-badge">
                {underReviewCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default ReviewsNavTabs;
