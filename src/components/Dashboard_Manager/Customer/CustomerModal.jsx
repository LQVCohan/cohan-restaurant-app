// src/components/CustomerManagement/CustomerModal.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useMutation } from "@apollo/client";
import {
  Mail,
  Phone,
  Star,
  Zap,
  Sparkles,
  ShoppingBag,
  Wallet,
  Edit3,
  ArrowRight,
  TrendingUp,
  Clock,
  Tag,
  CreditCard,
  User,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import Modal from "../../../components/common/Modal";
import ChatThreadPanel from "../../../components/common/ChatThreadPanel";
import useCommunication from "../../../hooks/useCommunication";
import { AuthContext } from "../../../context/AuthContext";
import { useNotification } from "../../../hooks/useNotification";
import { UPDATE_CUSTOMER_NOTE } from "../../../hooks/useUserManagement";
import "./CustomerModal.scss";

/* ===== Helpers & Utils ===== */
const normalizeEpochToMs = (v) => {
  if (!v) return null;
  const num = Number(v);
  if (!Number.isNaN(num))
    return String(Math.floor(num)).length === 10 ? num * 1000 : num;
  const parsed = Date.parse(v);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (ts) => {
  const ms = normalizeEpochToMs(ts);
  return ms ? new Date(ms).toLocaleDateString("vi-VN") : "N/A";
};

const formatMoney = (amount) =>
  Number(amount || 0).toLocaleString("vi-VN") + "đ";

const getEntryAmount = (entry) => {
  if (entry?.raw?.totals?.grandTotal != null)
    return Number(entry.raw.totals.grandTotal);
  if (Array.isArray(entry?.raw?.items)) {
    return entry.raw.items.reduce(
      (sum, it) =>
        sum + ((it.price || 0) + (it.modifiersPrice || 0)) * (it.quantity || 1),
      0
    );
  }
  return Number(entry?.amount || 0);
};

/* ===== Config ===== */
const CUSTOMER_TIERS = {
  VIP: {
    label: "VIP",
    color: "bg-gradient-to-r from-amber-400 to-orange-500",
    icon: <Star size={12} fill="white" />,
  },
  OFTEN: {
    label: "Thân thiết",
    color: "bg-gradient-to-r from-blue-500 to-indigo-600",
    icon: <Zap size={12} fill="white" />,
  },
  NEW: {
    label: "Mới",
    color: "bg-gradient-to-r from-emerald-400 to-teal-500",
    icon: <Sparkles size={12} />,
  },
};

const STATUS_CONFIG = {
  pending: { label: "Chờ xác nhận", color: "#b45309", bg: "#fef3c7" },
  confirmed: { label: "Đã xác nhận", color: "#0369a1", bg: "#e0f2fe" },
  completed: { label: "Hoàn tất", color: "#15803d", bg: "#dcfce7" },
  cancelled: { label: "Đã hủy", color: "#b91c1c", bg: "#fee2e2" },
  default: { label: "Khác", color: "#475569", bg: "#f1f5f9" },
};

// Thêm prop isOpen vào đây để điều khiển modal
const CustomerModal = ({
  isOpen,
  customer,
  onClose,
  onShowBill,
  restaurantId: restaurantIdProp = null,
}) => {
  const { user, restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const [notes, setNotes] = useState(customer?.noteInternal || customer?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(customer?.noteInternal || customer?.notes || "");
  const [saveNotesMut, { loading: savingNotes }] = useMutation(UPDATE_CUSTOMER_NOTE);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatThreadId, setChatThreadId] = useState(null);
  const [chatError, setChatError] = useState("");

  const restaurantId = useMemo(() => {
    if (restaurantIdProp) return restaurantIdProp;
    return (
      user?.restaurantForStaff ||
      user?.refRestaurants?.[0] ||
      restaurants?.[0]?.id ||
      null
    );
  }, [restaurantIdProp, restaurants, user]);

  const {
    thread,
    threadLoading,
    threadError,
    loadThread,
    openThread,
    openThreadState,
    sendMessage,
    sendMessageState,
  } = useCommunication({ restaurantId });

  // 1. Data Processing
  const recentOrders = useMemo(() => customer?.recentOrders || [], [customer]);

  const stats = useMemo(() => {
    const count = recentOrders.length;
    const totalRaw = recentOrders.reduce(
      (sum, e) => sum + getEntryAmount(e),
      0
    );
    const avg = count > 0 ? totalRaw / count : 0;
    const pts = Number(customer?.loyaltyPoints || 0);

    let type = "NEW";
    if (pts > 15000) type = "VIP";
    else if (pts > 5000) type = "OFTEN";

    return { count, total: totalRaw, avg, points: pts, type };
  }, [recentOrders, customer?.loyaltyPoints]);

  const topItems = useMemo(() => {
    if (customer?.favoriteItems?.length > 0) return customer.favoriteItems;
    const itemMap = {};
    recentOrders.forEach((order) => {
      const items = order.items || order.raw?.items || [];
      items.forEach((i) => {
        const name = typeof i === "string" ? i : i.name;
        if (name) itemMap[name] = (itemMap[name] || 0) + (i.quantity || 1);
      });
    });
    return Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);
  }, [recentOrders, customer?.favoriteItems]);

  const walletStatus = useMemo(() => {
    const hasWallet = customer?.wallet?.id || customer?.hasWallet;
    const isActive = customer?.wallet?.isActive ?? hasWallet;
    if (isActive) return { label: "Đang hoạt động", cls: "active" };
    return { label: "Chưa kích hoạt", cls: "inactive" };
  }, [customer]);

  const tier = CUSTOMER_TIERS[stats.type] || CUSTOMER_TIERS.NEW;
  const joinDate = formatDate(customer?.joinDate);

  useEffect(() => {
    setChatOpen(false);
    setChatThreadId(null);
    setChatError("");
  }, [customer?.id]);

  useEffect(() => {
    const incomingNotes = customer?.noteInternal || customer?.notes || "";
    setNotes(incomingNotes);
    setTempNotes(incomingNotes);
    setIsEditingNotes(false);
  }, [customer?.id, customer?.noteInternal, customer?.notes]);

  const handleSaveNotes = async () => {
    if (!customer?.id) return;
    if (!restaurantId) {
      showNotification("Thiếu ngữ cảnh nhà hàng để lưu ghi chú.", "error");
      return;
    }
    try {
      const { data } = await saveNotesMut({
        variables: {
          customerId: customer.id,
          restaurantId,
          noteInternal: tempNotes || "",
        },
      });
      const persistedNote = data?.updateCustomerNote?.noteInternal ?? tempNotes ?? "";
      setNotes(persistedNote);
      setTempNotes(persistedNote);
      setIsEditingNotes(false);
      showNotification("Đã lưu ghi chú khách hàng.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể lưu ghi chú khách hàng.", "error");
    }
  };

  const openCustomerChat = async () => {
    setChatOpen(true);
    setChatError("");

    if (!customer?.id) {
      setChatError("Không xác định được khách hàng để mở hội thoại.");
      return;
    }
    if (!restaurantId) {
      setChatError("Thiếu ngữ cảnh nhà hàng, chưa thể mở hội thoại.");
      return;
    }

    try {
      const { data } = await openThread({
        variables: {
          input: {
            restaurantId,
            channel: "support",
            targetRole: "support",
            subject: `Khách hàng #${String(customer.id).padStart(4, "0")} - ${
              customer?.name || "Khách vãng lai"
            }`,
          },
        },
      });

      const openedId = data?.openChatThread?.id || null;
      if (!openedId) {
        setChatError("Không thể khởi tạo hội thoại lúc này.");
        return;
      }

      setChatThreadId(openedId);
      await loadThread({ variables: { id: openedId } });
    } catch (err) {
      setChatError(err?.message || "Không thể mở hội thoại.");
    }
  };

  const handleSendMessage = async (content) => {
    setChatError("");

    if (!chatThreadId) {
      setChatError("Chưa có hội thoại để gửi tin.");
      throw new Error("Missing thread");
    }

    try {
      await sendMessage({
        variables: {
          input: {
            threadId: chatThreadId,
            content,
          },
        },
      });
      await loadThread({ variables: { id: chatThreadId } });
    } catch (err) {
      setChatError(err?.message || "Gửi tin nhắn thất bại.");
      throw err;
    }
  };

  const chatSubtitle = `${customer?.phone || "Chưa có SĐT"}${
    customer?.email ? ` • ${customer.email}` : ""
  }`;

  return (
    <Modal
      isOpen={isOpen} // Sử dụng prop isOpen được truyền vào
      onClose={onClose}
      title="Chi tiết khách hàng"
      size="full"
      closeOnOverlayClick
    >
      {/* 1. Header chuẩn của Modal mới */}
      <Modal.Header onClose={onClose}>
        <div className="flex items-center gap-2">
          <User size={20} className="text-blue-600" />
          <span>Hồ sơ khách hàng</span>
        </div>
      </Modal.Header>

      {/* 2. Body chứa toàn bộ nội dung chính */}
      <Modal.Body>
        <div className="customer-modal-content">
          {/* Profile Banner */}
          <div className="cm-header-modern">
            <div className="profile-left">
              <div className="avatar-ring">
                {customer?.avatar || (
                  <User size={28} className="text-blue-500" />
                )}
              </div>
              <div className="info-block">
                <h2>{customer?.name || "Khách vãng lai"}</h2>
                <div className="meta-badges">
                  <span className="badge-id">
                    #{String(customer?.id || 0).padStart(4, "0")}
                  </span>
                  <span className={`badge-tier ${tier.color}`}>
                    {tier.icon} {tier.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="points-right">
              <div className="pts-val">{stats.points.toLocaleString()}</div>
              <div className="pts-lbl">Điểm tích lũy</div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="cm-stats-modern">
            <div className="stat-item">
              <div className="stat-icon bg-green-100 text-green-600">
                <TrendingUp size={18} />
              </div>
              <div className="stat-value">{formatMoney(stats.total)}</div>
              <div className="stat-label">Tổng chi tiêu</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon bg-blue-100 text-blue-600">
                <ShoppingBag size={18} />
              </div>
              <div className="stat-value">{stats.count} đơn</div>
              <div className="stat-label">Tổng đơn hàng</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon bg-purple-100 text-purple-600">
                <CreditCard size={18} />
              </div>
              <div className="stat-value">{formatMoney(stats.avg)}</div>
              <div className="stat-label">Trung bình/Đơn</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon bg-amber-100 text-amber-600">
                <Clock size={18} />
              </div>
              <div className="stat-value">{joinDate}</div>
              <div className="stat-label">Ngày tham gia</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon bg-emerald-100 text-emerald-600">
                <Clock size={18} />
              </div>
              <div className="stat-value">
                {Number(customer?.loyaltyDurationScore || 0)} ngày
              </div>
              <div className="stat-label">Điểm gắn bó</div>
            </div>
          </div>

          {/* Insights Row */}
          <div className="cm-insights-grid">
            <div className="insight-card">
              <div className="card-title">
                <User size={14} /> Thông tin cá nhân
              </div>
              <div className="contact-list">
                <div className="c-item" title="Trạng thái">
                  <span
                    className="icon"
                    style={{ color: customer?.online ? "#16a34a" : "#64748b" }}
                  >
                    ●
                  </span>{" "}
                  {customer?.online ? "Online" : "Offline"}
                </div>
                <div className="c-item" title="Xác minh">
                  <UserCheck size={14} className="icon" />{" "}
                  {customer?.verificationStatus === "verified"
                    ? "Đã xác minh"
                    : "Chưa xác minh"}
                </div>
                <div className="c-item" title="Email">
                  <Mail size={14} className="icon" /> {customer?.email || "—"}
                </div>
                <div className="c-item" title="Điện thoại">
                  <Phone size={14} className="icon" /> {customer?.phone || "—"}
                </div>
              </div>

              <div className="wallet-status-block">
                <span className="w-label flex items-center gap-2">
                  <Wallet size={14} /> Ví điện tử
                </span>
                <span className={`w-badge ${walletStatus.cls}`}>
                  <span className="dot"></span> {walletStatus.label}
                </span>
              </div>
            </div>

            <div className="insight-card">
              <div className="card-title text-orange-600">
                <Star size={14} /> Món yêu thích
              </div>
              <div className="chips-container mb-3">
                {topItems.length > 0 ? (
                  topItems.map((item, idx) => (
                    <span key={idx} className="chip fav">
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="empty-text">Chưa có dữ liệu món ăn</span>
                )}
              </div>

              <div className="card-title mt-auto">
                <Tag size={14} /> Nhãn (Tags)
              </div>
              <div className="chips-container">
                {(customer?.refRestaurants || []).slice(0, 2).map((r) => (
                  <span className="chip" key={r.id || r.name}>
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Main Body: History vs Notes */}
          <div className="cm-body-split">
            <div className="orders-section">
              <div className="section-header">
                <h3>Lịch sử gần đây</h3>
                <button className="text-xs text-blue-600 font-medium hover:underline">
                  Xem tất cả
                </button>
              </div>
              <div className="order-rows">
                {recentOrders.length > 0 ? (
                  recentOrders.slice(0, 5).map((order, i) => {
                    const stKey = (
                      order.status ||
                      order.raw?.currentStatus ||
                      "default"
                    ).toLowerCase();
                    const st = STATUS_CONFIG[stKey] || STATUS_CONFIG.default;
                    return (
                      <div
                        key={i}
                        className="order-row"
                        onClick={() => onShowBill && onShowBill(order)}
                      >
                        <div className="o-date">
                          {formatDate(order.raw?.createdAt || Date.now())}
                        </div>
                        <div className="o-price">
                          {formatMoney(getEntryAmount(order))}
                        </div>
                        <div className="o-status">
                          <span
                            style={{ color: st.color, backgroundColor: st.bg }}
                          >
                            {st.label}
                          </span>
                        </div>
                        <div className="o-arrow">
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Chưa có đơn hàng nào
                  </div>
                )}
              </div>
            </div>

            <div className="notes-section">
              <div className="notes-header">
                <h3>
                  <Edit3 size={14} /> Ghi chú nội bộ
                </h3>
                {!isEditingNotes && (
                  <button onClick={() => setIsEditingNotes(true)}>
                    Chỉnh sửa
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <>
                  <textarea
                    rows={6}
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    placeholder="Ghi lại lưu ý về khách hàng..."
                    autoFocus
                  />
                  <div className="action-row">
                    <button className="save" onClick={handleSaveNotes} disabled={savingNotes}>
                      {savingNotes ? "Đang lưu..." : "Lưu"}
                    </button>
                    <button
                      className="cancel"
                      onClick={() => {
                        setIsEditingNotes(false);
                        setTempNotes(notes);
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </>
              ) : (
                <div
                  className="note-display"
                  onClick={() => setIsEditingNotes(true)}
                >
                  {notes || (
                    <em className="text-gray-400">Chạm để thêm ghi chú...</em>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>

      {/* 3. Footer */}
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onClose}>
          Đóng
        </button>
        <button className="btn btn-primary" onClick={openCustomerChat}>
          <MessageSquare size={16} className="mr-2" /> Gửi tin nhắn
        </button>
      </Modal.Footer>

      <ChatThreadPanel
        open={chatOpen}
        title={`Nhắn tin: ${customer?.name || "Khách hàng"}`}
        subtitle={chatSubtitle}
        meId={user?.id}
        messages={thread?.messages || []}
        loading={openThreadState.loading || threadLoading}
        error={chatError || threadError}
        sending={sendMessageState.loading}
        composerDisabled={!chatThreadId || Boolean(chatError)}
        composerPlaceholder={
          chatThreadId
            ? "Nhập nội dung tin nhắn..."
            : "Đang khởi tạo hội thoại..."
        }
        onClose={() => {
          setChatOpen(false);
          setChatError("");
        }}
        onSend={handleSendMessage}
      />
    </Modal>
  );
};

export default CustomerModal;
