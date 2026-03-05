import React, { useState, useMemo } from "react";
import { Check, CheckCircle2, Trash2, Bell, CheckCheck } from "lucide-react";
import "./NotificationsPage.scss";

// Dùng chung mock data (thêm vài dòng để test cho trực quan)
const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    image: "https://cdn-icons-png.flaticon.com/512/7541/7541900.png",
    text: "Đơn hàng #DH001 của bạn đã được giao thành công. Chúc bạn ngon miệng!",
    time: "5 phút trước",
    isRead: false,
    type: "order",
  },
  {
    id: 2,
    image: "https://cdn-icons-png.flaticon.com/512/879/879757.png",
    text: "Mã giảm giá 'SALE50' sắp hết hạn vào ngày mai. Sử dụng ngay!",
    time: "1 giờ trước",
    isRead: false,
    type: "promotion",
  },
  {
    id: 3,
    image: "https://cdn-icons-png.flaticon.com/512/1046/1046857.png",
    text: "Nhà hàng Pizza Company vừa thêm món mới. Khám phá ngay!",
    time: "2 giờ trước",
    isRead: true,
    type: "system",
  },
  {
    id: 4,
    image: "https://cdn-icons-png.flaticon.com/512/7541/7541900.png",
    text: "Đơn hàng #DH002 đang được chuẩn bị.",
    time: "1 ngày trước",
    isRead: true,
    type: "order",
  },
];

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState("all"); // 'all' hoặc 'unread'

  // Lọc thông báo dựa trên tab đang chọn
  const displayedNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notif) => !notif.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  // Đếm số lượng chưa đọc
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Xử lý: Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, isRead: true })),
    );
  };

  // Xử lý: Click vào 1 thông báo để đánh dấu đã đọc
  const handleMarkAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif,
      ),
    );
  };

  // Xử lý: Xóa 1 thông báo
  const handleDelete = (id, e) => {
    e.stopPropagation(); // Ngăn chặn sự kiện click lan ra ngoài thẻ cha (tránh trigger handleMarkAsRead)
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  return (
    <div className="notifications-page">
      <div className="notif-container">
        {/* HEADER GIAO DIỆN */}
        <div className="notif-header">
          <div className="title-wrapper">
            <h1>Thông báo của bạn</h1>
            {unreadCount > 0 && (
              <span className="badge">{unreadCount} mới</span>
            )}
          </div>

          <button
            className="btn-mark-all"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={18} />
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        {/* TABS LỌC THÔNG BÁO */}
        <div className="notif-tabs">
          <button
            className={`tab-item ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`tab-item ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Chưa đọc
          </button>
        </div>

        {/* DANH SÁCH THÔNG BÁO */}
        <div className="notif-list">
          {displayedNotifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Bell size={48} />
              </div>
              <h3>Không có thông báo nào</h3>
              <p>Bạn đã xem hết tất cả các thông báo.</p>
            </div>
          ) : (
            displayedNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`notif-card ${!notif.isRead ? "unread" : ""}`}
                onClick={() => handleMarkAsRead(notif.id)}
              >
                <div className="notif-icon">
                  <img src={notif.image} alt="icon" />
                </div>

                <div className="notif-content">
                  <p className="notif-text">{notif.text}</p>
                  <span className="notif-time">{notif.time}</span>
                </div>

                <div className="notif-actions">
                  {!notif.isRead && <div className="dot-unread"></div>}

                  <button
                    className="btn-delete"
                    onClick={(e) => handleDelete(notif.id, e)}
                    title="Xóa thông báo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
