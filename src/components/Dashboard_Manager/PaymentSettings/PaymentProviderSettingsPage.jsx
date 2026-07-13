import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2Off,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import "./PaymentProviderSettingsPage.scss";

const PAYMENT_PROVIDER_SETTINGS = gql`
  query PaymentProviderSettings($restaurantId: ID!) {
    restaurantPaymentCredentialStatuses(restaurantId: $restaurantId) {
      restaurantId
      provider
      mode
      configured
      source
      maskedIdentifier
      version
      updatedAt
    }
    restaurantPaymentIntegrationReadiness(restaurantId: $restaurantId) {
      provider
      mode
      publicBaseUrl
      webBaseUrl
      returnUrl
      ipnUrl
      gatewayUrl
      paymentChannel
      encryptionReady
      callbackReady
      webReturnReady
      ready
      blockers
    }
    restaurantPaymentPublicConfig(restaurantId: $restaurantId) {
      defaultProvider
      providers {
        provider
        label
        active
        priority
        mode
        configured
        credentialSource
      }
    }
  }
`;

const SAVE_PAYMENT_CREDENTIAL = gql`
  mutation SaveRestaurantPaymentCredential($input: SaveRestaurantPaymentCredentialInput!) {
    saveRestaurantPaymentCredential(input: $input) {
      provider
      mode
      configured
      source
      maskedIdentifier
      version
      updatedAt
    }
  }
`;

const DISCONNECT_PAYMENT_CREDENTIAL = gql`
  mutation DisconnectRestaurantPaymentCredential($restaurantId: ID!, $provider: String!, $mode: String!) {
    disconnectRestaurantPaymentCredential(restaurantId: $restaurantId, provider: $provider, mode: $mode) {
      provider
      mode
      configured
      source
      maskedIdentifier
      version
      updatedAt
    }
  }
`;

const UPDATE_PAYMENT_SETTINGS = gql`
  mutation UpdateRestaurantPaymentSettings($input: UpdateRestaurantPaymentSettingsInput!) {
    updateRestaurantPaymentSettings(input: $input) {
      id
      paymentSettings {
        defaultProvider
        providers { provider label active priority mode }
      }
    }
  }
`;

const PROVIDERS = [
  {
    id: "momo",
    name: "MoMo",
    description: "Nhận thanh toán qua ví MoMo và mã QR.",
    guideUrl: "https://developers.momo.vn/v3/vi/docs/payment/onboarding/integration-process/",
    merchantHint: "Bạn chỉ cần nhập bộ mã riêng được cấp trong tài khoản MoMo for Business.",
    fields: [
      {
        name: "partnerCode",
        label: "Mã đối tác",
        providerLabel: "Partner Code",
        hint: "Mã định danh tài khoản doanh nghiệp do MoMo cấp riêng cho bạn.",
        placeholder: "Dán Partner Code từ MoMo",
      },
      {
        name: "accessKey",
        label: "Khóa truy cập",
        providerLabel: "Access Key",
        hint: "Khóa truy cập thuộc đúng bộ mã của môi trường bạn đang chọn.",
        placeholder: "Dán Access Key từ MoMo",
        secret: true,
      },
      {
        name: "secretKey",
        label: "Khóa bảo mật",
        providerLabel: "Secret Key",
        hint: "Khóa ký giao dịch riêng của tài khoản merchant; không chia sẻ cho người khác.",
        placeholder: "Dán Secret Key từ MoMo",
        secret: true,
      },
    ],
  },
  {
    id: "vnpay",
    name: "VNPAY",
    description: "Nhận thanh toán qua ngân hàng, thẻ và VNPAY-QR.",
    guideUrl: "https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html",
    merchantHint: "Bạn chỉ cần nhập TmnCode và Hash Secret riêng do VNPAY cấp.",
    fields: [
      {
        name: "tmnCode",
        label: "Mã website hoặc điểm bán",
        providerLabel: "TmnCode",
        hint: "Mã định danh kết nối riêng của merchant trên hệ thống VNPAY.",
        placeholder: "Dán TmnCode từ VNPAY",
      },
      {
        name: "hashSecret",
        label: "Khóa bảo mật",
        providerLabel: "Hash Secret",
        hint: "Chuỗi bí mật dùng kiểm tra chữ ký giao dịch của merchant.",
        placeholder: "Dán Hash Secret từ VNPAY",
        secret: true,
      },
    ],
  },
];

const MODE_OPTIONS = [
  { value: "sandbox", label: "Tài khoản dùng thử", description: "Bộ mã Test/Sandbox để kiểm tra trước khi nhận tiền thật." },
  { value: "production", label: "Tài khoản chính thức", description: "Bộ mã Production đã được nhà cung cấp kích hoạt." },
];

const EMPTY_FORMS = {
  momo: { partnerCode: "", accessKey: "", secretKey: "" },
  vnpay: { tmnCode: "", hashSecret: "" },
};
const EMPTY_PROVIDER_CONFIGS = [];
const EMPTY_NOTICE = { message: "", tone: "info" };

const channelLabel = (provider, value) => {
  if (provider === "momo") return value === "captureWallet" ? "Ví MoMo / QR" : value || "MoMo";
  return {
    AUTO: "Khách tự chọn tại VNPAY",
    VNPAYQR: "VNPAY-QR",
    VNBANK: "Ngân hàng nội địa",
    INTCARD: "Thẻ quốc tế",
  }[value] || value || "Khách tự chọn tại VNPAY";
};

const statusLabel = (status, readiness) => {
  if (!status?.configured) return "Chưa có mã merchant";
  if (!readiness?.ready) return "Đã lưu · chờ hệ thống";
  return status.source === "restaurant" ? "Sẵn sàng nhận tiền" : "Tài khoản COHAN";
};

const statusDescription = (status, readiness) => {
  if (!status?.configured) return "Chưa có bộ mã cho loại tài khoản đang chọn.";
  if (!readiness?.ready) return "Thông tin riêng đã lưu, nhưng cấu hình chung của nền tảng chưa hoàn tất.";
  return status.source === "restaurant"
    ? "Tiền được đối soát theo tài khoản merchant riêng của chi nhánh."
    : "Đang dùng tài khoản thanh toán chung do COHAN vận hành.";
};

const friendlyPaymentError = (error, fallback) => {
  const message = String(error?.message || error || "");
  if (/invalid restaurantid/i.test(message)) return "Chi nhánh đang chọn không hợp lệ. Vui lòng chọn lại.";
  if (/unsupported payment provider/i.test(message)) return "Phương thức thanh toán này chưa được hỗ trợ.";
  if (/payment_credential_encryption_key_required/i.test(message)) {
    return "Hệ thống chưa sẵn sàng để lưu thông tin thanh toán. Vui lòng liên hệ chủ nền tảng.";
  }
  if (/payment_public_base_url_required/i.test(message)) {
    return "Chủ nền tảng chưa cấu hình URL callback thanh toán công khai.";
  }
  if (/payment_credential_decrypt_failed/i.test(message)) {
    return "Không thể đọc thông tin đã lưu. Vui lòng lưu lại kết nối hoặc liên hệ chủ nền tảng.";
  }
  if (/required/i.test(message)) return "Vui lòng nhập đủ các thông tin bắt buộc.";
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại.";
  }
  return fallback;
};

function ProviderLogo({ provider }) {
  if (provider === "momo") {
    return (
      <span className="payment-provider-card__brand-logo payment-provider-card__brand-logo--momo" role="img" aria-label="Logo MoMo">
        <span>Mo</span><span>Mo</span>
      </span>
    );
  }
  return (
    <span className="payment-provider-card__brand-logo payment-provider-card__brand-logo--vnpay" role="img" aria-label="Logo VNPAY">
      <span>VN</span><span>PAY</span>
    </span>
  );
}

export default function PaymentProviderSettingsPage({ restaurantId, restaurantName = "" }) {
  const [forms, setForms] = useState(EMPTY_FORMS);
  const [modes, setModes] = useState({ momo: "sandbox", vnpay: "sandbox" });
  const [notice, setNotice] = useState(EMPTY_NOTICE);
  const [savingProvider, setSavingProvider] = useState("");

  const { data, loading, error, refetch } = useQuery(PAYMENT_PROVIDER_SETTINGS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });
  const [saveCredential] = useMutation(SAVE_PAYMENT_CREDENTIAL);
  const [disconnectCredential] = useMutation(DISCONNECT_PAYMENT_CREDENTIAL);
  const [updatePaymentSettings] = useMutation(UPDATE_PAYMENT_SETTINGS);

  const statuses = data?.restaurantPaymentCredentialStatuses || [];
  const readinessItems = data?.restaurantPaymentIntegrationReadiness || [];
  const publicConfig = data?.restaurantPaymentPublicConfig;
  const providerConfigs = publicConfig?.providers || EMPTY_PROVIDER_CONFIGS;

  const savedModes = useMemo(() => {
    const next = { momo: "sandbox", vnpay: "sandbox" };
    providerConfigs.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(next, item.provider)) next[item.provider] = item.mode;
    });
    return next;
  }, [providerConfigs]);

  useEffect(() => {
    setModes(savedModes);
  }, [restaurantId, savedModes]);

  const statusMap = useMemo(
    () => new Map(statuses.map((item) => [`${item.provider}:${item.mode}`, item])),
    [statuses],
  );
  const readinessMap = useMemo(
    () => new Map(readinessItems.map((item) => [`${item.provider}:${item.mode}`, item])),
    [readinessItems],
  );

  const clearNotice = () => setNotice(EMPTY_NOTICE);
  const updateField = (provider, field, value) => {
    setForms((current) => ({
      ...current,
      [provider]: { ...current[provider], [field]: value },
    }));
    clearNotice();
  };

  const updateMode = (provider, mode) => {
    setModes((current) => ({ ...current, [provider]: mode }));
    clearNotice();
  };

  const persistProviderSettings = async (provider, patch = {}) => {
    const current = providerConfigs.length
      ? providerConfigs
      : PROVIDERS.map((item, index) => ({
        provider: item.id,
        label: item.name,
        active: false,
        priority: index + 1,
        mode: "sandbox",
      }));
    const providers = current.map((item) => ({
      provider: item.provider,
      label: item.label,
      active: item.provider === provider ? patch.active ?? item.active : item.active,
      priority: item.priority,
      mode: item.provider === provider ? patch.mode ?? item.mode : item.mode,
    }));
    await updatePaymentSettings({
      variables: {
        input: {
          restaurantId,
          defaultProvider: publicConfig?.defaultProvider || provider,
          providers,
        },
      },
    });
  };

  const handleSave = async (provider) => {
    const mode = modes[provider];
    const form = forms[provider];
    const readiness = readinessMap.get(`${provider}:${mode}`);
    const requiredFields = provider === "momo"
      ? ["partnerCode", "accessKey", "secretKey"]
      : ["tmnCode", "hashSecret"];
    if (requiredFields.some((field) => !String(form[field] || "").trim())) {
      setNotice({ message: "Vui lòng nhập đủ các thông tin bắt buộc trước khi lưu.", tone: "error" });
      return;
    }

    setSavingProvider(provider);
    clearNotice();
    try {
      await saveCredential({
        variables: {
          input: {
            restaurantId,
            provider,
            mode,
            credentialPayload: form,
          },
        },
      });
      await persistProviderSettings(provider, { active: Boolean(readiness?.ready), mode });
      setForms((current) => ({ ...current, [provider]: { ...EMPTY_FORMS[provider] } }));
      setNotice({
        message: readiness?.ready
          ? `Đã lưu tài khoản ${provider === "momo" ? "MoMo" : "VNPAY"} và bật cho khách thanh toán.`
          : "Đã lưu an toàn bộ mã merchant. Phương thức sẽ tự sẵn sàng sau khi chủ nền tảng hoàn tất cấu hình chung.",
        tone: readiness?.ready ? "success" : "info",
      });
      await refetch();
    } catch (mutationError) {
      setNotice({
        message: friendlyPaymentError(mutationError, "Không thể lưu kết nối thanh toán. Vui lòng thử lại."),
        tone: "error",
      });
    } finally {
      setSavingProvider("");
    }
  };

  const handleDisconnect = async (provider) => {
    const mode = modes[provider];
    setSavingProvider(provider);
    clearNotice();
    try {
      await disconnectCredential({ variables: { restaurantId, provider, mode } });
      await persistProviderSettings(provider, { active: false });
      setNotice({
        message: "Đã gỡ bộ mã merchant riêng và ẩn phương thức khỏi bước thanh toán.",
        tone: "success",
      });
      await refetch();
    } catch (mutationError) {
      setNotice({
        message: friendlyPaymentError(mutationError, "Không thể gỡ kết nối thanh toán. Vui lòng thử lại."),
        tone: "error",
      });
    } finally {
      setSavingProvider("");
    }
  };

  const handleToggle = async (provider, active) => {
    const providerName = provider === "momo" ? "MoMo" : "VNPAY";
    const mode = modes[provider];
    const readiness = readinessMap.get(`${provider}:${mode}`);
    if (active && !readiness?.ready) {
      setNotice({
        message: "Chưa thể bật vì cấu hình callback, mã hóa hoặc URL quay lại của nền tảng chưa hoàn tất.",
        tone: "error",
      });
      return;
    }
    setSavingProvider(provider);
    clearNotice();
    try {
      await persistProviderSettings(provider, { active });
      setNotice({
        message: active
          ? `Khách hàng đã có thể chọn ${providerName} khi thanh toán.`
          : `${providerName} đã được ẩn khỏi lựa chọn thanh toán của khách hàng.`,
        tone: "success",
      });
      await refetch();
    } catch (mutationError) {
      setNotice({
        message: friendlyPaymentError(mutationError, "Không thể thay đổi lựa chọn thanh toán. Vui lòng thử lại."),
        tone: "error",
      });
    } finally {
      setSavingProvider("");
    }
  };

  if (!restaurantId) {
    return (
      <section className="payment-provider-settings payment-provider-settings--empty">
        <KeyRound aria-hidden="true" />
        <h2>Chọn một chi nhánh</h2>
        <p>Chọn chi nhánh ở thanh trên cùng để kết nối MoMo hoặc VNPAY.</p>
      </section>
    );
  }

  const queryErrorMessage = error
    ? friendlyPaymentError(error, "Không thể tải thông tin thanh toán. Vui lòng thử lại.")
    : "";
  const feedbackMessage = loading ? "Đang tải thông tin thanh toán..." : queryErrorMessage || notice.message;
  const feedbackTone = error ? "error" : loading ? "info" : notice.tone;

  return (
    <main className="payment-provider-settings">
      <header className="payment-provider-settings__header">
        <div className="payment-provider-settings__header-copy">
          <p className="payment-provider-settings__eyebrow">THANH TOÁN TRỰC TUYẾN</p>
          <h1>Kết nối MoMo và VNPAY</h1>
          <p>
            COHAN cấu hình sẵn cổng, callback, bảo mật và cách thanh toán. Chủ nhà hàng chỉ nhập
            bộ mã merchant riêng để tiền được đối soát về tài khoản đã đăng ký với nhà cung cấp.
          </p>
        </div>
        <div className="payment-provider-settings__security">
          <ShieldCheck aria-hidden="true" />
          <span><strong>Thông tin được mã hóa</strong><small>Các khóa bí mật không hiển thị lại sau khi lưu.</small></span>
        </div>
      </header>

      {feedbackMessage && (
        <div
          className={`payment-provider-settings__notice is-${feedbackTone}`}
          role={feedbackTone === "error" ? "alert" : "status"}
        >
          {feedbackMessage}
        </div>
      )}

      <aside className="payment-provider-settings__note">
        <ServerCog aria-hidden="true" />
        <strong>Phần chủ nền tảng quản lý</strong>
        <p>
          Domain HTTPS, Return URL, IPN/webhook, endpoint Sandbox/Production, khóa mã hóa và kênh
          VNPAY-QR được cấu hình một lần trên máy chủ. Nhà hàng không phải nhập lại các thông tin chung này.
        </p>
      </aside>

      <section className="payment-provider-settings__grid" aria-label="Phương thức thanh toán">
        {PROVIDERS.map((providerMeta) => {
          const mode = modes[providerMeta.id];
          const status = statusMap.get(`${providerMeta.id}:${mode}`);
          const readiness = readinessMap.get(`${providerMeta.id}:${mode}`);
          const providerConfig = providerConfigs.find((item) => item.provider === providerMeta.id);
          const busy = savingProvider === providerMeta.id;
          const ready = Boolean(status?.configured && readiness?.ready);
          return (
            <article className={`payment-provider-card payment-provider-card--${providerMeta.id}`} key={providerMeta.id}>
              <div className="payment-provider-card__title">
                <ProviderLogo provider={providerMeta.id} />
                <div className="payment-provider-card__title-copy">
                  <h2>{providerMeta.name}</h2>
                  <p>{providerMeta.description}</p>
                </div>
                <span className={`payment-provider-card__status ${ready ? "is-ready" : ""}`}>
                  {ready ? <CheckCircle2 aria-hidden="true" /> : null}
                  {statusLabel(status, readiness)}
                </span>
              </div>

              <div className="payment-provider-card__summary">
                <fieldset className="payment-provider-card__mode" disabled={busy}>
                  <legend>Loại bộ mã merchant</legend>
                  <div className="payment-provider-card__mode-options">
                    {MODE_OPTIONS.map((option) => (
                      <label className={mode === option.value ? "is-selected" : ""} key={option.value}>
                        <input
                          type="radio"
                          name={`${providerMeta.id}-mode`}
                          value={option.value}
                          checked={mode === option.value}
                          onChange={() => updateMode(providerMeta.id, option.value)}
                        />
                        <span><strong>{option.label}</strong><small>{option.description}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="payment-provider-card__saved-account">
                  <span>Mã merchant đang dùng</span>
                  <strong title={status?.maskedIdentifier || "Chưa có"}>{status?.maskedIdentifier || "Chưa có"}</strong>
                  <small>{statusDescription(status, readiness)}</small>
                </div>

                <label className={`payment-provider-card__toggle ${!ready ? "is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(providerConfig?.active && ready)}
                    onChange={(event) => handleToggle(providerMeta.id, event.target.checked)}
                    disabled={busy || !ready}
                  />
                  <span className="payment-provider-card__toggle-control" aria-hidden="true" />
                  <span className="payment-provider-card__toggle-copy">
                    <strong>Cho phép khách thanh toán</strong>
                    <small>{ready ? `Hiển thị ${providerMeta.name} ở bước thanh toán.` : "Cần đủ mã merchant và cấu hình chung."}</small>
                  </span>
                </label>
              </div>

              <div className="payment-provider-card__summary">
                <div className="payment-provider-card__saved-account">
                  <span>Return URL do COHAN quản lý</span>
                  <strong title={readiness?.returnUrl || "Chưa cấu hình"}>{readiness?.returnUrl || "Chưa cấu hình"}</strong>
                  <small>Đường dẫn đưa khách quay lại sau thanh toán.</small>
                </div>
                <div className="payment-provider-card__saved-account">
                  <span>IPN / Webhook do COHAN quản lý</span>
                  <strong title={readiness?.ipnUrl || "Chưa cấu hình"}>{readiness?.ipnUrl || "Chưa cấu hình"}</strong>
                  <small>Đường dẫn nhà cung cấp gửi xác nhận giao dịch.</small>
                </div>
                <div className="payment-provider-card__saved-account">
                  <span>Kênh thanh toán</span>
                  <strong>{channelLabel(providerMeta.id, readiness?.paymentChannel)}</strong>
                  <small>Chủ nền tảng đặt thống nhất, nhà hàng không cần nhập.</small>
                </div>
                <div className="payment-provider-card__saved-account">
                  <span>Trạng thái hạ tầng</span>
                  <strong>{readiness?.ready ? "Đã sẵn sàng" : "Chưa hoàn tất"}</strong>
                  <small>{readiness?.ready ? "Có thể lưu bộ mã và bật thanh toán." : "Liên hệ chủ nền tảng để hoàn tất phần dùng chung."}</small>
                </div>
              </div>

              {readiness?.blockers?.length ? (
                <div className="payment-provider-settings__notice is-error" role="alert">
                  <TriangleAlert aria-hidden="true" /> {readiness.blockers.join(" ")}
                </div>
              ) : null}

              <form onSubmit={(event) => { event.preventDefault(); handleSave(providerMeta.id); }}>
                <div className="payment-provider-card__form-heading">
                  <div>
                    <h3>Chỉ nhập thông tin riêng của bạn</h3>
                    <p>{providerMeta.merchantHint}</p>
                  </div>
                  <a href={providerMeta.guideUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" /> Hướng dẫn lấy bộ mã từ {providerMeta.name}
                  </a>
                </div>

                {providerMeta.fields.map((field) => {
                  const fieldId = `${providerMeta.id}-${field.name}`;
                  const accessibleLabel = `${field.label} (${field.providerLabel})`;
                  return (
                    <div className="payment-provider-card__field" key={field.name}>
                      <label htmlFor={fieldId}>
                        <span>{field.label}</span>
                        <small>{field.providerLabel}</small>
                      </label>
                      <input
                        id={fieldId}
                        aria-label={accessibleLabel}
                        aria-describedby={`${fieldId}-hint`}
                        type={field.secret ? "password" : "text"}
                        autoComplete={field.secret ? "new-password" : "off"}
                        spellCheck="false"
                        value={forms[providerMeta.id][field.name]}
                        onChange={(event) => updateField(providerMeta.id, field.name, event.target.value)}
                        placeholder={field.placeholder}
                        disabled={busy}
                      />
                      <small className="payment-provider-card__field-hint" id={`${fieldId}-hint`}>{field.hint}</small>
                    </div>
                  );
                })}

                <div className="payment-provider-card__actions">
                  <button type="submit" className="payment-provider-card__primary" disabled={busy}>
                    <KeyRound aria-hidden="true" />
                    {busy ? "Đang lưu..." : status?.source === "restaurant" ? "Cập nhật bộ mã" : "Lưu bộ mã merchant"}
                  </button>
                  {status?.source === "restaurant" && (
                    <button type="button" className="payment-provider-card__danger" onClick={() => handleDisconnect(providerMeta.id)} disabled={busy}>
                      <Link2Off aria-hidden="true" /> Gỡ bộ mã chi nhánh
                    </button>
                  )}
                </div>
              </form>
            </article>
          );
        })}
      </section>

      <aside className="payment-provider-settings__note">
        <strong>Tiền thanh toán đi đâu?</strong>
        <p>
          Khi chi nhánh dùng bộ mã merchant riêng, tiền được nhà cung cấp đối soát về tài khoản ngân hàng
          đã đăng ký trong hợp đồng MoMo/VNPAY của chi nhánh. COHAN chỉ tạo yêu cầu, xác minh callback và lưu trạng thái giao dịch.
        </p>
      </aside>
    </main>
  );
}
