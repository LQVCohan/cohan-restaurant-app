import React from "react";
import "../../../../styles/Homepage/HowItWorks.scss";

const HowItWorks = () => {
  const steps = [
    {
      id: 1,
      icon: "🏪",
      title: "Chọn nhà hàng",
      description:
        "Khám phá hàng ngàn món ăn ngon từ các nhà hàng uy tín quanh bạn.",
    },
    {
      id: 2,
      icon: "📅",
      title: "Đặt bàn / Đặt món",
      description:
        "Chọn thời gian giữ chỗ hoặc thêm món ăn yêu thích vào giỏ hàng.",
    },
    {
      id: 3,
      icon: "💳",
      title: "Thanh toán an toàn",
      description:
        "Thanh toán nhanh chóng, bảo mật qua ví điện tử hoặc thẻ ngân hàng.",
    },
    {
      id: 4,
      icon: "😋",
      title: "Thưởng thức",
      description:
        "Nhận món ăn giao tận nơi hoặc đến nhà hàng thưởng thức ngay!",
    },
  ];

  return (
    <section className="how-it-works">
      {/* --- SÓNG ĐỈNH (KẾT NỐI VỚI RESTAURANT GRID TRẮNG) --- */}
      <div className="how-it-works__wave-top">
        <svg
          viewBox="0 0 1440 100"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="wave-svg"
        >
          <path
            fill="#ffffff"
            fillOpacity="1"
            d="M0,32L48,37.3C96,43,192,53,288,58.7C384,64,480,64,576,58.7C672,53,768,43,864,42.7C960,43,1056,53,1152,58.7C1248,64,1344,64,1392,64L1440,64L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
          ></path>
        </svg>
      </div>

      <div className="how-it-works__container">
        <div className="how-it-works__header">
          <span className="how-it-works__badge">Quy trình đơn giản</span>
          <h3 className="how-it-works__title">Cách Thức Hoạt Động</h3>
          <p className="how-it-works__subtitle">
            Đặt món và đặt bàn dễ dàng chỉ với 4 bước đơn giản.
          </p>
        </div>

        <div className="how-it-works__grid">
          {steps.map((step) => (
            <div key={step.id} className="how-it-works__card">
              <div className="how-it-works__step-number">{step.id}</div>
              <div className="how-it-works__icon-wrapper">
                <span className="how-it-works__icon">{step.icon}</span>
              </div>
              <h4 className="how-it-works__step-title">{step.title}</h4>
              <p className="how-it-works__step-desc">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
