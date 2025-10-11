import React from "react";
import "../../../../styles/Homepage/HowItWorks.scss";

const HowItWorks = () => {
  const steps = [
    {
      id: 1,
      icon: "🏪",
      title: "Chọn nhà hàng",
      description: "Duyệt qua danh sách nhà hàng và chọn địa điểm yêu thích",
    },
    {
      id: 2,
      icon: "🪑",
      title: "Đặt bàn",
      description: "Chọn thời gian và số lượng khách, đặt bàn trước",
    },
    {
      id: 3,
      icon: "💳",
      title: "Thanh toán trước",
      description: "Thanh toán phí đặt cọc để xác nhận đặt bàn",
    },
    {
      id: 4,
      icon: "🍽️",
      title: "Đến và tận hưởng",
      description: "Đến nhà hàng đúng giờ và thưởng thức bữa ăn ngon",
    },
  ];

  return (
    <section className="how-it-works">
      <div className="how-it-works__container">
        <h3 className="how-it-works__title">Cách thức hoạt động</h3>
        <div className="how-it-works__grid">
          {steps.map((step) => (
            <div key={step.id} className="how-it-works__step">
              <div className="how-it-works__icon">
                <span>{step.icon}</span>
              </div>
              <h4 className="how-it-works__step-title">
                {step.id}. {step.title}
              </h4>
              <p className="how-it-works__step-description">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
