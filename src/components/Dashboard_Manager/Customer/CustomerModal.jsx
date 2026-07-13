// src/components/CustomerManagement/CustomerModal.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import {
  Mail,
  Phone,
  Star,
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
import {
  RESEND_USER_VERIFICATION,
  UPDATE_CUSTOMER_NOTE,
} from "../../../hooks/useUserManagement";
import "./CustomerModal.scss";
import "./CustomerModalPolish.scss";
import "./CustomerModalPremiumTune.scss";
import CustomerAvatarMedia from "./CustomerAvatarMedia";
import { getRankDisplayConfig } from "./customerRankUtils";
import { navigateToManagerOrders } from "./customerOrderNavigation";

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
      0,
    );
  }
  return Number(entry?.amount || 0);
};

/* ===== Config ===== */
const STATUS_CONFIG = {
  pending: { label: "Chờ xác nhận", color: "#b45309", bg: "#fef3c7" },
  confirmed: { label: "Đã xác nhận", color: "#0369a1", bg: "#e0f2fe" },
  completed: { label: "Hoàn tất", color: "#15803d", bg: "#dcfce7" },
  cancelled: { label: "Đã hủy", color: "#b91c1c", bg: "#fee2e2" },
  default: { label: "Khác", color: "#475569", bg: "#f1f5f9" },
};

const GET_CUSTOMER_DETAIL_ANALYTICS = gql`
  query GetCustomerDetailAnalytics($userId: ID!, $restaurantId: ID) {
    customerDetailAnalytics(userId: $userId, restaurantId: $restaurantId) {
      rankPoints
      loyaltyDurationScore
      favoriteFoods
      topDishes {
        dishName
        quantity
      }
    }
  }
`;

const CustomerModal = ({
  isOpen,
  customer,
  onClose,
  onShowBill,
  restaurantId: restaurantIdProp = null,
}) => {
  const { user, restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const apolloClient = useApolloClient();
  const [notes, setNotes] = useState(
    customer?.noteInternal || customer?.notes || "",
  );
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(
    customer?.noteInternal || customer?.notes || "",
  );
  const [saveNotesMut, { loading: savingNotes }] =
    useMutation(UPDATE_CUSTOMER_NOTE);
  const [resendVerificationMut, { loading: resendingVerification }] =
    useMutation(RESEND_USER_VERIFICATION);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatThreadId, setChatThreadId] = useState(null);
  const [chatError, setChatError] = useState("");

  const restaurantId = useMemo(() => {
    if (restaurantIdProp) return restaurantIdProp;
    return (
      user?.restaurantForStaff ||
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

  const recentOrders = useMemo(() => customer?.recentOrders || [], [customer]);
  const openOrderHistory = (order = null, viewAll = false) => {
    if (!viewAll && typeof onShowBill === "function") {
      onShowBill(order?.raw || order);
      return;
    }
    const navigated = navigateToManagerOrders({
      order,
      customer,
      restaurantId,
      viewAll,
    });
    if (navigated) onClose?.();
  };

  const { data: detailAnalyticsData } = useQuery(
    GET_CUSTOMER_DETAIL_ANALYTICS,
    {
      skip: !isOpen || !customer?.id,
      variables: { userId: String(customer?.id || ""), restaurantId },
      fetchPolicy: "network-only",
      errorPolicy: "all",
    },
  );
  const detailAnalytics = detailAnalyticsData?.customerDetailAnalytics || null;

  const rankConfig = useMemo(
    () =>
      getRankDisplayConfig(
        customer?.customerType || customer?.rankName,
        customer?.rankSettings || [],
      ),
    [customer?.customerType, customer?.rankName, customer?.rankSettings],
  );

  const stats = useMemo(() => {
    const fallbackCount = recentOrders.length;
    const fallbackTotal = recentOrders.reduce(
      (sum, e) => sum + getEntryAmount(e),
      0,
    );
    const total = Number(customer?.totalSpending);
    const count = Number(customer?.totalOrders);
    const safeCount =
      Number.isFinite(count) && count >= 0 ? count : fallbackCount;
    const safeTotal =
      Number.isFinite(total) && total >= 0 ? total : fallbackTotal;
    const avg = safeCount > 0 ? safeTotal / safeCount : 0;
    const points = Number(
      customer?.loyaltyPoints || detailAnalytics?.rankPoints || 0,
    );

    return { count: safeCount, total: safeTotal, avg, points };
  }, [
    customer?.totalSpending,
    customer?.totalOrders,
    customer?.loyaltyPoints,
    detailAnalytics?.rankPoints,
    recentOrders,
  ]);

  const topItems = useMemo(() => {
    if (customer?.favoriteItems?.length > 0) return customer.favoriteItems;
    if (detailAnalytics?.favoriteFoods?.length)
      return detailAnalytics.favoriteFoods.filter(Boolean).slice(0, 5);
    if (detailAnalytics?.topDishes?.length)
      return detailAnalytics.topDishes
        .map((dish) => dish?.dishName)
        .filter(Boolean)
        .slice(0, 5);
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
  }, [
    recentOrders,
    customer?.favoriteItems,
    detailAnalytics?.favoriteFoods,
    detailAnalytics?.topDishes,
  ]);

  const walletStatus = useMemo(() => {
    const hasWallet = customer?.wallet?.id || customer?.hasWallet;
    const isActive = customer?.wallet?.isActive ?? hasWallet;
    if (isActive) return { label: "Đang hoạt động", cls: "active" };
    return { label: "Chưa kích hoạt", cls: "inactive" };
  }, [customer]);

  const displayName =
    customer?.displayName ||
    customer?.name ||
    customer?.fullName ||
    "Khách vãng lai";
  const customerCode = String(customer?.id || 0).padStart(4, "0");
  const joinDate = formatDate(
    customer?.joinDate || customer?.registeredAt || customer?.createdAt,
  );
  const loyaltyDuration = Number(
    customer?.loyaltyDurationScore ??
      detailAnalytics?.loyaltyDurationScore ??
      0,
  );
  const verificationText =
    customer?.verificationLabel ||
    (customer?.verificationStatus === "verified"
      ? "Đã xác minh"
      : "Chưa xác minh");
  const isGuestCustomer = Boolean(customer?.isGuest || customer?.isGuestBadge);

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

  const handleResendVerification = async (channel = "AUTO") => {
    if (!customer?.id) return;
    try {
      const { data } = await resendVerificationMut({
        variables: { userId: customer.id, channel },
      });
      const result = data?.resendUserVerification;
      if (result?.status === "SENT")
        showNotification("Đã gửi xác nhận.", "success");
      else if (result?.status === "ALREADY_VERIFIED")
        showNotification(
          "Tài khoản đã được xác minh, không cần gửi lại.",
          "success",
        );
      else if (result?.status === "COOLDOWN")
        showNotification("Vui lòng chờ trước khi gửi lại xác nhận.", "warning");
      else if (result?.status === "NOT_CONFIGURED")
        showNotification(
          "Email/SMS provider chưa được cấu hình. Tài khoản đã tạo nhưng chưa gửi xác nhận.",
          "warning",
        );
      else
        showNotification(
          result?.message || result?.errors?.[0] || "Không thể gửi xác nhận.",
          "warning",
        );
      try {
        await apolloClient.refetchQueries({
          include: ["GetCustomerListPage", "GetCustomers", "GetUsers"],
        });
      } catch (refetchErr) {
        console.warn("Refetch customer verification state failed:", refetchErr);
      }
    } catch (err) {
      showNotification(err?.message || "Không thể gửi xác nhận.", "error");
    }
  };

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
      const persistedNote =
        data?.updateCustomerNote?.noteInternal ?? tempNotes ?? "";
      setNotes(persistedNote);
      setTempNotes(persistedNote);
      setIsEditingNotes(false);
      showNotification("Đã lưu ghi chú khách hàng.", "success");
    } catch (err) {
      showNotification(
        err?.message || "Không thể lưu ghi chú khách hàng.",
        "error",
      );
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
            subject: `Khách hàng #${String(customer.id).padStart(4, "0")} - ${displayName || "Khách vãng lai"}`,
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
      throw new Error("Missing chat thread");
    }
    try {
      await sendMessage({
        variables: { input: { threadId: chatThreadId, content } },
      });
      await loadThread({ variables: { id: chatThreadId } });
    } catch (err) {
      setChatError(err?.message || "Gửi tin nhắn thất bại.");
      throw err;
    }
  };

  const chatSubtitle = `${customer?.phone || "Chưa có SĐT"}${customer?.email ? ` • ${customer.email}` : ""}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chi tiết khách hàng"
      size="xl"
      className="customer-profile-modal"
      closeOnOverlayClick
    >
      <Modal.Body className="customer-modal-body">
        <div className="customer-modal-content">
          <section
            className="cm-profile-hero"
            aria-label="Tổng quan hồ sơ khách hàng"
          >
            <div className="cm-profile-hero__identity">
              <div className="cm-avatar-card">
                <div className="cm-avatar-card__mark">
                  <CustomerAvatarMedia
                    customer={customer}
                    name={displayName}
                    iconSize={30}
                  />
                </div>
                <span className={customer?.online ? "is-online" : ""} />
              </div>
              <div className="cm-profile-hero__copy">
                <span className="cm-eyebrow">Hồ sơ khách hàng</span>
                <h2>{displayName}</h2>
                <div className="cm-profile-tags">
                  <span>#{customerCode}</span>
                  <span className={`tier-${rankConfig.variant}`}>
                    <Star size={13} />
                    {rankConfig.label}
                  </span>
                  {isGuestCustomer ? (
                    <span>Guest</span>
                  ) : (
                    <span>Đã đăng ký</span>
                  )}
                  <span>{verificationText}</span>
                </div>
              </div>
            </div>
            <div className="cm-profile-hero__points">
              <span>Điểm gắn bó</span>
              <strong>{stats.points.toLocaleString("vi-VN")}</strong>
              <small>
                {loyaltyDuration.toLocaleString("vi-VN")} ngày trong hệ thống
              </small>
            </div>
          </section>

          <section className="cm-metric-grid" aria-label="Chỉ số khách hàng">
            <article>
              <TrendingUp size={18} />
              <span>Tổng chi tiêu</span>
              <strong>{formatMoney(stats.total)}</strong>
            </article>
            <article>
              <ShoppingBag size={18} />
              <span>Tổng đơn hàng</span>
              <strong>{stats.count.toLocaleString("vi-VN")} đơn</strong>
            </article>
            <article>
              <CreditCard size={18} />
              <span>Trung bình/đơn</span>
              <strong>{formatMoney(stats.avg)}</strong>
            </article>
            <article>
              <Clock size={18} />
              <span>Ngày tham gia</span>
              <strong>{joinDate}</strong>
            </article>
          </section>

          <section className="cm-detail-grid">
            <article className="cm-panel cm-panel--contact">
              <div className="cm-panel__title">
                <User size={15} />
                Thông tin cá nhân
              </div>
              <div className="cm-contact-list">
                <div className="cm-contact-row">
                  <span
                    className={`cm-dot ${customer?.online ? "is-live" : ""}`}
                  />
                  <strong>
                    {customer?.online
                      ? "Hoạt động gần đây"
                      : "Không hoạt động gần đây"}
                  </strong>
                </div>
                <div className="cm-contact-row">
                  <UserCheck size={15} />
                  <strong>{verificationText}</strong>
                  {customer?.verificationStatus !== "verified" && (
                    <button
                      type="button"
                      onClick={() => handleResendVerification("AUTO")}
                      disabled={
                        resendingVerification ||
                        (!customer?.email && !customer?.phone)
                      }
                    >
                      Nhắc gửi
                    </button>
                  )}
                </div>
                <div className="cm-contact-row">
                  <Mail size={15} />
                  <span>{customer?.email || "—"}</span>
                </div>
                <div className="cm-contact-row">
                  <Phone size={15} />
                  <span>{customer?.phone || "—"}</span>
                </div>
              </div>
              <div className="cm-wallet-line">
                <span>
                  <Wallet size={15} /> Ví điện tử
                </span>
                <strong className={`w-badge ${walletStatus.cls}`}>
                  {walletStatus.label}
                </strong>
              </div>
            </article>

            <article className="cm-panel cm-panel--favorites">
              <div className="cm-panel__title">
                <Star size={15} />
                Món yêu thích
              </div>
              <div className="cm-chip-list">
                {topItems.length > 0 ? (
                  topItems.map((item, idx) => (
                    <span key={idx} className="cm-chip cm-chip--food">
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="cm-empty-inline">
                    Chưa có dữ liệu món ăn
                  </span>
                )}
              </div>
              <div className="cm-panel__title cm-panel__title--sub">
                <Tag size={15} />
                Nhãn
              </div>
              <div className="cm-chip-list">
                {(customer?.refRestaurants || []).slice(0, 2).map((r) => (
                  <span className="cm-chip" key={r.id || r.name}>
                    {r.name}
                  </span>
                ))}
                {!(customer?.refRestaurants || []).length && (
                  <span className="cm-chip">Cohan Restaurant</span>
                )}
              </div>
            </article>

            <article className="cm-panel cm-panel--orders">
              <div className="cm-section-header">
                <div>
                  <span>Hoạt động mua hàng</span>
                  <h3>Lịch sử gần đây</h3>
                </div>
                <button
                  type="button"
                  onClick={() => openOrderHistory(null, true)}
                  aria-label={`Xem tất cả đơn hàng của ${customer?.displayName || customer?.fullName || customer?.name || "khách hàng"}`}
                >
                  Xem tất cả
                </button>
              </div>
              <div className="cm-order-list">
                {recentOrders.length > 0 ? (
                  recentOrders.slice(0, 5).map((order, i) => {
                    const stKey = (
                      order.status ||
                      order.raw?.currentStatus ||
                      "default"
                    ).toLowerCase();
                    const st = STATUS_CONFIG[stKey] || STATUS_CONFIG.default;
                    return (
                      <button
                        type="button"
                        key={order?.id || order?.orderCode || i}
                        className="cm-order-row"
                        onClick={() => openOrderHistory(order)}
                        aria-label={`Mở chi tiết đơn ${order?.orderCode || order?.id || i + 1}`}
                      >
                        <span>
                          {formatDate(
                            order.createdAt ||
                              order.raw?.createdAt ||
                              order.date,
                          )}
                        </span>
                        <strong>{formatMoney(getEntryAmount(order))}</strong>
                        <em style={{ color: st.color, backgroundColor: st.bg }}>
                          {st.label}
                        </em>
                        <ArrowRight size={14} />
                      </button>
                    );
                  })
                ) : (
                  <div className="cm-empty-orders">Chưa có đơn hàng nào</div>
                )}
              </div>
            </article>

            <article className="cm-panel cm-panel--notes">
              <div className="notes-header">
                <h3>
                  <Edit3 size={15} />
                  Ghi chú nội bộ
                </h3>
                {!isEditingNotes && (
                  <button type="button" onClick={() => setIsEditingNotes(true)}>
                    Chỉnh sửa
                  </button>
                )}
              </div>
              {isEditingNotes ? (
                <>
                  <textarea
                    rows={7}
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    placeholder="Ghi lại lưu ý về khách hàng..."
                    autoFocus
                  />
                  <div className="action-row">
                    <button
                      type="button"
                      className="save"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                    >
                      {savingNotes ? "Đang lưu..." : "Lưu"}
                    </button>
                    <button
                      type="button"
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
                <button
                  type="button"
                  className="note-display"
                  onClick={() => setIsEditingNotes(true)}
                >
                  {notes || <em>Chạm để thêm ghi chú...</em>}
                </button>
              )}
            </article>
          </section>
        </div>
      </Modal.Body>

      <Modal.Footer className="customer-modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Đóng
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCustomerChat}
        >
          <MessageSquare size={16} className="mr-2" /> Gửi tin nhắn
        </button>
      </Modal.Footer>

      <ChatThreadPanel
        open={chatOpen}
        title={`Nhắn tin: ${displayName || "Khách hàng"}`}
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
