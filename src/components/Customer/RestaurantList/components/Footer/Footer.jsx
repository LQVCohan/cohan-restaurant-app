import React from "react";
import "./Footer.scss";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__content">
        <div className="footer__section footer__section--main">
          <div className="footer__brand">
            <h3 className="footer__logo">🍽️ FoodHub</h3>
            <p className="footer__description">
              Nền tảng đặt bàn nhà hàng hàng đầu Việt Nam. Khám phá và trải
              nghiệm ẩm thực tuyệt vời cùng chúng tôi.
            </p>
          </div>
          <div className="footer__social">
            <h4 className="footer__social-title">Theo dõi chúng tôi</h4>
            <div className="footer__social-links">
              <a href="#" className="footer__social-link" aria-label="Facebook">
                📘
              </a>
              <a
                href="#"
                className="footer__social-link"
                aria-label="Instagram"
              >
                📷
              </a>
              <a href="#" className="footer__social-link" aria-label="Twitter">
                🐦
              </a>
              <a href="#" className="footer__social-link" aria-label="YouTube">
                📺
              </a>
            </div>
          </div>
        </div>

        <div className="footer__section">
          <h4 className="footer__section-title">Dành cho khách hàng</h4>
          <div className="footer__links">
            <a href="#" className="footer__link">
              🔍 Tìm nhà hàng
            </a>
            <a href="#" className="footer__link">
              📅 Đặt bàn
            </a>
            <a href="#" className="footer__link">
              🎉 Khuyến mãi
            </a>
            <a href="#" className="footer__link">
              ⭐ Đánh giá nhà hàng
            </a>
            <a href="#" className="footer__link">
              🎁 Chương trình thành viên
            </a>
          </div>
        </div>

        <div className="footer__section">
          <h4 className="footer__section-title">Dành cho nhà hàng</h4>
          <div className="footer__links">
            <a href="#" className="footer__link">
              🏪 Đăng ký nhà hàng
            </a>
            <a href="#" className="footer__link">
              📊 Quản lý đặt bàn
            </a>
            <a href="#" className="footer__link">
              📈 Phân tích dữ liệu
            </a>
            <a href="#" className="footer__link">
              💼 Hỗ trợ kinh doanh
            </a>
            <a href="#" className="footer__link">
              📱 Ứng dụng quản lý
            </a>
          </div>
        </div>

        <div className="footer__section">
          <h4 className="footer__section-title">Hỗ trợ</h4>
          <div className="footer__links">
            <a href="#" className="footer__link">
              ❓ Trung tâm trợ giúp
            </a>
            <a href="#" className="footer__link">
              📞 Liên hệ
            </a>
            <a href="#" className="footer__link">
              📋 Điều khoản sử dụng
            </a>
            <a href="#" className="footer__link">
              🔒 Chính sách bảo mật
            </a>
            <a href="#" className="footer__link">
              🍽️ Hướng dẫn đặt bàn
            </a>
          </div>
        </div>

        <div className="footer__section">
          <h4 className="footer__section-title">Liên hệ</h4>
          <div className="footer__contact">
            <div className="footer__contact-item">
              <span className="footer__contact-icon">📍</span>
              <span>123 Nguyễn Huệ, Quận 1, TP.HCM</span>
            </div>
            <div className="footer__contact-item">
              <span className="footer__contact-icon">📞</span>
              <span>1900 1234</span>
            </div>
            <div className="footer__contact-item">
              <span className="footer__contact-icon">✉️</span>
              <span>support@foodhub.vn</span>
            </div>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="footer__bottom-content">
          <p className="footer__copyright">
            &copy; {currentYear} FoodHub. Tất cả quyền được bảo lưu.
          </p>
          <div className="footer__bottom-links">
            <a href="#" className="footer__bottom-link">
              Chính sách bảo mật
            </a>
            <a href="#" className="footer__bottom-link">
              Điều khoản dịch vụ
            </a>
            <a href="#" className="footer__bottom-link">
              Sitemap
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
