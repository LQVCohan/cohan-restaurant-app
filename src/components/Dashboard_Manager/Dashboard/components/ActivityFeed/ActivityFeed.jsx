import React from "react";
import {
  ShoppingBag,
  CreditCard,
  Star,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import "./ActivityFeed.scss";

const ActivityFeed = () => {
  const activities = [
    {
      id: 1,
      type: "order",
      text: (
        <>
          Đơn hàng mới <span className="highlight-gold">#ORD-009</span> từ bàn
          12
        </>
      ),
      time: "2 phút trước",
      desc: "Combo Sashimi thượng hạng, Rượu Sake...",
    },
    {
      id: 2,
      type: "payment",
      text: (
        <>
          Thanh toán thành công <strong>2.500.000đ</strong>
        </>
      ),
      time: "15 phút trước",
      desc: "Qua chuyển khoản ngân hàng.",
    },
    {
      id: 3,
      type: "review",
      text: (
        <>
          Khách hàng <strong>Nguyễn Văn A</strong> đánh giá 5 sao
        </>
      ),
      time: "1 giờ trước",
      desc: '"Món ăn tuyệt vời, phục vụ rất chu đáo!"',
    },
    {
      id: 4,
      type: "alert",
      text: (
        <>
          Cảnh báo: Hết nguyên liệu <strong>Bào Ngư</strong>
        </>
      ),
      time: "3 giờ trước",
      desc: "Vui lòng nhập kho ngay.",
    },
  ];

  const getIcon = (type) => {
    switch (type) {
      case "order":
        return <ShoppingBag size={18} />;
      case "payment":
        return <CreditCard size={18} />;
      case "review":
        return <Star size={18} />;
      case "alert":
        return <AlertCircle size={18} />;
      default:
        return <ShoppingBag size={18} />;
    }
  };

  return (
    <div className="activity-feed-wrapper fade-in">
      <div className="activity-header">
        <div className="title-group">
          <h3 className="activity-title">Hoạt Động Gần Đây</h3>
          <span className="notification-badge">4 Mới</span>
        </div>
        <button className="view-all-btn">
          Xem tất cả <ChevronRight size={16} />
        </button>
      </div>

      <ul className="activity-list">
        {activities.map((item) => (
          <li key={item.id} className="activity-item">
            <div className="timeline-connector">
              <div className={`icon-circle type-${item.type}`}>
                {getIcon(item.type)}
              </div>
              <div className="timeline-line"></div>
            </div>

            <div className="activity-content">
              <div className="content-header">
                <p className="activity-text">{item.text}</p>
                <span className="activity-time">{item.time}</span>
              </div>
              {item.desc && <p className="activity-desc">{item.desc}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActivityFeed;
