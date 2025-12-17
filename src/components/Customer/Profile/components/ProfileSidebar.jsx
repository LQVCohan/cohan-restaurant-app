import React, { useRef } from "react";
import { useAvatarUploadLocal } from "@/hooks/useAvatarUploadLocal";
import "./ProfileSidebar.scss";

const ProfileSidebar = ({ user, activeTab, setActiveTab, isEditMode }) => {
  const fileInputRef = useRef(null);

  const { preview, handleFileChange } = useAvatarUploadLocal();

  const displayAvatar =
    preview ||
    user.avatarUrl ||
    `https://ui-avatars.com/api/?name=${user.fullName}&background=ff6600&color=fff`;

  // Tính % để lên hạng (Ví dụ demo)
  const progressPercent = Math.min(
    ((user.loyaltyPoints || 0) / 1000) * 100,
    100
  );

  return (
    <aside className="profile-sidebar">
      {/* 1. USER CARD VỚI ẢNH BÌA */}
      <div className="user-card-pro">
        <div className="card-cover"></div> {/* Ảnh bìa gradient */}
        <div className="card-content">
          <div className="avatar-area">
            <div className="avatar-ring">
              <img src={displayAvatar} alt="Avatar" className="user-avatar" />
            </div>
            {isEditMode && (
              <button
                className="avatar-edit-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                📷
              </button>
            )}
            <input
              type="file"
              hidden
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <h3 className="user-name">{user.fullName || user.username}</h3>
          <span className="user-email">{user.email}</span>

          {/* Badge Role */}
          <div className="user-badge">
            <span className="badge-icon">👑</span>
            <span>{user.roleName || "Thành viên thân thiết"}</span>
          </div>
        </div>
      </div>

      {/* 2. MEMBERSHIP CARD (HIỂN THỊ ĐIỂM ĐẸP HƠN) */}
      <div className="membership-card">
        <div className="mem-header">
          <span>Điểm tích lũy</span>
          <span className="rank">GOLD MEMBER</span>
        </div>
        <div className="mem-points">
          {user.loyaltyPoints || 0} <span>pts</span>
        </div>
        <div className="mem-progress">
          <div className="bar" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <p className="mem-note">
          Cần thêm {1000 - (user.loyaltyPoints || 0)} điểm để lên hạng Diamond
        </p>
      </div>

      {/* 3. NAVIGATION */}
      <nav className="profile-nav-pro">
        {[
          {
            id: "info",
            label: "Thông tin tài khoản",
            icon: "👤",
            desc: "Chỉnh sửa thông tin cá nhân",
          },
          {
            id: "preferences",
            label: "Khẩu vị & Ăn uống",
            icon: "🥗",
            desc: "Thiết lập chế độ ăn, dị ứng",
          },
          {
            id: "orders",
            label: "Lịch sử đơn hàng",
            icon: "🛍️",
            desc: "Xem lại các đơn đã đặt",
          },
          {
            id: "security",
            label: "Bảo mật & Riêng tư",
            icon: "🛡️",
            desc: "Đổi mật khẩu, 2FA",
          },
        ].map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            onClick={() => setActiveTab(item.id)}
          >
            <div className="nav-icon">{item.icon}</div>
            <div className="nav-text">
              <span className="label">{item.label}</span>
              <span className="desc">{item.desc}</span>
            </div>
            <div className="nav-arrow">›</div>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default ProfileSidebar;
