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
    question: "Làm thế nào để đặt món ăn trên Cohan?",
    answer:
      "Để đặt món, bạn thực hiện các bước sau:\n1. Chọn nhà hàng và thêm món vào giỏ.\n2. Mở giỏ hàng, kiểm tra món và chọn mã giảm giá nếu có.\n3. Chọn phương thức thanh toán.\n4. Theo dõi trạng thái đơn trong mục Đơn hàng.",
    icon: <ShoppingBag size={20} aria-hidden="true" />,
  },
  {
    category: "booking",
    question: "Quy trình đặt bàn tại nhà hàng như thế nào?",
    answer:
      "Tại trang chi tiết nhà hàng, bạn nhấn Đặt bàn, chọn bàn trên sơ đồ, điền ngày giờ và thông tin liên hệ. Nếu có món đi kèm, hệ thống sẽ tính phần cọc món ở bước thanh toán.",
    icon: <BookOpen size={20} aria-hidden="true" />,
  },
  {
    category: "payment",
    question: "Tôi có thể thanh toán bằng những hình thức nào?",
    answer:
      "Cohan hỗ trợ ví Cohan Balance, tiền mặt khi nhận món và các phương thức thanh toán được bật theo từng nhà hàng. Một số đơn đặt bàn có thể yêu cầu cọc để giữ chỗ.",
    icon: <CreditCard size={20} aria-hidden="true" />,
  },
  {
    category: "account",
    question: "Làm sao để thay đổi địa chỉ giao hàng mặc định?",
    answer:
      "Bạn vào Hồ sơ hoặc Sổ địa chỉ, thêm địa chỉ mới hoặc chỉnh sửa địa chỉ hiện có. Nhấn Đặt làm mặc định ở địa chỉ muốn ưu tiên cho lần đặt món tiếp theo.",
    icon: <User size={20} aria-hidden="true" />,
  },
];

const HelpPage = () => {
  const [openIndex, setOpenIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [searchParams] = useSearchParams();
  const [inputMsg, setInputMsg] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
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

  const filteredFaqs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return FAQ_DATA;
    return FAQ_DATA.filter((item) =>
      [item.question, item.answer, item.category]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [searchTerm]);

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

  const openSupportChat = async () => {
    setIsChatOpen(true);
    setSupportNotice("");
    const id = await ensureSupportThread();
    if (!id) setSupportNotice("Bạn cần đăng nhập hoặc có ngữ cảnh nhà hàng để chat hỗ trợ.");
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = inputMsg.trim();
    if (!content) return;
    setSupportNotice("");
    const id = await ensureSupportThread();
    if (!id) {
      setSupportNotice("Bạn cần đăng nhập hoặc có ngữ cảnh nhà hàng để chat hỗ trợ.");
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

  const toggleChatFromHeader = (event) => {
    if (event.target.closest(".close-chat")) return;
    setIsChatOpen((open) => !open);
  };

  const handleChatHeaderKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleChatFromHeader(event);
  };

  const messages = thread?.messages || [];

  return (
    <main className="help-page">
      <section className="help-hero" aria-labelledby="help-title">
        <p className="help-eyebrow">Trung tâm hỗ trợ Cohan</p>
        <h1 id="help-title">Cần hỗ trợ gì hôm nay?</h1>
        <p className="subtitle">Tìm nhanh cách đặt món, đặt bàn, thanh toán hoặc chat trực tiếp với đội hỗ trợ.</p>
        <label className="search-box" htmlFor="help-search">
          <Search className="search-icon" size={20} aria-hidden="true" />
          <input
            id="help-search"
            type="text"
            placeholder="Tìm kiếm câu hỏi: hoàn tiền, đổi món, đặt bàn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </section>

      <div className="help-container">
        <div className="content-grid">
          <section className="faq-section" aria-labelledby="faq-title">
            <h2 className="section-title" id="faq-title">
              <HelpCircle size={24} aria-hidden="true" /> Câu hỏi thường gặp
            </h2>
            <div className="faq-list">
              {filteredFaqs.length ? (
                filteredFaqs.map((item, index) => {
                  const isOpen = openIndex === index;
                  const answerId = `faq-answer-${index}`;
                  return (
                    <article
                      key={`${item.category}-${item.question}`}
                      className={`faq-item ${isOpen ? "active" : ""}`}
                    >
                      <button
                        type="button"
                        className="faq-question"
                        onClick={() => toggleAccordion(index)}
                        aria-expanded={isOpen}
                        aria-controls={answerId}
                      >
                        <span className="q-content">
                          <span className="icon" aria-hidden="true">{item.icon}</span>
                          <span>{item.question}</span>
                        </span>
                        {isOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                      </button>
                      <div className="faq-answer" id={answerId} hidden={!isOpen}>
                        <div className="answer-inner">
                          {item.answer.split("\n").map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="faq-empty" role="status">
                  Không tìm thấy câu hỏi phù hợp. Bạn có thể chat với hỗ trợ để được xử lý nhanh hơn.
                </div>
              )}
            </div>
          </section>

          <aside className="contact-section" aria-label="Liên hệ hỗ trợ">
            <div className="contact-card">
              <h3>Liên hệ trực tiếp</h3>
              <p className="desc">Đội ngũ CSKH hoạt động từ 8:00 - 22:00 hàng ngày.</p>

              <ul className="contact-list">
                <li>
                  <div className="icon" aria-hidden="true"><Phone size={18} /></div>
                  <div><span className="label">Hotline</span><a href="tel:19001234" className="value">1900 1234</a></div>
                </li>
                <li>
                  <div className="icon" aria-hidden="true"><Mail size={18} /></div>
                  <div><span className="label">Email</span><a href="mailto:support@cohan.vn" className="value">support@cohan.vn</a></div>
                </li>
                <li>
                  <div className="icon" aria-hidden="true"><MapPin size={18} /></div>
                  <div><span className="label">Văn phòng</span><span className="value">Khu vận hành Cohan</span></div>
                </li>
              </ul>

              <div className="divider" />
              {supportNotice && <p className="support-notice" role="status">{supportNotice}</p>}
              <button
                type="button"
                className="btn-chat-trigger"
                onClick={openSupportChat}
              >
                <MessageCircle size={18} aria-hidden="true" /> Chat với hỗ trợ ngay
              </button>
            </div>
          </aside>
        </div>
      </div>

      <section className={`chatbot-widget ${isChatOpen ? "open" : ""}`} aria-label="Chat hỗ trợ Cohan">
        <div
          className="chat-header"
          role="button"
          tabIndex={0}
          onClick={toggleChatFromHeader}
          onKeyDown={handleChatHeaderKeyDown}
          aria-expanded={isChatOpen}
        >
          <span className="bot-info">
            <span className="avatar-dot" aria-hidden="true" />
            <span>Cohan Support</span>
          </span>
          <button
            type="button"
            className="close-chat"
            onClick={(e) => {
              e.stopPropagation();
              setIsChatOpen(false);
            }}
            aria-label="Đóng chat hỗ trợ"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {isChatOpen && (
          <>
            <div className="chat-body" aria-live="polite">
              {messages.length === 0 && (
                <div className="message bot">
                  <div className="bubble">Xin chào, bạn cần hỗ trợ gì hôm nay?</div>
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
              <label className="sr-only" htmlFor="support-message">Nhập nội dung hỗ trợ</label>
              <input
                id="support-message"
                type="text"
                placeholder="Nhập nội dung..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
              />
              <button type="submit" disabled={!inputMsg.trim() || sendMessageState.loading} aria-label="Gửi tin nhắn hỗ trợ">
                <Send size={16} aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </section>

      {!isChatOpen && (
        <button className="floating-chat-btn" type="button" onClick={openSupportChat} aria-label="Mở chat hỗ trợ">
          <MessageCircle size={28} aria-hidden="true" />
        </button>
      )}
    </main>
  );
};

export default HelpPage;
