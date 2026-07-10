import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { CheckCircle2, ExternalLink, KeyRound, Link2Off, ShieldCheck } from "lucide-react";
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
    fields: [
      {
        name: "partnerCode",
        label: "Mã đối tác",
        providerLabel: "Partner Code",
        hint: "Mã nhận diện tài khoản doanh nghiệp do MoMo cấp.",
        placeholder: "Dán Partner Code từ MoMo",
      },
      {
        name: "accessKey",
        label: "Khóa truy cập",
        providerLabel: "Access Key",
        hint: "Khóa cho phép hệ thống kết nối với tài khoản MoMo của bạn.",
        placeholder: "Dán Access Key từ MoMo",
        secret: true,
      },
      {
        name: "secretKey",
        label: "Khóa bảo mật",
        providerLabel: "Secret Key",
        hint: "Khóa dùng để xác nhận giao dịch đến từ đúng tài khoản.",
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
    fields: [
      {
        name: "tmnCode",
        label: "Mã website hoặc điểm bán",
        providerLabel: "TmnCode",
        hint: "Mã nhận diện kết nối do VNPAY cấp cho website hoặc điểm bán.",
        placeholder: "Dán TmnCode từ VNPAY",
      },
      {
        name: "hashSecret",
        label: "Khóa bảo mật",
        providerLabel: "Hash Secret",
        hint: "Khóa dùng để kiểm tra thông tin giao dịch không bị thay đổi.",
        placeholder: "Dán Hash Secret từ VNPAY",
        secret: true,
      },
      {
        name: "bankCode",
        label: "Cách thanh toán ưu tiên",
        providerLabel: "Không bắt buộc",
        hint: "Để khách tự chọn hoặc mở sẵn một cách thanh toán phổ biến.",
        type: "select",
        options: [
          ["", "Để khách tự chọn"],
          ["VNBANK", "Ngân hàng nội địa"],
          ["VNPAYQR", "VNPAY-QR"],
          ["INTCARD", "Thẻ quốc tế"],
        ],
      },
    ],
  },
];

const MODE_OPTIONS = [
  { value: "sandbox", label: "Tài khoản dùng thử", description: "Dùng để kiểm tra trước khi nhận tiền thật." },
  { value: "production", label: "Tài khoản chính thức", description: "Dùng cho giao dịch thật của khách hàng." },
];

const EMPTY_FORMS = {
  momo: { partnerCode: "", accessKey: "", secretKey: "" },
  vnpay: { tmnCode: "", hashSecret: "", bankCode: "VNBANK" },
};
const EMPTY_PROVIDER_CONFIGS = [];
const EMPTY_NOTICE = { message: "", tone: "info" };

const statusLabel = (status) => {
  if (!status?.configured) return "Chưa kết nối";
  return status.source === "restaurant" ? "Tài khoản chi nhánh" : "Tài khoản COHAN";
};

const statusDescription = (status) => {
  if (!status?.configured) return "Chưa có tài khoản cho loại đang chọn.";
  return status.source === "restaurant"
    ? "Chi nhánh đang dùng tài khoản riêng."
    : "Đang dùng tài khoản thanh toán do COHAN hỗ trợ.";
};

const friendlyPaymentError = (error, fallback) => {
  const message = String(error?.message || error || "");
  if (/invalid restaurantid/i.test(message)) return "Chi nhánh đang chọn không hợp lệ. Vui lòng chọn lại.";
  if (/unsupported payment provider/i.test(message)) return "Phương thức thanh toán này chưa được hỗ trợ.";
  if (/payment_credential_encryption_key_required/i.test(message)) {
    return "Hệ thống chưa sẵn sàng để lưu thông tin thanh toán. Vui lòng liên hệ quản trị viên.";
  }
  if (/payment_credential_decrypt_failed/i.test(message)) {
    return "Không thể đọc thông tin đã lưu. Vui lòng lưu lại kết nối hoặc liên hệ quản trị viên.";
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
        active: item.id === "vnpay",
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
      await persistProviderSettings(provider, { active: true, mode });
      setForms((current) => ({ ...current, [provider]: { ...EMPTY_FORMS[provider] } }));
      setNotice({ message: `Đã kết nối ${provider === "momo" ? "MoMo" : "VNPAY"} cho chi nhánh.`, tone: "success" });
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
      setNotice({
        message: "Đã gỡ tài khoản riêng của chi nhánh. COHAN sẽ dùng tài khoản hỗ trợ khi có sẵn.",
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
    setSavingProvider(provider);
    clearNotice();
    try {
      await persistProviderSettings(provider, { active, mode: modes[provider] });
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
            Thêm tài khoản nhận tiền cho <strong>{restaurantName || "chi nhánh đang chọn"}</strong>.
            Các thông tin bảo mật chỉ được dùng để xác nhận giao dịch.
          </p>
        </div>
        <div className="payment-provider-settings__security">
          <ShieldCheck aria-hidden="true" />
          <span><strong>Thông tin được bảo vệ</strong><small>Các khóa sẽ không hiển thị lại sau khi lưu.</small></span>
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

      <section className="payment-provider-settings__grid" aria-label="Phương thức thanh toán">
        {PROVIDERS.map((providerMeta) => {
          const mode = modes[providerMeta.id];
          const status = statusMap.get(`${providerMeta.id}:${mode}`);
          const providerConfig = providerConfigs.find((item) => item.provider === providerMeta.id);
          const busy = savingProvider === providerMeta.id;
          return (
            <article className={`payment-provider-card payment-provider-card--${providerMeta.id}`} key={providerMeta.id}>
              <div className="payment-provider-card__title">
                <ProviderLogo provider={providerMeta.id} />
                <div className="payment-provider-card__title-copy">
                  <h2>{providerMeta.name}</h2>
                  <p>{providerMeta.description}</p>
                </div>
                <span className={`payment-provider-card__status ${status?.configured ? "is-ready" : ""}`}>
                  {status?.configured && <CheckCircle2 aria-hidden="true" />}
                  {statusLabel(status)}
                </span>
              </div>

              <div className="payment-provider-card__summary">
                <fieldset className="payment-provider-card__mode" disabled={busy}>
                  <legend>Loại tài khoản</legend>
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
                  <span>Mã tài khoản đang dùng</span>
                  <strong title={status?.maskedIdentifier || "Chưa có"}>{status?.maskedIdentifier || "Chưa có"}</strong>
                  <small>{statusDescription(status)}</small>
                </div>

                <label className={`payment-provider-card__toggle ${!status?.configured ? "is-disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(providerConfig?.active)}
                    onChange={(event) => handleToggle(providerMeta.id, event.target.checked)}
                    disabled={busy || !status?.configured}
                  />
                  <span className="payment-provider-card__toggle-control" aria-hidden="true" />
                  <span className="payment-provider-card__toggle-copy">
                    <strong>Cho phép khách thanh toán</strong>
                    <small>{status?.configured ? `Hiển thị ${providerMeta.name} ở bước thanh toán.` : "Kết nối tài khoản trước khi bật."}</small>
                  </span>
                </label>
              </div>

              <form onSubmit={(event) => { event.preventDefault(); handleSave(providerMeta.id); }}>
                <div className="payment-provider-card__form-heading">
                  <div>
                    <h3>Thông tin kết nối</h3>
                    <p>Sao chép đúng các mã được {providerMeta.name} cấp cho loại tài khoản đã chọn.</p>
                  </div>
                  <a href={providerMeta.guideUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" /> Hướng dẫn lấy thông tin từ {providerMeta.name}
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
                      {field.type === "select" ? (
                        <select
                          id={fieldId}
                          aria-label={accessibleLabel}
                          aria-describedby={`${fieldId}-hint`}
                          value={forms[providerMeta.id][field.name]}
                          onChange={(event) => updateField(providerMeta.id, field.name, event.target.value)}
                          disabled={busy}
                        >
                          {field.options.map(([value, label]) => <option key={value || "auto"} value={value}>{label}</option>)}
                        </select>
                      ) : (
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
                      )}
                      <small className="payment-provider-card__field-hint" id={`${fieldId}-hint`}>{field.hint}</small>
                    </div>
                  );
                })}

                <div className="payment-provider-card__actions">
                  <button type="submit" className="payment-provider-card__primary" disabled={busy}>
                    <KeyRound aria-hidden="true" />
                    {busy ? "Đang lưu..." : status?.source === "restaurant" ? "Cập nhật kết nối" : "Lưu kết nối"}
                  </button>
                  {status?.source === "restaurant" && (
                    <button type="button" className="payment-provider-card__danger" onClick={() => handleDisconnect(providerMeta.id)} disabled={busy}>
                      <Link2Off aria-hidden="true" /> Gỡ tài khoản chi nhánh
                    </button>
                  )}
                </div>
              </form>
            </article>
          );
        })}
      </section>

      <aside className="payment-provider-settings__note">
        <strong>Phạm vi áp dụng</strong>
        <p>Tài khoản ở trang này dùng cho tiền đặt cọc, đơn hàng và thanh toán tại quầy của chi nhánh. Nạp tiền vào Ví COHAN vẫn được xử lý qua tài khoản chung của COHAN.</p>
      </aside>
    </main>
  );
}
