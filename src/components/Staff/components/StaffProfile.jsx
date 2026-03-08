import React, { useState } from "react";
import {
  ChefHat,
  Banknote,
  ChevronRight,
  LogOut,
  User,
  History,
  Bell,
  Moon,
  HelpCircle,
  Shield,
  Edit3,
  Clock,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";
import "./StaffProfile.scss";

export default function StaffProfile() {
  // Demo state cho các cài đặt nhanh
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="staff-pos-profile">
      {/* Thẻ Header - Thông tin nhân viên */}
      <div className="profile-header-card">
        <button className="btn-edit-profile" aria-label="Chỉnh sửa hồ sơ">
          <Edit3 size={18} />
        </button>

        <div className="avatar-wrapper">
          <div className="avatar">
            <ChefHat size={40} className="text-primary" />
          </div>
          <span className="status-badge online">Đang ca làm</span>
        </div>

        <div className="user-info">
          <h2>Nguyễn Văn B</h2>
          <div className="role-tags">
            <span className="tag-role">
              <Shield size={12} /> Nhân viên Order
            </span>
            <span className="tag-shift">Ca Sáng</span>
          </div>
          <p className="contact-info">0901 234 567 • nguyenvanb@pos.vn</p>
        </div>
      </div>

      {/* Thống kê nhanh trong ca */}
      <div className="shift-stats-grid">
        <div className="stat-card">
          <div className="icon-wrap bg-blue">
            <ShoppingBag size={20} />
          </div>
          <div className="stat-info">
            <span className="val">24</span>
            <span className="label">Đơn phục vụ</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-wrap bg-orange">
            <TrendingUp size={20} />
          </div>
          <div className="stat-info">
            <span className="val">4.5M</span>
            <span className="label">Doanh số ca</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-wrap bg-green">
            <Clock size={20} />
          </div>
          <div className="stat-info">
            <span className="val">06:30</span>
            <span className="label">Giờ Check-in</span>
          </div>
        </div>
      </div>

      {/* Danh sách Menu Quản lý */}
      <div className="settings-container">
        {/* Nhóm 1: Công việc & Tài khoản */}
        <div className="menu-group">
          <h4 className="group-title">Công việc & Tài khoản</h4>
          <div className="menu-list">
            <button className="menu-item">
              <div className="item-left">
                <div className="menu-icon text-blue">
                  <User size={20} />
                </div>
                <span>Thông tin cá nhân</span>
              </div>
              <ChevronRight size={18} className="icon-right" />
            </button>
            <button className="menu-item">
              <div className="item-left">
                <div className="menu-icon text-green">
                  <Banknote size={20} />
                </div>
                <span>Lương & Thưởng</span>
              </div>
              <ChevronRight size={18} className="icon-right" />
            </button>
            <button className="menu-item">
              <div className="item-left">
                <div className="menu-icon text-orange">
                  <History size={20} />
                </div>
                <span>Lịch sử ca làm việc</span>
              </div>
              <ChevronRight size={18} className="icon-right" />
            </button>
          </div>
        </div>

        {/* Nhóm 2: Cài đặt ứng dụng */}
        <div className="menu-group">
          <h4 className="group-title">Cài đặt ứng dụng</h4>
          <div className="menu-list">
            <div className="menu-item">
              <div className="item-left">
                <div className="menu-icon text-purple">
                  <Bell size={20} />
                </div>
                <span>Nhận thông báo</span>
              </div>
              <div
                className={`toggle-switch ${notifications ? "on" : "off"}`}
                onClick={() => setNotifications(!notifications)}
              >
                <div className="toggle-knob"></div>
              </div>
            </div>
            <div className="menu-item">
              <div className="item-left">
                <div className="menu-icon text-gray">
                  <Moon size={20} />
                </div>
                <span>Giao diện tối (Dark mode)</span>
              </div>
              <div
                className={`toggle-switch ${darkMode ? "on" : "off"}`}
                onClick={() => setDarkMode(!darkMode)}
              >
                <div className="toggle-knob"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Nhóm 3: Khác */}
        <div className="menu-group">
          <h4 className="group-title">Khác</h4>
          <div className="menu-list">
            <button className="menu-item">
              <div className="item-left">
                <div className="menu-icon text-teal">
                  <HelpCircle size={20} />
                </div>
                <span>Trung tâm hỗ trợ</span>
              </div>
              <ChevronRight size={18} className="icon-right" />
            </button>
            <button className="menu-item text-danger">
              <div className="item-left">
                <div className="menu-icon bg-danger-light">
                  <LogOut size={20} />
                </div>
                <span>Đăng xuất</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="app-version">POS System App v2.4.1</div>
    </div>
  );
}
