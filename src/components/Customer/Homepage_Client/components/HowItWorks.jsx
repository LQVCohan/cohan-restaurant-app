import React from "react";
import { CalendarCheck, CreditCard, Store, UtensilsCrossed } from "lucide-react";
import "../../../../styles/Homepage/HowItWorks.scss";

const HowItWorks = () => {
  const steps = [
    {
      id: 1,
      Icon: Store,
      title: "Chọn nhà hàng",
      description: "Lọc theo vị trí, ưu đãi hoặc khẩu vị để tìm nơi phù hợp.",
    },
    {
      id: 2,
      Icon: CalendarCheck,
      title: "Đặt bàn / đặt món",
      description: "Giữ chỗ trước hoặc thêm món vào giỏ chỉ trong vài thao tác.",
    },
    {
      id: 3,
      Icon: CreditCard,
      title: "Thanh toán an toàn",
      description: "Dùng Cohan Balance, QR hoặc phương thức thanh toán hỗ trợ.",
    },
    {
      id: 4,
      Icon: UtensilsCrossed,
      title: "Thưởng thức",
      description: "Theo dõi đơn và nhận hỗ trợ khi nhà hàng cập nhật trạng thái.",
    },
  ];

  return (
    <section className="how-it-works" aria-labelledby="how-it-works-title">
      <div className="how-it-works__wave-top" aria-hidden="true" />
      <div className="how-it-works__container">
        <div className="how-it-works__header">
          <div className="how-it-works__heading-copy">
            <span className="how-it-works__badge">Quy trình đơn giản</span>
            <h3 className="how-it-works__title" id="how-it-works-title">Cách thức hoạt động</h3>
            <p className="how-it-works__subtitle">Từ chọn món đến thanh toán và theo dõi đơn, mọi bước đều nằm trong một luồng.</p>
          </div>
        </div>

        <div className="how-it-works__grid">
          {steps.map((step) => {
            const StepIcon = step.Icon;
            return (
              <article key={step.id} className="how-it-works__card">
                <div className="how-it-works__step-number">{step.id}</div>
                <div className="how-it-works__icon-wrapper">
                  <StepIcon className="how-it-works__icon" aria-hidden="true" />
                </div>
                <h4 className="how-it-works__step-title">{step.title}</h4>
                <p className="how-it-works__step-desc">{step.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
