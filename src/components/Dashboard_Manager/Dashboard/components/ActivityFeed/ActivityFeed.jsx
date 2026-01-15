import React from "react";
import {
  ShoppingBag,
  CreditCard,
  Star,
  AlertCircle,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import "./ActivityFeed.scss";

const ActivityFeed = () => {
  const activities = [
    {
      id: 1,
      type: "order",
      title: "Đơn hàng mới",
      highlight: "#ORD-009",
      subInfo: "Bàn 12",
      time: "2 phút trước",
      desc: "Combo Sashimi thượng hạng, Rượu Sake...",
    },
    {
      id: 2,
      type: "payment",
      title: "Thanh toán",
      highlight: "2.500.000đ",
      subInfo: "Thành công",
      time: "15 phút trước",
      desc: "Qua chuyển khoản ngân hàng (Techcombank).",
    },
    {
      id: 3,
      type: "review",
      title: "Đánh giá mới",
      highlight: "5 sao",
      subInfo: "Nguyễn Văn A",
      time: "1 giờ trước",
      desc: '"Món ăn tuyệt vời, phục vụ rất chu đáo!"',
    },
    {
      id: 4,
      type: "alert",
      title: "Cảnh báo kho",
      highlight: "Hết Bào Ngư",
      subInfo: "Bếp lạnh",
      time: "3 giờ trước",
      desc: "Vui lòng nhập kho ngay để phục vụ tối nay.",
    },
    {
      id: 5,
      type: "order",
      title: "Đơn hàng mới",
      highlight: "#ORD-008",
      subInfo: "Bàn VIP 1",
      time: "4 giờ trước",
      desc: "Set bò Wagyu dát vàng, Rượu vang đỏ...",
    },
  ];

  const getConfig = (type) => {
    switch (type) {
      case "order":
        return { icon: <ShoppingBag size={18} />, colorClass: "blue" };
      case "payment":
        return { icon: <CreditCard size={18} />, colorClass: "green" };
      case "review":
        return { icon: <Star size={18} />, colorClass: "gold" };
      case "alert":
        return { icon: <AlertCircle size={18} />, colorClass: "red" };
      default:
        return { icon: <ShoppingBag size={18} />, colorClass: "gray" };
    }
  };

  return (
    <div className="dashboard-widget activity-feed">
      {/* Header Widget */}
      <div className="widget-header">
        <div className="header-title">
          <h3>Hoạt Động Gần Đây</h3>
          <span className="badge-pulse">Live</span>
        </div>
        <button className="btn-icon">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Scrollable List */}
      <div className="widget-content custom-scrollbar">
        <ul className="timeline">
          {activities.map((item) => {
            const { icon, colorClass } = getConfig(item.type);
            return (
              <li key={item.id} className={`timeline-item ${colorClass}`}>
                {/* Cột mốc thời gian bên trái */}
                <div className="timeline-marker">
                  <div className="marker-icon">{icon}</div>
                  <div className="marker-line"></div>
                </div>

                {/* Nội dung chính */}
                <div className="timeline-content">
                  <div className="content-top">
                    <div className="meta-info">
                      <span className="activity-type">{item.title}</span>
                      <span className="dot-separator">•</span>
                      <span className="activity-time">{item.time}</span>
                    </div>
                  </div>

                  <div className="main-info">
                    <span className="highlight-text">{item.highlight}</span>
                    {item.subInfo && (
                      <span className="sub-text"> — {item.subInfo}</span>
                    )}
                  </div>

                  {item.desc && <p className="description">{item.desc}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer Action */}
      <div className="widget-footer">
        <button className="btn-view-all">
          Xem tất cả lịch sử <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default ActivityFeed;
