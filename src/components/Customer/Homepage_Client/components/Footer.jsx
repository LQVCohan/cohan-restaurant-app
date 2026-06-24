import React, { useState } from "react";
import "../../../../styles/Homepage/Footer.scss";

const Icon = ({ name, size = 20, className = "" }) => {
  const icons = {
    facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
    instagram: <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z M12 2.15c4.48 0 8.57.45 8.57 8.57 0 8.12-4.09 8.57-8.57 8.57-4.48 0-8.57-.45-8.57-8.57 0-8.12 4.09-8.57 8.57-8.57z" />,
    twitter: <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-12.7 14.6-5.5-4.6 1.1-6.9-3.4-6.8-5.7.1-5.1-4.5-2.6-8 5.6 1.7 8.4 5.3 12.1 4.5 3-4.2 9.4-4.2 8.6 2.3z" />,
    youtube: <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />,
    tiktok: <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />,
    arrowUp: <path d="M12 19V5 M5 12l7-7 7 7" />,
    mail: <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" />,
    check: <path d="M20 6L9 17l-5-5" />,
    loader: <path d="M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83" />,
    send: <path d="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" />,
    apple: <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-8s-4-2-4-7c0-3.3 2-5 2-5s-2-2-5-2c-1.6 0-3 .6-4 .6-1.5 0-3-.6-4-.6-3 0-6 3-6 7 0 5 4 12 4 12s1.5 2 3.5 2z M12 6c0-2.5 2-4 2-4s-2.5 0-4 2c-1.3 1.5-1.5 3-1.5 3s2.5 0 3.5-1z" />,
    android: <path d="M4 14a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z M12 2L9 8h6l-3-6z" />,
    mapPin: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

const Footer = () => {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("processing");
    setTimeout(() => {
      setSubmitStatus("success");
      setTimeout(() => {
        setSubmitStatus("");
        setNewsletterEmail("");
        setIsSubmitting(false);
      }, 2000);
    }, 1500);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="footer-saas">
      <div className="footer-wave-top" aria-hidden="true" />
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-col brand-col">
            <div className="brand-logo">
              <span className="logo-icon" aria-hidden="true">🍽️</span>
              <span className="logo-text">FoodHub</span>
            </div>
            <p className="brand-desc">Trải nghiệm đặt bàn và gọi món đáng tin cậy. Kết nối thực khách với những nhà hàng phù hợp quanh bạn.</p>
            <div className="social-links" aria-label="Kênh mạng xã hội FoodHub">
              {[
                ["facebook", "https://www.facebook.com/"],
                ["instagram", "https://www.instagram.com/"],
                ["twitter", "https://x.com/"],
                ["youtube", "https://www.youtube.com/"],
              ].map(([icon, href]) => (
                <a key={icon} href={href} className="social-link" aria-label={icon} target="_blank" rel="noreferrer">
                  <Icon name={icon} size={18} />
                </a>
              ))}
            </div>
          </div>

          <nav className="footer-col links-col" aria-label="Khám phá FoodHub">
            <h4>Khám phá</h4>
            <ul>
              <li><a href="/restaurants">Nhà hàng</a></li>
              <li><a href="/for-you">Gợi ý cho bạn</a></li>
              <li><a href="/coupons/featured">Ưu đãi</a></li>
              <li><a href="/contact">Đối tác nhà hàng</a></li>
            </ul>
          </nav>

          <nav className="footer-col links-col" aria-label="Hỗ trợ khách hàng">
            <h4>Hỗ trợ</h4>
            <ul>
              <li><a href="/help-center/general">Trung tâm trợ giúp</a></li>
              <li><a href="/contact">Chính sách bảo mật</a></li>
              <li><a href="/contact">Điều khoản sử dụng</a></li>
              <li><a href="/contact">Liên hệ</a></li>
            </ul>
          </nav>

          <div className="footer-col newsletter-col">
            <h4>Đăng ký nhận tin</h4>
            <p className="newsletter-text">Nhận mã giảm giá và ưu đãi độc quyền hàng tuần.</p>
            <form onSubmit={handleNewsletterSubmit} className="newsletter-form">
              <div className="input-group">
                <Icon name="mail" size={16} className="input-icon" />
                <input
                  type="email"
                  aria-label="Email nhận ưu đãi"
                  placeholder="Email của bạn..."
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <button type="submit" disabled={isSubmitting} className={submitStatus} aria-label="Đăng ký nhận tin">
                  {submitStatus === "processing" ? <Icon name="loader" className="spin" /> : submitStatus === "success" ? <Icon name="check" /> : <Icon name="send" />}
                </button>
              </div>
            </form>

            <div className="app-download">
              <span className="app-label">Tải ứng dụng</span>
              <div className="store-buttons">
                <a href="/contact" className="store-btn"><Icon name="apple" size={20} /> App Store</a>
                <a href="/contact" className="store-btn"><Icon name="android" size={20} /> Google Play</a>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-divider" />
        <div className="footer-bottom">
          <div className="copyright">© 2026 FoodHub. All rights reserved.</div>
          <div className="bottom-right">
            <div className="contact-info">
              <span><Icon name="mapPin" size={14} /> TP. Hồ Chí Minh</span>
              <span><Icon name="phone" size={14} /> 1900 1234</span>
            </div>
            <button onClick={scrollToTop} className="scroll-top-btn" aria-label="Lên đầu trang">
              <Icon name="arrowUp" size={16} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
