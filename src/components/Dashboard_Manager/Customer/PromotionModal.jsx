import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Gift,
  Check,
  ArrowRight,
  ArrowLeft,
  X,
  Clock,
  Zap,
  Target,
  Mail,
  Smartphone,
  MessageCircle,
} from "lucide-react";
import Modal from "../../common/Modal";
import { AuthContext } from "../../../context/AuthContext";
import useCommunication from "../../../hooks/useCommunication";
import { usePromotions } from "../../../hooks/usePromotions";
import { useCoupons } from "../../../hooks/useCoupons";
import { toUserFacingErrorMessage } from "../../../utils/userFacingError";
import "./PromotionModal.scss";

const CAMPAIGN_LOG_SUBJECT = "__PROMO_CAMPAIGN_LOG__";
const SUPPORTED_CHANNELS = {
  inapp: { label: "Thông báo trong ứng dụng", enabled: true },
  email: {
    label: "Email",
    enabled: false,
    reason: "Kênh email chưa được cấu hình cho chiến dịch này.",
  },
  zalo: {
    label: "Zalo",
    enabled: false,
    reason: "Kênh Zalo chưa được kết nối.",
  },
};

const OFFER_KIND_LABELS = {
  promotion: "Chương trình khuyến mãi",
  coupon: "Mã ưu đãi",
  couponPackage: "Gói ưu đãi",
};

const isCurrentOffer = (offer, restaurantId) => {
  if (!offer) return false;
  if (
    restaurantId &&
    offer.restaurantId &&
    String(offer.restaurantId) !== String(restaurantId)
  ) {
    return false;
  }
  if (offer.status && offer.status !== "active") return false;
  if (offer.isActive === false) return false;
  const now = Date.now();
  const start = offer.startDate ? new Date(offer.startDate).getTime() : null;
  const end = offer.endDate ? new Date(offer.endDate).getTime() : null;
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end < now) return false;
  return true;
};

const getCustomerTier = (customer, rankSettings = []) => {
  const sorted = [...(rankSettings || [])]
    .filter((rank) => Number.isFinite(Number(rank?.minPoints)))
    .sort((a, b) => Number(a.minPoints) - Number(b.minPoints));
  if (!sorted.length) {
    const legacy = String(customer?.customerType || customer?.rankName || "").toLowerCase();
    if (legacy.includes("vip")) return "vip";
    if (legacy.includes("thân") || legacy.includes("often")) return "frequent";
    return "new";
  }
  const points = Number(customer?.loyaltyPoints || 0);
  const matched = [...sorted]
    .reverse()
    .find((rank) => points >= Number(rank.minPoints));
  const top = sorted[sorted.length - 1];
  const middle = sorted.length > 2 ? sorted[sorted.length - 2] : sorted[1];
  if (matched?.name === top?.name) return "vip";
  if (middle && matched?.name === middle.name) return "frequent";
  return "new";
};

const buildRecipientSet = (
  customers,
  targetMode,
  manualIds,
  segment,
  rankSettings,
) => {
  if (targetMode === "all") return customers;
  if (targetMode === "manual") {
    const picked = new Set(manualIds);
    return customers.filter((c) => picked.has(String(c.id)));
  }
  return customers.filter((c) => {
    if (segment === "vip") return getCustomerTier(c, rankSettings) === "vip";
    if (segment === "frequent")
      return getCustomerTier(c, rankSettings) === "frequent";
    if (segment === "new") return getCustomerTier(c, rankSettings) === "new";
    if (segment === "inactive") return !c.online;
    return true;
  });
};

const buildOfferOptions = (promotions, coupons, couponPackages, restaurantId) => {
  const rows = [];
  promotions
    .filter((p) => isCurrentOffer(p, restaurantId))
    .forEach((p) => {
      rows.push({
        id: `promotion:${p.id}`,
        sourceId: p.id,
        kind: "promotion",
        title: p.name,
        description: p.description || `Mã: ${p.code || "N/A"}`,
        code: p.code || "",
      });
    });
  coupons
    .filter((coupon) => isCurrentOffer(coupon, restaurantId))
    .forEach((coupon) => {
    rows.push({
      id: `coupon:${coupon.id}`,
      sourceId: coupon.id,
      kind: "coupon",
      title: coupon.name,
      description: coupon.description || `Mã: ${coupon.code || "N/A"}`,
      code: coupon.code || "",
    });
  });
  couponPackages
    .filter((couponPackage) => isCurrentOffer(couponPackage, restaurantId))
    .forEach((couponPackage) => {
    rows.push({
      id: `couponPackage:${couponPackage.id}`,
      sourceId: couponPackage.id,
      kind: "couponPackage",
      title: couponPackage.name,
      description: couponPackage.description || `Mã: ${couponPackage.code || "N/A"}`,
      code: couponPackage.code || "",
    });
  });
  return rows;
};

const parseCampaignHistory = (messages = []) =>
  messages
    .map((m) => {
      if (!m?.content?.startsWith("[PROMO_CAMPAIGN]")) return null;
      try {
        return JSON.parse(m.content.replace("[PROMO_CAMPAIGN]", "").trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.sentAt || b.createdAt || 0) - new Date(a.sentAt || a.createdAt || 0));

const PromotionModal = ({
  onClose,
  customers = [],
  rankSettings = [],
  restaurantId: restaurantIdProp = null,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [targetMode, setTargetMode] = useState("all");
  const [manualRecipientIds, setManualRecipientIds] = useState([]);
  const [segmentKey, setSegmentKey] = useState("vip");
  const [scheduleType, setScheduleType] = useState("now");
  const [selectedChannels, setSelectedChannels] = useState(["inapp"]);
  const [isSending, setIsSending] = useState(false);
  const [sendSummary, setSendSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [historyThreadId, setHistoryThreadId] = useState(null);

  const { user, restaurants = [] } = useContext(AuthContext) || {};
  const restaurantId = useMemo(
    () => restaurantIdProp || restaurants?.[0]?.id || user?.restaurantForStaff || null,
    [restaurantIdProp, restaurants, user]
  );

  const {
    allPromotions,
    loading: promotionsLoading,
    error: promotionsError,
  } = usePromotions({
    restaurantId,
    activeOnly: true,
    showErrorBanner: false,
  });
  const { allCoupons, allCouponPackages } = useCoupons(restaurantId);
  const {
    thread,
    threadLoading,
    loadThread,
    openThread,
    sendMessage,
  } = useCommunication({ restaurantId });

  const offerOptions = useMemo(
    () => buildOfferOptions(allPromotions, allCoupons, allCouponPackages, restaurantId),
    [allPromotions, allCoupons, allCouponPackages, restaurantId]
  );

  const selectedOffer = useMemo(
    () => offerOptions.find((o) => o.id === selectedOfferId) || null,
    [offerOptions, selectedOfferId]
  );

  const recipients = useMemo(
    () =>
      buildRecipientSet(
        customers,
        targetMode,
        manualRecipientIds,
        segmentKey,
        rankSettings,
      ),
    [customers, targetMode, manualRecipientIds, segmentKey, rankSettings]
  );

  const campaignHistory = useMemo(() => parseCampaignHistory(thread?.messages || []), [thread?.messages]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!restaurantId) return;
      try {
        const { data } = await openThread({
          variables: {
            input: {
              restaurantId,
              channel: "other",
              targetRole: "management",
              subject: CAMPAIGN_LOG_SUBJECT,
            },
          },
        });
        const tid = data?.openChatThread?.id;
        if (!tid) return;
        setHistoryThreadId(tid);
        await loadThread({ variables: { id: tid } });
      } catch {
        // giữ im lặng để không chặn flow gửi
      }
    };
    loadHistory();
  }, [restaurantId, openThread, loadThread]);

  const toggleManualCustomer = (id) => {
    const key = String(id);
    setManualRecipientIds((prev) =>
      prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]
    );
  };

  const toggleChannel = (key) => {
    if (!SUPPORTED_CHANNELS[key]?.enabled) return;
    setSelectedChannels((prev) =>
      prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]
    );
  };

  const ensureRecipientThread = async (customer) => {
    const { data } = await openThread({
      variables: {
        input: {
          restaurantId,
          channel: "support",
          participantIds: [customer.id],
          subject: `Khách hàng #${String(customer.id).padStart(4, "0")} - ${
            customer?.name || customer?.fullName || "Khách hàng"
          }`,
        },
      },
    });
    return data?.openChatThread?.id || null;
  };

  const handleSend = async () => {
    setErrorMsg("");
    setSendSummary(null);

    if (!selectedOffer) {
      setErrorMsg("Vui lòng chọn ưu đãi trước khi gửi.");
      return;
    }
    if (!restaurantId) {
      setErrorMsg("Thiếu ngữ cảnh nhà hàng, chưa thể gửi chiến dịch.");
      return;
    }
    if (!selectedChannels.length) {
      setErrorMsg("Cần chọn ít nhất 1 kênh gửi.");
      return;
    }
    if (selectedChannels.some((ch) => !SUPPORTED_CHANNELS[ch]?.enabled)) {
      setErrorMsg("Có kênh chưa sẵn sàng trong hạ tầng hiện tại.");
      return;
    }
    if (!recipients.length) {
      setErrorMsg("Không có người nhận hợp lệ.");
      return;
    }
    if (scheduleType === "later") {
      setErrorMsg("Tính năng lên lịch gửi chưa sẵn sàng. Vui lòng chọn gửi ngay.");
      return;
    }

    setIsSending(true);
    try {
      const deliveryResults = [];
      const content = `🎁 Ưu đãi mới: ${selectedOffer.title}\n${selectedOffer.description}`;

      for (const customer of recipients) {
        let status = "failed";
        let reason = "";
        try {
          const threadId = await ensureRecipientThread(customer);
          if (!threadId) throw new Error("Không tạo được hội thoại");

          if (selectedChannels.includes("inapp")) {
            await sendMessage({
              variables: {
                input: {
                  threadId,
                  content,
                },
              },
            });
          }

          status = "sent";
        } catch (err) {
          reason = toUserFacingErrorMessage(
            err,
            "Chưa gửi được ưu đãi tới khách hàng này.",
          );
        }

        deliveryResults.push({
          customerId: String(customer.id),
          customerName: customer.name || customer.displayName || "Khách hàng",
          channels: selectedChannels,
          status,
          reason,
        });
      }

      const successCount = deliveryResults.filter((r) => r.status === "sent").length;
      const failedCount = deliveryResults.length - successCount;

      const logPayload = {
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        operatorId: user?.id || null,
        operatorName: user?.fullName || user?.name || "Manager",
        restaurantId,
        offer: {
          id: selectedOffer.sourceId,
          kind: selectedOffer.kind,
          title: selectedOffer.title,
          code: selectedOffer.code || "",
        },
        target: {
          mode: targetMode,
          segment: targetMode === "segment" ? segmentKey : null,
          recipientCount: recipients.length,
        },
        channels: selectedChannels,
        summary: {
          total: deliveryResults.length,
          sent: successCount,
          failed: failedCount,
        },
        deliveryResults,
      };

      let logThreadId = historyThreadId;
      if (!logThreadId) {
        const { data } = await openThread({
          variables: {
            input: {
              restaurantId,
              channel: "other",
              targetRole: "management",
              subject: CAMPAIGN_LOG_SUBJECT,
            },
          },
        });
        logThreadId = data?.openChatThread?.id || null;
      }
      if (logThreadId) {
        await sendMessage({
          variables: {
            input: {
              threadId: logThreadId,
              content: `[PROMO_CAMPAIGN] ${JSON.stringify(logPayload)}`,
            },
          },
        });
        await loadThread({ variables: { id: logThreadId } });
      }

      setSendSummary(logPayload.summary);
      if (failedCount > 0) {
        setErrorMsg(`Gửi một phần: ${successCount}/${deliveryResults.length} thành công.`);
      }
    } catch (err) {
      setErrorMsg(
        toUserFacingErrorMessage(
          err,
          "Chưa thể gửi chiến dịch. Vui lòng kiểm tra và thử lại.",
        ),
      );
    } finally {
      setIsSending(false);
    }
  };

  const canNext =
    (currentStep === 1 && !!selectedOffer) ||
    (currentStep === 2 && recipients.length > 0) ||
    currentStep === 3;

  return (
    <Modal isOpen onClose={onClose} size="xl" className="promotion-modal-wrapper">
      <div className="pm-container">
        <div className="pm-header">
          <h2>
            <Gift className="text-blue-500" />
            Gửi ưu đãi tới khách hàng
          </h2>
          <button type="button" className="pm-close-btn" onClick={onClose} aria-label="Đóng cửa sổ gửi ưu đãi">
            <X size={24} />
          </button>
        </div>

        <div className="pm-steps">
          {[1, 2, 3].map((num) => (
            <div key={num} className={`step-item ${currentStep === num ? "active" : ""} ${currentStep > num ? "completed" : ""}`}>
              <div className="step-num">{currentStep > num ? <Check size={14} /> : num}</div>
              <span>{num === 1 ? "Ưu đãi" : num === 2 ? "Đối tượng" : "Kênh & Gửi"}</span>
            </div>
          ))}
        </div>

        <div className="pm-body">
          {currentStep === 1 && (
            <div className="step-content">
              {promotionsLoading && <div className="pm-state">Đang tải danh sách ưu đãi...</div>}
              {promotionsError && !promotionsLoading && (
                <div className="pm-state pm-state--error" role="alert">
                  Chưa thể tải ưu đãi của nhà hàng này. Vui lòng thử lại.
                </div>
              )}
              {!promotionsLoading && !promotionsError && offerOptions.length === 0 && (
                <div className="pm-state">Nhà hàng chưa có ưu đãi đang áp dụng.</div>
              )}
              <div className="promo-grid">
                {offerOptions.map((offer) => (
                  <div
                    key={offer.id}
                    className={`promo-card ${selectedOfferId === offer.id ? "selected" : ""}`}
                    onClick={() => setSelectedOfferId(offer.id)}
                  >
                    <div className="check-mark">
                      <Check size={14} />
                    </div>
                    <div className="pc-icon bg-blue-100">
                      <Gift size={22} className="text-blue-600" />
                    </div>
                    <h4>{offer.title}</h4>
                    <p>{offer.description}</p>
                    <span className={`promo-tag type-${offer.kind}`}>
                      {OFFER_KIND_LABELS[offer.kind] || "Ưu đãi"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <div className="target-tabs">
                {[
                  { id: "all", label: "Tất cả khách hàng", icon: <Target size={14} /> },
                  { id: "manual", label: "Chọn thủ công", icon: <Check size={14} /> },
                  { id: "segment", label: "Theo nhóm khách", icon: <Zap size={14} /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={targetMode === tab.id ? "active" : ""}
                    onClick={() => setTargetMode(tab.id)}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {targetMode === "segment" && (
                <div className="segment-picker">
                  {[
                    { id: "vip", label: "VIP (điểm > 15.000)" },
                    { id: "frequent", label: "Thân thiết (5.001 - 15.000)" },
                    { id: "new", label: "Khách mới (<= 5.000)" },
                    { id: "inactive", label: "Khách không online" },
                  ].map((s) => (
                    <label key={s.id}>
                      <input
                        type="radio"
                        checked={segmentKey === s.id}
                        onChange={() => setSegmentKey(s.id)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              )}

              {targetMode === "manual" && (
                <div className="manual-list">
                  {customers.map((c) => (
                    <label key={c.id} className="manual-item">
                      <input
                        type="checkbox"
                        checked={manualRecipientIds.includes(String(c.id))}
                        onChange={() => toggleManualCustomer(c.id)}
                      />
                      <div>
                        <strong>{c.name || c.displayName || `KH#${c.id}`}</strong>
                        <span>{c.phone || c.email || "Không có thông tin liên hệ"}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="recipient-summary">
                Tổng người nhận: <b>{recipients.length}</b>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content review-layout">
              <div className="schedule-section">
                <h3>
                  <Clock size={18} /> Kênh và thời gian gửi
                </h3>
                <div className="channel-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes("inapp")}
                      onChange={() => toggleChannel("inapp")}
                    />
                    <Smartphone size={14} /> {SUPPORTED_CHANNELS.inapp.label}
                  </label>
                  <label className="is-disabled">
                    <input type="checkbox" checked={false} disabled />
                    <Mail size={14} /> {SUPPORTED_CHANNELS.email.label}
                    <small>{SUPPORTED_CHANNELS.email.reason}</small>
                  </label>
                  <label className="is-disabled">
                    <input type="checkbox" checked={false} disabled />
                    <MessageCircle size={14} /> {SUPPORTED_CHANNELS.zalo.label}
                    <small>{SUPPORTED_CHANNELS.zalo.reason}</small>
                  </label>
                </div>

                <div className="radio-options">
                  <label>
                    <input
                      type="radio"
                      name="schedule"
                      value="now"
                      checked={scheduleType === "now"}
                      onChange={(e) => setScheduleType(e.target.value)}
                    />
                    <div>Gửi ngay</div>
                  </label>
                  <label className="is-disabled" title="Tính năng đang được hoàn thiện">
                    <input
                      type="radio"
                      name="schedule"
                      value="later"
                      checked={scheduleType === "later"}
                      onChange={(e) => setScheduleType(e.target.value)}
                      disabled
                    />
                    <div>Lên lịch gửi sau — chưa sẵn sàng</div>
                  </label>
                </div>
              </div>

              <div className="summary-card">
                <h4>Xác nhận gửi thật</h4>
                <div className="sum-row">
                  <span className="label">Ưu đãi:</span>
                  <span className="val">{selectedOffer?.title || "—"}</span>
                </div>
                <div className="sum-row">
                  <span className="label">Đối tượng:</span>
                  <span className="val">{recipients.length} khách hàng</span>
                </div>
                <div className="sum-row">
                  <span className="label">Kênh:</span>
                  <span className="val">{selectedChannels.join(", ") || "—"}</span>
                </div>
                {sendSummary && (
                  <div className="sum-row">
                    <span className="label">KQ gửi:</span>
                    <span className="val">
                      {sendSummary.sent}/{sendSummary.total} thành công
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {errorMsg && <div className="pm-error">{errorMsg}</div>}

          <div className="campaign-history">
            <h4>Lịch sử gửi ưu đãi</h4>
            {threadLoading ? (
              <div className="pm-state">Đang tải lịch sử...</div>
            ) : campaignHistory.length === 0 ? (
              <div className="pm-state">Chưa có lịch sử gửi ưu đãi.</div>
            ) : (
              <ul>
                {campaignHistory.slice(0, 6).map((item, idx) => (
                  <li key={`${item.sentAt || item.createdAt}-${idx}`}>
                    <strong>{item.offer?.title}</strong> • {item.summary?.sent}/{item.summary?.total} thành công •{" "}
                    {new Date(item.sentAt || item.createdAt).toLocaleString("vi-VN")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="pm-footer">
          {currentStep > 1 && (
            <button className="btn-back" onClick={() => setCurrentStep((p) => p - 1)} disabled={isSending}>
              <ArrowLeft size={16} /> Quay lại
            </button>
          )}

          {currentStep < 3 ? (
            <button className="btn-next" onClick={() => setCurrentStep((p) => p + 1)} disabled={!canNext}>
              Tiếp theo <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn-send" onClick={handleSend} disabled={isSending}>
              {isSending ? "Đang gửi thật..." : <><Zap size={16} /> Gửi chiến dịch</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export const __testables = {
  buildOfferOptions,
  isCurrentOffer,
};

export default PromotionModal;
