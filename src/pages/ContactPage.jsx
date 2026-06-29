import React, { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
} from "lucide-react";
import "./ContactPage.scss";
import "./ContactPage.product.css";

const SocialFacebook = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M14 8.75H16.25V5.25H13.65C10.92 5.25 9.25 6.9 9.25 9.55V12H6.75V15.55H9.25V21H13.05V15.55H15.85L16.35 12H13.05V9.95C13.05 9.15 13.38 8.75 14 8.75Z"
      fill="currentColor"
    />
  </svg>
);

const SocialInstagram = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="5"
      y="5"
      width="14"
      height="14"
      rx="4"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="2" />
    <circle cx="16.35" cy="7.65" r="1" fill="currentColor" />
  </svg>
);

const SocialTwitter = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M6.2 5H9.75L12.55 8.92L15.95 5H18.1L13.55 10.25L18.8 17.6H15.25L11.95 12.98L7.95 17.6H5.8L10.95 11.65L6.2 5ZM8.15 6.45L15.95 16.15H16.85L9.05 6.45H8.15Z"
      fill="currentColor"
    />
  </svg>
);

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    window.setTimeout(() => {
      setLoading(false);
      setToast({
        message: "Đã gửi tin nhắn thành công. Chúng tôi sẽ phản hồi sớm nhất.",
        type: "success",
      });
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      window.setTimeout(() => setToast(null), 3000);
    }, 1500);
  };

  return (
    <main className="contact-page" aria-labelledby="contact-title">
      {toast && (
        <div className={`toast-notification ${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      <section className="contact-header" aria-labelledby="contact-title">
        <h1 id="contact-title">Liên hệ với Cohan</h1>
        <p>
          Cohan luôn sẵn sàng lắng nghe và hỗ trợ bạn. Hãy để lại tin nhắn hoặc liên hệ trực tiếp với đội hỗ trợ.
        </p>
      </section>

      <div className="contact-container">
        <section className="contact-form-card" aria-labelledby="contact-form-title">
          <div className="card-title">
            <h2 id="contact-form-title">Gửi tin nhắn</h2>
            <p>Điền thông tin vào biểu mẫu bên dưới.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact-name">Họ và tên</label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  placeholder="Nguyễn Văn A"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact-phone">Số điện thoại</label>
                <input
                  id="contact-phone"
                  type="tel"
                  name="phone"
                  placeholder="0909 xxx xxx"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                type="email"
                name="email"
                placeholder="example@gmail.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="contact-subject">Chủ đề</label>
              <select
                id="contact-subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
              >
                <option value="">Chọn chủ đề cần hỗ trợ</option>
                <option value="support">Hỗ trợ kỹ thuật</option>
                <option value="booking">Vấn đề đặt bàn</option>
                <option value="delivery">Vấn đề giao hàng</option>
                <option value="partner">Hợp tác kinh doanh</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="contact-message">Nội dung</label>
              <textarea
                id="contact-message"
                name="message"
                rows="5"
                placeholder="Nhập nội dung tin nhắn..."
                value={formData.message}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <span className="loader" aria-hidden="true" />
              ) : (
                <>
                  <Send size={18} aria-hidden="true" /> Gửi ngay
                </>
              )}
            </button>
          </form>
        </section>

        <aside className="contact-info-wrapper" aria-label="Thông tin liên hệ Cohan">
          <section className="contact-info-card" aria-labelledby="contact-info-title">
            <h2 id="contact-info-title">Thông tin liên hệ</h2>
            <p className="subtitle">Chi tiết liên lạc trực tiếp</p>

            <div className="info-list">
              <div className="info-item">
                <div className="icon-box" aria-hidden="true">
                  <MapPin size={20} />
                </div>
                <div>
                  <span className="label">Địa chỉ</span>
                  <p className="value">
                    Tầng 12, Bitexco Financial Tower, Quận 1, TP.HCM
                  </p>
                </div>
              </div>

              <div className="info-item">
                <div className="icon-box" aria-hidden="true">
                  <Phone size={20} />
                </div>
                <div>
                  <span className="label">Hotline</span>
                  <a className="value highlight" href="tel:1900123456">1900 123 456</a>
                </div>
              </div>

              <div className="info-item">
                <div className="icon-box" aria-hidden="true">
                  <Mail size={20} />
                </div>
                <div>
                  <span className="label">Email hỗ trợ</span>
                  <a className="value" href="mailto:support@cohan.vn">support@cohan.vn</a>
                </div>
              </div>

              <div className="info-item">
                <div className="icon-box" aria-hidden="true">
                  <Clock size={20} />
                </div>
                <div>
                  <span className="label">Giờ làm việc</span>
                  <p className="value">Thứ 2 - CN: 08:00 - 22:00</p>
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="social-links">
              <span className="label">Theo dõi Cohan:</span>
              <div className="icons" aria-label="Kênh mạng xã hội Cohan">
                <a href="https://www.facebook.com" className="social-icon" aria-label="Facebook Cohan" target="_blank" rel="noreferrer">
                  <SocialFacebook size={20} />
                </a>
                <a href="https://www.instagram.com" className="social-icon" aria-label="Instagram Cohan" target="_blank" rel="noreferrer">
                  <SocialInstagram size={20} />
                </a>
                <a href="https://x.com" className="social-icon" aria-label="X Cohan" target="_blank" rel="noreferrer">
                  <SocialTwitter size={20} />
                </a>
              </div>
            </div>
          </section>

          <section className="map-card" aria-label="Bản đồ vị trí văn phòng Cohan">
            <iframe
              title="Bản đồ vị trí văn phòng Cohan"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.517826541815!2d106.70134531480082!3d10.771595292324754!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f40a3b49e59%3A0xa1bd14e483a602db!2sBitexco%20Financial%20Tower!5e0!3m2!1sen!2s!4v1625625000000!5m2!1sen!2s"
              width="100%"
              height="250"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
            />
          </section>
        </aside>
      </div>
    </main>
  );
};

export default ContactPage;
