import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Bell, CheckCheck, Sparkles } from "lucide-react";
import "./NotificationsPage.scss";
import { useCustomerNotifications } from "@/context/CustomerNotificationContext";

const NotificationsPage = () => {
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useCustomerNotifications();

  const displayedNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notif) => !notif.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const handleOpenNotification = async (notif) => {
    await markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const handleCardKeyDown = (event, notif) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleOpenNotification(notif);
  };

  return (
    <main className="notifications-page" aria-labelledby="notifications-title">
      <div className="notif-container">
        <section className="notif-header" aria-labelledby="notifications-title">
          <div className="title-wrapper">
            <button type="button" className="notif-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={17} aria-hidden="true" /> Quay lại
            </button>
            <span className="notif-eyebrow"><Sparkles size={15} aria-hidden="true" /> Trung tâm thông báo</span>
            <h1 id="notifications-title">Thông báo của bạn</h1>
            <p>Theo dõi trạng thái đơn hàng, đặt bàn và các cập nhật quan trọng từ nhà hàng.</p>
            {unreadCount > 0 && <span className="badge" role="status">{unreadCount} mới</span>}
          </div>

          <button
            type="button"
            className="btn-mark-all"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={18} aria-hidden="true" />
            Đánh dấu tất cả đã đọc
          </button>
        </section>

        <div className="notif-tabs" role="tablist" aria-label="Lọc thông báo">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`tab-item ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tất cả
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unread"}
            className={`tab-item ${filter === "unread" ? "active" : ""}`}
            onClick={() => setFilter("unread")}
          >
            Chưa đọc
          </button>
        </div>

        <section className="notif-list" aria-live="polite" aria-label="Danh sách thông báo">
          {displayedNotifications.length === 0 ? (
            <div className="empty-state" role="status">
              <div className="empty-icon" aria-hidden="true">
                <Bell size={48} aria-hidden="true" />
              </div>
              <h2>Không có thông báo nào</h2>
              <p>{filter === "unread" ? "Bạn không còn thông báo chưa đọc." : "Bạn đã xem hết tất cả các thông báo."}</p>
            </div>
          ) : (
            <div role="list" className="notif-list__items">
              {displayedNotifications.map((notif) => (
                <article
                  key={notif.id}
                  className={`notif-card ${!notif.isRead ? "unread" : ""}`}
                  onClick={() => handleOpenNotification(notif)}
                  role="listitem"
                  tabIndex={0}
                  onKeyDown={(event) => handleCardKeyDown(event, notif)}
                  aria-label={`${notif.isRead ? "Đã đọc" : "Chưa đọc"}: ${notif.text}`}
                >
                  <div className="notif-icon" aria-hidden="true">
                    <img src={notif.image} alt="" />
                  </div>

                  <div className="notif-content">
                    <p className="notif-text">{notif.text}</p>
                    <span className="notif-time">{notif.time}</span>
                  </div>

                  <div className="notif-actions">
                    {!notif.isRead && <div className="dot-unread" aria-hidden="true" />}

                    <button
                      type="button"
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      title="Ẩn thông báo"
                      aria-label={`Ẩn thông báo: ${notif.text}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default NotificationsPage;
