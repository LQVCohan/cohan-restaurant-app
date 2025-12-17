import React, { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Facebook,
  Instagram,
  Twitter,
} from "lucide-react";
import "./ContactPage.scss";
// Giả sử bạn có component Toast, nếu chưa có thì dùng alert tạm

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    // Giả lập gọi API gửi mail
    setTimeout(() => {
      setLoading(false);
      setToast({
        message: "Đã gửi tin nhắn thành công! Chúng tôi sẽ phản hồi sớm nhất.",
        type: "success",
      });
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });

      // Tắt toast sau 3s
      setTimeout(() => setToast(null), 3000);
    }, 1500);
  };

  return (
    <div className="contact-page">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* --- HEADER SECTION --- */}
      <div className="contact-header">
        <h1>Liên hệ với chúng tôi</h1>
        <p>
          Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn 24/7. Hãy để lại tin
          nhắn hoặc ghé thăm văn phòng của chúng tôi.
        </p>
      </div>

      <div className="contact-container">
        {/* --- LEFT: CONTACT FORM --- */}
        <div className="contact-form-card">
          <div className="card-title">
            <h2>Gửi tin nhắn</h2>
            <p>Điền thông tin vào biểu mẫu bên dưới.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Họ và tên</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Nguyễn Văn A"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="0909 xxx xxx"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="example@gmail.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Chủ đề</label>
              <select
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
              <label>Nội dung</label>
              <textarea
                name="message"
                rows="5"
                placeholder="Nhập nội dung tin nhắn..."
                value={formData.message}
                onChange={handleChange}
                required
              ></textarea>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <span className="loader"></span>
              ) : (
                <>
                  <Send size={18} /> Gửi ngay
                </>
              )}
            </button>
          </form>
        </div>

        {/* --- RIGHT: INFO CARD --- */}
        <div className="contact-info-wrapper">
          <div className="contact-info-card">
            <h3>Thông tin liên hệ</h3>
            <p className="subtitle">Chi tiết liên lạc trực tiếp</p>

            <div className="info-list">
              <div className="info-item">
                <div className="icon-box">
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
                <div className="icon-box">
                  <Phone size={20} />
                </div>
                <div>
                  <span className="label">Hotline (24/7)</span>
                  <p className="value highlight">1900 123 456</p>
                </div>
              </div>

              <div className="info-item">
                <div className="icon-box">
                  <Mail size={20} />
                </div>
                <div>
                  <span className="label">Email hỗ trợ</span>
                  <p className="value">support@restaurant.com</p>
                </div>
              </div>

              <div className="info-item">
                <div className="icon-box">
                  <Clock size={20} />
                </div>
                <div>
                  <span className="label">Giờ làm việc</span>
                  <p className="value">Thứ 2 - CN: 08:00 - 22:00</p>
                </div>
              </div>
            </div>

            <div className="divider"></div>

            <div className="social-links">
              <span className="label">Theo dõi chúng tôi:</span>
              <div className="icons">
                <a href="#" className="social-icon">
                  <Facebook size={20} />
                </a>
                <a href="#" className="social-icon">
                  <Instagram size={20} />
                </a>
                <a href="#" className="social-icon">
                  <Twitter size={20} />
                </a>
              </div>
            </div>
          </div>

          {/* Google Map Embed */}
          <div className="map-card">
            <iframe
              title="Google Map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.517826541815!2d106.70134531480082!3d10.771595292324754!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f40a3b49e59%3A0xa1bd14e483a602db!2sBitexco%20Financial%20Tower!5e0!3m2!1sen!2s!4v1625625000000!5m2!1sen!2s"
              width="100%"
              height="250"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
