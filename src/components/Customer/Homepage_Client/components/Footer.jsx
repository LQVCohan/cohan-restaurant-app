import React, { useState } from "react";
import "./Footer.scss";

const Footer = () => {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("processing");

    // Simulate API call
    setTimeout(() => {
      setSubmitStatus("success");
      setTimeout(() => {
        setSubmitStatus("");
        setNewsletterEmail("");
        setIsSubmitting(false);
      }, 2000);
    }, 1500);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const socialLinks = [
    { icon: "📘", label: "Facebook", href: "#" },
    { icon: "📷", label: "Instagram", href: "#" },
    { icon: "🐦", label: "Twitter", href: "#" },
    { icon: "📺", label: "YouTube", href: "#" },
    { icon: "🎵", label: "TikTok", href: "#" },
  ];

  const quickLinks = [
    { icon: "🏠", text: "Trang chủ", href: "#" },
    { icon: "🍽️", text: "Nhà hàng", href: "#" },
    { icon: "🎯", text: "Khuyến mãi", href: "#" },
    { icon: "📱", text: "Ứng dụng", href: "#" },
    { icon: "🎁", text: "Thẻ quà tặng", href: "#" },
    { icon: "💼", text: "Đối tác", href: "#" },
  ];

  const cuisineTypes = [
    { icon: "🇻🇳", text: "Món Việt", href: "#" },
    { icon: "🇯🇵", text: "Món Nhật", href: "#" },
    { icon: "🇰🇷", text: "Món Hàn", href: "#" },
    { icon: "🇨🇳", text: "Món Trung", href: "#" },
    { icon: "🇮🇹", text: "Món Ý", href: "#" },
    { icon: "🇹🇭", text: "Món Thái", href: "#" },
  ];

  const supportLinks = [
    { icon: "❓", text: "Câu hỏi thường gặp", href: "#" },
    { icon: "📞", text: "Liên hệ", href: "#" },
    { icon: "🔒", text: "Chính sách bảo mật", href: "#" },
    { icon: "📋", text: "Điều khoản sử dụng", href: "#" },
    { icon: "💳", text: "Thanh toán", href: "#" },
    { icon: "🚚", text: "Giao hàng", href: "#" },
  ];

  const contactInfo = [
    {
      icon: "📍",
      title: "Địa chỉ:",
      content: "123 Nguyễn Huệ, Quận 1\nTP. Hồ Chí Minh",
    },
    {
      icon: "📞",
      title: "Hotline:",
      content: "1900 1234\n028 3456 7890",
    },
    {
      icon: "✉️",
      title: "Email:",
      content: "info@foodiehub.vn\nsupport@foodiehub.vn",
    },
  ];

  const getButtonContent = () => {
    switch (submitStatus) {
      case "processing":
        return (
          <>
            <span className="btn-text">Đang xử lý...</span>
            <span className="btn-icon">⏳</span>
          </>
        );
      case "success":
        return (
          <>
            <span className="btn-text">Thành công!</span>
            <span className="btn-icon">✅</span>
          </>
        );
      default:
        return (
          <>
            <span className="btn-text">Đăng ký</span>
            <span className="btn-icon">📨</span>
          </>
        );
    }
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Main Footer Content */}
        <div className="footer-main">
          {/* Brand Section */}
          <div className="footer-brand">
            <div className="brand-logo">
              <span className="logo-icon">🍽️</span>
              <span className="logo-text">FoodieHub</span>
            </div>
            <p className="brand-description">
              Khám phá những nhà hàng tuyệt vời nhất trong thành phố. Đặt bàn dễ
              dàng, trải nghiệm ẩm thực đỉnh cao.
            </p>
            <div className="social-links">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="social-link"
                  aria-label={social.label}
                >
                  <span>{social.icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h3 className="section-title">🔗 Liên kết nhanh</h3>
            <ul className="footer-links">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="footer-link">
                    {link.icon} {link.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div className="footer-section">
            <h3 className="section-title">🍜 Ẩm thực</h3>
            <ul className="footer-links">
              {cuisineTypes.map((cuisine, index) => (
                <li key={index}>
                  <a href={cuisine.href} className="footer-link">
                    {cuisine.icon} {cuisine.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="footer-section">
            <h3 className="section-title">🆘 Hỗ trợ</h3>
            <ul className="footer-links">
              {supportLinks.map((support, index) => (
                <li key={index}>
                  <a href={support.href} className="footer-link">
                    {support.icon} {support.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="footer-section">
            <h3 className="section-title">📍 Liên hệ</h3>
            <div className="contact-info">
              {contactInfo.map((contact, index) => (
                <div key={index} className="contact-item">
                  <span className="contact-icon">{contact.icon}</span>
                  <div className="contact-details">
                    <strong>{contact.title}</strong>
                    <p>
                      {contact.content.split("\n").map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          {i < contact.content.split("\n").length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Newsletter & App Section */}
        <div className="newsletter-app-section">
          <div className="newsletter-app-content">
            {/* Newsletter Part */}
            <div className="newsletter-part">
              <div className="newsletter-info">
                <h3 className="newsletter-title">📧 Đăng ký nhận tin</h3>
                <p className="newsletter-desc">
                  Nhận thông tin khuyến mãi và nhà hàng mới nhất qua email
                </p>
              </div>
              <form
                className="newsletter-form"
                onSubmit={handleNewsletterSubmit}
              >
                <div className="form-group">
                  <input
                    type="email"
                    className="newsletter-input"
                    placeholder="Nhập email của bạn..."
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    className="newsletter-btn"
                    disabled={isSubmitting}
                  >
                    {getButtonContent()}
                  </button>
                </div>
                <div className="newsletter-note">
                  <span className="note-icon">🔒</span>
                  <span className="note-text">
                    Chúng tôi tôn trọng quyền riêng tư của bạn
                  </span>
                </div>
              </form>
            </div>

            {/* Divider */}
            <div className="section-divider">
              <div className="divider-line"></div>
              <span className="divider-text">hoặc</span>
              <div className="divider-line"></div>
            </div>

            {/* App Download Part */}
            <div className="app-part">
              <div className="app-info">
                <h3 className="app-title">📱 Tải ứng dụng</h3>
                <p className="app-desc">
                  Đặt bàn nhanh chóng, tiện lợi hơn với ứng dụng di động
                </p>
              </div>
              <div className="app-downloads">
                <a href="#" className="download-btn">
                  <span className="download-icon">🍎</span>
                  <div className="download-text">
                    <span className="download-label">Tải trên</span>
                    <span className="download-store">App Store</span>
                  </div>
                </a>
                <a href="#" className="download-btn">
                  <span className="download-icon">🤖</span>
                  <div className="download-text">
                    <span className="download-label">Tải trên</span>
                    <span className="download-store">Google Play</span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <div className="copyright">
              <span className="copyright-icon">©</span>
              <span className="copyright-text">
                2024 FoodieHub. Tất cả quyền được bảo lưu.
              </span>
            </div>
            <div className="footer-bottom-links">
              <a href="#" className="bottom-link">
                Chính sách Cookie
              </a>
              <span className="separator">•</span>
              <a href="#" className="bottom-link">
                Sitemap
              </a>
              <span className="separator">•</span>
              <a href="#" className="bottom-link">
                Accessibility
              </a>
            </div>
            <div className="back-to-top">
              <button
                className="back-to-top-btn"
                onClick={scrollToTop}
                aria-label="Về đầu trang"
              >
                <span className="back-icon">⬆️</span>
                <span className="back-text">Lên đầu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
