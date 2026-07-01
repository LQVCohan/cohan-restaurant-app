import React, { useEffect, useRef, useState } from "react";
import { compressAvatar } from "@/utils/compressAvatar";
import "./ProfileSidebar.scss";

const ProfileSidebar = ({
  user,
  activeTab,
  setActiveTab,
  isEditMode,
  onAvatarChange,
}) => {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [processingAvatar, setProcessingAvatar] = useState(false);

  useEffect(() => {
    if (isEditMode) return undefined;

    setPreview((currentPreview) => {
      if (currentPreview) URL.revokeObjectURL(currentPreview);
      return null;
    });
    onAvatarChange?.(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    return undefined;
  }, [isEditMode, onAvatarChange]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessingAvatar(true);
    try {
      const resizedFile = await compressAvatar(file);
      const objectUrl = URL.createObjectURL(resizedFile);
      setPreview((currentPreview) => {
        if (currentPreview) URL.revokeObjectURL(currentPreview);
        return objectUrl;
      });
      onAvatarChange?.(resizedFile);
    } catch (error) {
      alert(error.message);
      event.target.value = "";
    } finally {
      setProcessingAvatar(false);
    }
  };

  const displayAvatar =
    preview ||
    user.avatarUrl ||
    `https://ui-avatars.com/api/?name=${user.fullName}&background=ff6600&color=fff`;

  const progressPercent = Math.min(((user.loyaltyPoints || 0) / 1000) * 100, 100);

  const navItems = [
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
      id: "wallet",
      label: "Ví điện tử",
      icon: "💳",
      desc: user?.wallet ? "Số dư, nạp ví, giao dịch" : "Tạo ví Cohan để thanh toán nhanh",
    },
    {
      id: "security",
      label: "Bảo mật & Riêng tư",
      icon: "🛡️",
      desc: "Đổi mật khẩu, 2FA",
    },
  ];

  return (
    <aside className="profile-sidebar">
      <div className="user-card-pro">
        <div className="card-cover"></div>
        <div className="card-content">
          <div className="avatar-area">
            <div className="avatar-ring">
              <img
                src={displayAvatar}
                alt="Avatar"
                className="user-avatar"
                width="120"
                height="120"
                decoding="async"
              />
            </div>
            {isEditMode && (
              <button
                className="avatar-edit-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={processingAvatar}
                title={processingAvatar ? "Đang tối ưu ảnh..." : "Đổi ảnh đại diện"}
              >
                {processingAvatar ? "…" : "📷"}
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

          <div className="user-badge">
            <span className="badge-icon">👑</span>
            <span>{user.roleName || "Thành viên thân thiết"}</span>
          </div>
        </div>
      </div>

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

      <nav className="profile-nav-pro">
        {navItems.map((item) => (
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