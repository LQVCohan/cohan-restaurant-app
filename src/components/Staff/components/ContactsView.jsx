import React, { useState } from "react";
import { MessageCircle, PhoneCall, Search } from "lucide-react";
import "./ContactsView.scss";

export default function ContactsView() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const staffContacts = [
    {
      id: 1,
      role: "Quản lý",
      dept: "management",
      name: "Anh Tuấn",
      status: "online",
      lastMsg: "Khách VIP sắp tới nhé.",
      avatarColor: "bg-blue-100 text-blue-600",
    },
    {
      id: 2,
      role: "Bếp trưởng",
      dept: "kitchen",
      name: "Chú Hải",
      status: "busy",
      lastMsg: "Đang kẹt 5 bill lẩu.",
      avatarColor: "bg-orange-100 text-orange-600",
    },
    {
      id: 3,
      role: "Thu ngân",
      dept: "cashier",
      name: "Chị Mai",
      status: "online",
      lastMsg: "Đã nhận tiền bàn 03.",
      avatarColor: "bg-emerald-100 text-emerald-600",
    },
    {
      id: 4,
      role: "Bảo vệ",
      dept: "security",
      name: "Chú Dũng",
      status: "offline",
      lastMsg: "Xe khách hết chỗ.",
      avatarColor: "bg-gray-200 text-gray-600",
    },
  ];

  // Hàm lấy chữ cái đầu làm Avatar
  const getInitials = (name) => {
    const parts = name.split(" ");
    return parts[parts.length - 1].charAt(0).toUpperCase();
  };

  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "management", label: "Quản lý" },
    { id: "kitchen", label: "Bếp" },
    { id: "cashier", label: "Thu ngân" },
  ];

  // Lọc danh sách
  const filteredContacts = staffContacts.filter((c) => {
    const matchesTab = activeTab === "all" || c.dept === activeTab;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="staff-pos-contacts">
      {/* Thanh Tìm Kiếm Mới */}
      <div className="search-section">
        <div className="search-bar">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Tìm nhân viên / bộ phận..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Thanh Lọc Nhanh (Filter Chips) */}
      <div className="filter-scroll">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`filter-chip ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Danh sách Liên lạc */}
      <div className="contact-list">
        {filteredContacts.length === 0 ? (
          <div className="empty-state">Không tìm thấy liên lạc nào.</div>
        ) : (
          filteredContacts.map((c) => (
            <div key={c.id} className="contact-card">
              <div className="contact-info-wrap">
                {/* Avatar với Status Dot */}
                <div className="avatar-wrapper">
                  <div className={`avatar ${c.avatarColor}`}>
                    {getInitials(c.name)}
                  </div>
                  <span className={`status-indicator ${c.status}`}></span>
                </div>

                <div className="info-text">
                  <h4>{c.name}</h4>
                  <span className="role">{c.role}</span>
                  <p className="last-msg">{c.lastMsg}</p>
                </div>
              </div>

              <div className="contact-actions">
                <button className="action-btn btn-chat" aria-label="Nhắn tin">
                  <MessageCircle size={18} />
                </button>
                <button className="action-btn btn-call" aria-label="Gọi điện">
                  <PhoneCall size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
