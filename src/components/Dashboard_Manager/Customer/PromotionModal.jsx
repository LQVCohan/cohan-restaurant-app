import React, { useState } from "react";
import Modal from "../../common/Modal";
import "./PromotionModal.scss";

const PromotionModal = ({ onClose, customers }) => {
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [scheduleType, setScheduleType] = useState("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  const promotions = [
    {
      id: "welcome",
      title: "Chào Mừng Khách Mới",
      description: "Giảm 20% cho đơn hàng đầu tiên, tối đa 100.000đ",
      icon: "🎁",
      bgColor: "bg-green-100",
      validDays: 30,
      targetGroup: "Khách mới",
    },
    {
      id: "loyalty",
      title: "Ưu Đãi Khách VIP",
      description: "Giảm 15% toàn bộ menu + tặng món tráng miệng",
      icon: "⭐",
      bgColor: "bg-purple-100",
      validDays: 15,
      targetGroup: "Khách VIP",
    },
    {
      id: "weekend",
      title: "Khuyến Mãi Cuối Tuần",
      description: "Mua 2 tặng 1 cho các món nước uống",
      icon: "🎉",
      bgColor: "bg-orange-100",
      validDays: 2,
      targetGroup: "Tất cả khách",
    },
    {
      id: "birthday",
      title: "Sinh Nhật Vui Vẻ",
      description: "Giảm 25% + tặng bánh sinh nhật mini",
      icon: "🎂",
      bgColor: "bg-pink-100",
      validDays: 30,
      targetGroup: "Khách có sinh nhật",
    },
  ];

  const customerGroups = [
    { id: "vip", name: "Khách VIP", icon: "⭐", count: 89 },
    { id: "frequent", name: "Khách Thường Xuyên", icon: "🔥", count: 234 },
    { id: "new", name: "Khách Mới", icon: "🆕", count: 156 },
    { id: "birthday", name: "Sinh Nhật Tháng Này", icon: "🎂", count: 23 },
    {
      id: "inactive",
      name: "Khách Lâu Không Hoạt Động",
      icon: "💤",
      count: 67,
    },
    { id: "all", name: "Tất Cả Khách Hàng", icon: "👥", count: 1247 },
  ];

  const totalRecipients = selectedGroups.reduce((total, groupId) => {
    const group = customerGroups.find((g) => g.id === groupId);
    return total + (group ? group.count : 0);
  }, 0);

  const handlePromotionSelect = (promotion) => {
    setSelectedPromotion(promotion);
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSendPromotion = () => {
    if (!selectedPromotion) {
      alert("Vui lòng chọn gói khuyến mãi!");
      return;
    }

    if (selectedGroups.length === 0) {
      alert("Vui lòng chọn ít nhất một nhóm khách hàng!");
      return;
    }

    const groupNames = selectedGroups
      .map((id) => customerGroups.find((g) => g.id === id)?.name)
      .join(", ");

    alert(
      `✅ Đã gửi khuyến mãi "${selectedPromotion.title}" đến ${totalRecipients} khách hàng (${groupNames}) thành công!`
    );
    onClose();
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      className="promotion-modal"
    >
      <div className="promotion-modal__header">
        <h2>Gửi Khuyến Mãi</h2>
        <div className="step-indicator">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`step ${currentStep >= step ? "active" : ""} ${
                currentStep === step ? "current" : ""
              }`}
            >
              <span className="step-number">{step}</span>
              <span className="step-label">
                {step === 1
                  ? "Chọn KM"
                  : step === 2
                  ? "Chọn Khách"
                  : "Lên Lịch"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="promotion-modal__content">
        {/* Step 1: Select Promotion */}
        {currentStep === 1 && (
          <div className="step-content step-promotions">
            <h3>1. Chọn Gói Khuyến Mãi</h3>
            <div className="promotions-grid">
              {promotions.map((promotion) => (
                <div
                  key={promotion.id}
                  className={`promotion-card ${
                    selectedPromotion?.id === promotion.id ? "selected" : ""
                  }`}
                  onClick={() => handlePromotionSelect(promotion)}
                >
                  <div className="promotion-card__header">
                    <div className={`promotion-icon ${promotion.bgColor}`}>
                      <span>{promotion.icon}</span>
                    </div>
                    <div className="promotion-info">
                      <h4>{promotion.title}</h4>
                      <p>{promotion.description}</p>
                    </div>
                  </div>
                  <div className="promotion-card__footer">
                    <div className="promotion-tags">
                      <span className="tag tag--validity">
                        Còn hiệu lực {promotion.validDays} ngày
                      </span>
                      <span className="tag tag--target">
                        {promotion.targetGroup}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Customer Groups */}
        {currentStep === 2 && (
          <div className="step-content step-groups">
            <h3>2. Chọn Nhóm Khách Hàng</h3>
            <div className="groups-list">
              {customerGroups.map((group) => (
                <label
                  key={group.id}
                  className={`group-item ${
                    selectedGroups.includes(group.id) ? "selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={() => handleGroupToggle(group.id)}
                  />
                  <div className="group-content">
                    <div className="group-info">
                      <span className="group-icon">{group.icon}</span>
                      <span className="group-name">{group.name}</span>
                    </div>
                    <span className="group-count">({group.count} khách)</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Schedule */}
        {currentStep === 3 && (
          <div className="step-content step-schedule">
            <h3>3. Lên Lịch Gửi</h3>
            <div className="schedule-options">
              <label className="schedule-option">
                <input
                  type="radio"
                  name="schedule"
                  value="now"
                  checked={scheduleType === "now"}
                  onChange={(e) => setScheduleType(e.target.value)}
                />
                <span>Gửi ngay</span>
              </label>

              <label className="schedule-option">
                <input
                  type="radio"
                  name="schedule"
                  value="later"
                  checked={scheduleType === "later"}
                  onChange={(e) => setScheduleType(e.target.value)}
                />
                <span>Lên lịch gửi sau</span>
              </label>

              {scheduleType === "later" && (
                <div className="schedule-inputs">
                  <div className="input-group">
                    <label>Ngày:</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="input-group">
                    <label>Giờ:</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="promotion-summary">
          <h4>📋 Tóm Tắt</h4>
          <div className="summary-content">
            <div className="summary-item">
              <span className="label">Khuyến mãi:</span>
              <span className="value">
                {selectedPromotion ? selectedPromotion.title : "Chưa chọn"}
              </span>
            </div>
            <div className="summary-item">
              <span className="label">Nhóm khách:</span>
              <span className="value">
                {selectedGroups.length > 0
                  ? `${selectedGroups.length} nhóm được chọn`
                  : "Chưa chọn"}
              </span>
            </div>
            <div className="summary-item">
              <span className="label">Số lượng:</span>
              <span className="value">{totalRecipients} khách hàng</span>
            </div>
            <div className="summary-item">
              <span className="label">Thời gian:</span>
              <span className="value">
                {scheduleType === "now"
                  ? "Gửi ngay"
                  : `${scheduleDate} ${scheduleTime}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="promotion-modal__footer">
        <div className="navigation-buttons">
          {currentStep > 1 && (
            <button onClick={prevStep} className="btn btn--secondary">
              ← Quay lại
            </button>
          )}

          {currentStep < 3 ? (
            <button
              onClick={nextStep}
              className="btn btn--primary"
              disabled={
                (currentStep === 1 && !selectedPromotion) ||
                (currentStep === 2 && selectedGroups.length === 0)
              }
            >
              Tiếp theo →
            </button>
          ) : (
            <button
              onClick={handleSendPromotion}
              className="btn btn--success"
              disabled={!selectedPromotion || selectedGroups.length === 0}
            >
              📧 Gửi Khuyến Mãi
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PromotionModal;
