import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  X,
  BookOpen,
  ShoppingBag,
  CreditCard,
  User,
} from "lucide-react";
import "./HelpPage.scss";

// --- DỮ LIỆU HƯỚNG DẪN (FAQ) ---
const FAQ_DATA = [
  {
    category: "order",
    question: "Làm thế nào để đặt món ăn trên FoodHub?",
    answer:
      "Để đặt món, bạn thực hiện các bước sau:\n1. Nhập địa chỉ của bạn để tìm quán gần nhất.\n2. Chọn nhà hàng và thêm món vào giỏ.\n3. Nhấn vào icon Giỏ hàng, kiểm tra lại món và chọn mã giảm giá.\n4. Chọn phương thức thanh toán và nhấn 'Đặt đơn'.",
    icon: <ShoppingBag size={20} />,
  },
  {
    category: "booking",
    question: "Quy trình đặt bàn tại nhà hàng như thế nào?",
    answer:
      "Rất đơn giản! Tại trang chi tiết Nhà hàng:\n1. Nhấn nút 'Đặt bàn'.\n2. Chọn ngày, giờ và số lượng người.\n3. Điền thông tin liên hệ và ghi chú (nếu có).\n4. Nhận xác nhận qua SMS/App ngay lập tức.",
    icon: <BookOpen size={20} />,
  },
  {
    category: "payment",
    question: "Tôi có thể thanh toán bằng những hình thức nào?",
    answer:
      "FoodHub hỗ trợ đa dạng phương thức:\n- Tiền mặt (COD)\n- Ví điện tử: MoMo, ZaloPay, ShopeePay\n- Thẻ ngân hàng (ATM/Visa/Mastercard)",
    icon: <CreditCard size={20} />,
  },
  {
    category: "account",
    question: "Làm sao để thay đổi địa chỉ giao hàng mặc định?",
    answer:
      "Bạn vào mục 'Tài khoản' -> Chọn 'Sổ địa chỉ'. Tại đây bạn có thể thêm mới, sửa hoặc xóa địa chỉ. Nhấn 'Đặt làm mặc định' ở địa chỉ bạn muốn ưu tiên.",
    icon: <User size={20} />,
  },
];

const HelpPage = () => {
  const [openIndex, setOpenIndex] = useState(0); // Mặc định mở câu đầu tiên
  const [searchTerm, setSearchTerm] = useState("");

  // --- CHATBOT STATE ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Xin chào! Tôi là trợ lý ảo FoodHub. Tôi có thể giúp gì cho bạn hôm nay?",
      sender: "bot",
    },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const messagesEndRef = useRef(null);

  // Scroll xuống cuối chat khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatOpen]);

  // Logic Toggle Accordion
  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Logic Gửi tin nhắn & Bot phản hồi (Simulation)
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    // 1. Add User Message
    const userMsg = { id: Date.now(), text: inputMsg, sender: "user" };
    setMessages((prev) => [...prev, userMsg]);
    setInputMsg("");

    // 2. Simulate Bot Thinking & Reply
    setTimeout(() => {
      let botText =
        "Cảm ơn bạn đã đặt câu hỏi. Nhân viên tư vấn sẽ sớm liên hệ lại.";
      const lowerMsg = userMsg.text.toLowerCase();

      // Logic trả lời đơn giản theo từ khóa
      if (lowerMsg.includes("đặt món") || lowerMsg.includes("mua")) {
        botText =
          "Để đặt món, bạn hãy chọn nhà hàng yêu thích, thêm món vào giỏ và tiến hành thanh toán nhé!";
      } else if (
        lowerMsg.includes("khuyến mãi") ||
        lowerMsg.includes("voucher")
      ) {
        botText =
          "Bạn có thể xem các mã giảm giá mới nhất tại mục 'Kho Voucher' trên thanh menu.";
      } else if (lowerMsg.includes("lỗi") || lowerMsg.includes("không được")) {
        botText =
          "Rất tiếc vì sự cố này. Bạn vui lòng chụp màn hình và gửi qua Zalo 0909.123.456 để kỹ thuật viên hỗ trợ ngay ạ.";
      } else if (lowerMsg.includes("chào") || lowerMsg.includes("hi")) {
        botText =
          "Chào bạn! Chúc bạn một ngày tốt lành. Bạn cần hỗ trợ vấn đề gì không?";
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: botText, sender: "bot" },
      ]);
    }, 1000);
  };

  return (
    <div className="help-page">
      {/* HERO SECTION */}
      <div className="help-hero">
        <h1>Xin chào, chúng tôi có thể giúp gì?</h1>
        <div className="search-box">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm câu hỏi (ví dụ: hoàn tiền, đổi món...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="help-container">
        {/* MAIN LAYOUT: LEFT (FAQ) - RIGHT (CONTACT) */}
        <div className="content-grid">
          {/* CỘT TRÁI: FAQ */}
          <div className="faq-section">
            <h2 className="section-title">
              <HelpCircle size={24} /> Câu hỏi thường gặp
            </h2>
            <div className="faq-list">
              {FAQ_DATA.filter((item) =>
                item.question.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((item, index) => (
                <div
                  key={index}
                  className={`faq-item ${openIndex === index ? "active" : ""}`}
                >
                  <button
                    className="faq-question"
                    onClick={() => toggleAccordion(index)}
                  >
                    <div className="q-content">
                      <span className="icon">{item.icon}</span>
                      <span>{item.question}</span>
                    </div>
                    {openIndex === index ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                  <div className="faq-answer">
                    <div className="answer-inner">
                      {item.answer.split("\n").map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CỘT PHẢI: CONTACT INFO */}
          <div className="contact-section">
            <div className="contact-card">
              <h3>Liên hệ trực tiếp</h3>
              <p className="desc">
                Đội ngũ CSKH hoạt động từ 8:00 - 22:00 hàng ngày.
              </p>

              <ul className="contact-list">
                <li>
                  <div className="icon">
                    <Phone size={18} />
                  </div>
                  <div>
                    <span className="label">Hotline</span>
                    <a href="tel:19001234" className="value">
                      1900 1234
                    </a>
                  </div>
                </li>
                <li>
                  <div className="icon">
                    <Mail size={18} />
                  </div>
                  <div>
                    <span className="label">Email</span>
                    <a href="mailto:support@foodhub.vn" className="value">
                      support@foodhub.vn
                    </a>
                  </div>
                </li>
                <li>
                  <div className="icon">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <span className="label">Văn phòng</span>
                    <span className="value">
                      Tầng 12, Tòa nhà Bitexco, Q.1, TP.HCM
                    </span>
                  </div>
                </li>
              </ul>

              <div className="divider"></div>
              <button
                className="btn-chat-trigger"
                onClick={() => setIsChatOpen(true)}
              >
                <MessageCircle size={18} /> Chat với hỗ trợ ngay
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- CHATBOT WIDGET (FLOATING) --- */}
      <div className={`chatbot-widget ${isChatOpen ? "open" : ""}`}>
        {/* Chat Header */}
        <div className="chat-header" onClick={() => setIsChatOpen(!isChatOpen)}>
          <div className="bot-info">
            <div className="avatar-dot"></div>
            <span>FoodHub Assistant</span>
          </div>
          <button
            className="close-chat"
            onClick={(e) => {
              e.stopPropagation();
              setIsChatOpen(false);
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat Body */}
        {isChatOpen && (
          <>
            <div className="chat-body">
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.sender}`}>
                  {msg.sender === "bot" && (
                    <div className="bot-avatar">
                      <HelpCircle size={14} />
                    </div>
                  )}
                  <div className="bubble">{msg.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Nhập nội dung..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
              />
              <button type="submit" disabled={!inputMsg.trim()}>
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>

      {/* Nút tròn nổi bật bật Chat khi widget đóng */}
      {!isChatOpen && (
        <button
          className="floating-chat-btn"
          onClick={() => setIsChatOpen(true)}
        >
          <MessageCircle size={28} />
        </button>
      )}
    </div>
  );
};

export default HelpPage;
