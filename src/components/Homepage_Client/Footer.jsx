import React from "react";
import "../../styles/Homepage/Footer.scss";

const Footer = () => {
  return (
    <footer id="contact" className="footer">
      <div className="footer__container">
        <div className="footer__grid">
          <div className="footer__brand">
            <div className="footer__logo">
              <div className="footer__logo-icon">🍽️</div>
              <h4 className="footer__logo-text">FoodHub</h4>
            </div>
            <p className="footer__description">
              Nền tảng đặt món và đặt bàn trực tuyến hàng đầu Việt Nam
            </p>
          </div>

          <div className="footer__section">
            <h5 className="footer__section-title">Dịch vụ</h5>
            <ul className="footer__links">
              <li>
                <a href="#" className="footer__link">
                  Đặt món
                </a>
              </li>
              <li>
                <a href="#" className="footer__link">
                  Đặt bàn
                </a>
              </li>
              <li>
                <a href="#" className="footer__link">
                  Giao hàng
                </a>
              </li>
              <li>
                <a href="#" className="footer__link">
                  Đối tác nhà hàng
                </a>
              </li>
            </ul>
          </div>

          <div className="footer__section">
            <h5 className="footer__section-title">Hỗ trợ</h5>
            <ul className="footer__links">
              <li>
                <a href="#" className="footer__link">
                  Trung tâm trợ giúp
                </a>
              </li>
              <li>
                <a href="#" className="footer__link">
                  Liên hệ
                </a>
              </li>
              <li>
                <a href="#" className="footer__link">
                  Chính sách bảo mật
                </a>
              </li>
              <li>
                <a href="#" className="footer__link">
                  Điều khoản sử dụng
                </a>
              </li>
            </ul>
          </div>

          <div className="footer__section">
            <h5 className="footer__section-title">Liên hệ</h5>
            <div className="footer__contact">
              <p className="footer__contact-item">📞 1900 1234</p>
              <p className="footer__contact-item">📧 support@foodhub.vn</p>
              <p className="footer__contact-item">📍 123 Đường ABC, TP.HCM</p>
            </div>
            <div className="footer__social">
              <a href="#" className="footer__social-link">
                📘
              </a>
              <a href="#" className="footer__social-link">
                📷
              </a>
              <a href="#" className="footer__social-link">
                🐦
              </a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; 2024 FoodHub. Tất cả quyền được bảo lưu.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
