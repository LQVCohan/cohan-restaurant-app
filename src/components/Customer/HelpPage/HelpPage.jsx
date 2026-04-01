import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
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
import { AuthContext } from "@/context/AuthContext";
import { useSearchParams } from "react-router-dom";
import useCommunication from "@/hooks/useCommunication";
import "./HelpPage.scss";

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
  const [openIndex, setOpenIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [searchParams] = useSearchParams();
  const [inputMsg, setInputMsg] = useState("");
  const messagesEndRef = useRef(null);

  const { user } = useContext(AuthContext) || {};
  const restaurantId = useMemo(
    () => user?.refRestaurants?.[0] || user?.restaurantForStaff || null,
    [user]
  );

  const {
    thread,
    loadThread,
    openThread,
    sendMessage,
    sendMessageState,
    markThreadRead,
  } = useCommunication({ restaurantId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages, isChatOpen]);


  useEffect(() => {
    const fromUrl = searchParams.get("threadId");
    if (fromUrl) {
      setIsChatOpen(true);
      setThreadId(fromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!threadId) return;
    loadThread({ variables: { id: threadId } });
    markThreadRead({ variables: { threadId } }).catch(() => {});
  }, [threadId, loadThread, markThreadRead]);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const ensureSupportThread = async () => {
    if (threadId) return threadId;
    if (!restaurantId) return null;
    const { data } = await openThread({
      variables: {
        input: {
          restaurantId,
          channel: "support",
          subject: "Hỗ trợ khách hàng",
          targetRole: "support",
        },
      },
    });
    const id = data?.openChatThread?.id || null;
    setThreadId(id);
    return id;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = inputMsg.trim();
    if (!content) return;
    const id = await ensureSupportThread();
    if (!id) {
      alert("Bạn cần đăng nhập/tạo ngữ cảnh nhà hàng để chat hỗ trợ.");
      return;
    }

    await sendMessage({
      variables: {
        input: {
          threadId: id,
          content,
        },
      },
    });
    setInputMsg("");
    await loadThread({ variables: { id } });
  };

  const messages = thread?.messages || [];

  return (
    <div className="help-page">
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
        <div className="content-grid">
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
                  <button className="faq-question" onClick={() => toggleAccordion(index)}>
                    <div className="q-content">
                      <span className="icon">{item.icon}</span>
                      <span>{item.question}</span>
                    </div>
                    {openIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
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

          <div className="contact-section">
            <div className="contact-card">
              <h3>Liên hệ trực tiếp</h3>
              <p className="desc">Đội ngũ CSKH hoạt động từ 8:00 - 22:00 hàng ngày.</p>

              <ul className="contact-list">
                <li>
                  <div className="icon"><Phone size={18} /></div>
                  <div><span className="label">Hotline</span><a href="tel:19001234" className="value">1900 1234</a></div>
                </li>
                <li>
                  <div className="icon"><Mail size={18} /></div>
                  <div><span className="label">Email</span><a href="mailto:support@foodhub.vn" className="value">support@foodhub.vn</a></div>
                </li>
                <li>
                  <div className="icon"><MapPin size={18} /></div>
                  <div><span className="label">Văn phòng</span><span className="value">Tầng 12, Tòa nhà Bitexco, Q.1, TP.HCM</span></div>
                </li>
              </ul>

              <div className="divider"></div>
              <button
                className="btn-chat-trigger"
                onClick={async () => {
                  setIsChatOpen(true);
                  await ensureSupportThread();
                }}
              >
                <MessageCircle size={18} /> Chat với hỗ trợ ngay
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`chatbot-widget ${isChatOpen ? "open" : ""}`}>
        <div className="chat-header" onClick={() => setIsChatOpen(!isChatOpen)}>
          <div className="bot-info">
            <div className="avatar-dot"></div>
            <span>FoodHub Support</span>
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

        {isChatOpen && (
          <>
            <div className="chat-body">
              {messages.length === 0 && (
                <div className="message bot">
                  <div className="bubble">Xin chào! Bạn cần hỗ trợ gì hôm nay?</div>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.createdAt}_${idx}`}
                  className={`message ${String(msg.senderId) === String(user?.id) ? "user" : "bot"}`}
                >
                  <div className="bubble">{msg.text || msg.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Nhập nội dung..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
              />
              <button type="submit" disabled={!inputMsg.trim() || sendMessageState.loading}>
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>

      {!isChatOpen && (
        <button className="floating-chat-btn" onClick={() => setIsChatOpen(true)}>
          <MessageCircle size={28} />
        </button>
      )}
    </div>
  );
};

export default HelpPage;
