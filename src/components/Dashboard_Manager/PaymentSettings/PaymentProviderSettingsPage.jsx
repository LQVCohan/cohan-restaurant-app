import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2Off,
  ShieldCheck,
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
      ready
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
  mutation SaveRestaurantPaymentCredential(
    $input: SaveRestaurantPaymentCredentialInput!
  ) {
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
  mutation DisconnectRestaurantPaymentCredential(
    $restaurantId: ID!
    $provider: String!
    $mode: String!
  ) {
    disconnectRestaurantPaymentCredential(
      restaurantId: $restaurantId
      provider: $provider
      mode: $mode
    ) {
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
  mutation UpdateRestaurantPaymentSettings(
    $input: UpdateRestaurantPaymentSettingsInput!
  ) {
    updateRestaurantPaymentSettings(input: $input) {
      id
      paymentSettings {
        defaultProvider
        providers {
          provider
          label
          active
          priority
          mode
        }
      }
    }
  }
`;

const PROVIDERS = [
  {
    id: "momo",
    name: "MoMo",
    description: "Nhận thanh toán qua ví MoMo và mã QR.",
    guideUrl:
      "https://developers.momo.vn/v3/vi/docs/payment/onboarding/integration-process/",
    instruction: "Nhập đúng bộ thông tin MoMo cấp cho nhà hàng của bạn.",
    fields: [
      {
        name: "partnerCode",
        label: "Mã đối tác",
        providerLabel: "Partner Code",
        hint: "Mã do MoMo cấp cho tài khoản doanh nghiệp của bạn.",
        placeholder: "Dán Partner Code từ MoMo",
      },
      {
        name: "accessKey",
        label: "Khóa truy cập",
        providerLabel: "Access Key",
        hint: "Nhập Access Key cùng bộ với Partner Code.",
        placeholder: "Dán Access Key từ MoMo",
        secret: true,
      },
      {
        name: "secretKey",
        label: "Khóa bảo mật",
        providerLabel: "Secret Key",
        hint: "Khóa này được bảo vệ và không hiển thị lại sau khi lưu.",
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
    instruction: "Nhập đúng bộ thông tin VNPAY cấp cho nhà hàng của bạn.",
    fields: [
      {
        name: "tmnCode",
        label: "Mã website hoặc điểm bán",
        providerLabel: "TmnCode",
        hint: "Mã kết nối do VNPAY cấp cho bạn.",
        placeholder: "Dán TmnCode từ VNPAY",
      },
      {
        name: "hashSecret",
        label: "Khóa bảo mật",
        providerLabel: "Hash Secret",
        hint: "Khóa này được bảo vệ và không hiển thị lại sau khi lưu.",
        placeholder: "Dán Hash Secret từ VNPAY",
        secret: true,
      },
    ],
  },
];

const MODE_OPTIONS = [
  {
    value: "sandbox",
    label: "Dùng thử",
    description: "Dùng để kiểm tra trước khi nhận tiền thật.",
  },
  {
    value: "production",
    label: "Chính thức",
    description: "Dùng để nhận thanh toán thật.",
  },
];

const EMPTY_FORMS = {
  momo: { partnerCode: "", accessKey: "", secretKey: "" },
  vnpay: { tmnCode: "", hashSecret: "" },
};
const EMPTY_NOTICE = { message: "", tone: "info" };

const friendlyPaymentError = (error, fallback) => {
  const message = String(error?.message || error || "");
  if (/invalid restaurantid/i.test(message)) {
    return "Chi nhánh đang chọn không hợp lệ. Vui lòng chọn lại.";
  }
  if (/unsupported payment provider/i.test(message)) {
    return "Phương thức thanh toán này chưa được hỗ trợ.";
  }
  if (
    /payment_credential_encryption_key_required|payment_public_base_url_required/i.test(
      message,
    )
  ) {
    return "Hệ thống thanh toán chưa sẵn sàng. Vui lòng liên hệ hỗ trợ COHAN.";
  }
  if (/payment_credential_decrypt_failed/i.test(message)) {
    return "Không thể đọc thông tin đã lưu. Vui lòng nhập lại hoặc liên hệ hỗ trợ COHAN.";
  }
  if (/required/i.test(message)) {
    return "Vui lòng nhập đủ các thông tin bắt buộc.";
  }
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại.";
  }
  return fallback;
};

function ProviderLogo({ provider }) {
  if (provider === "momo") {
    return (
      <span
        className="payment-provider-card__brand-logo payment-provider-card__brand-logo--momo"
        role="img"
        aria-label="Logo MoMo"
      >
        <span>Mo</span>
        <span>Mo</span>
      </span>
    );
  }
  return (
    <span
      className="payment-provider-card__brand-logo payment-provider-card__brand-logo--vnpay"
      role="img"
      aria-label="Logo VNPAY"
    >
      <span>VN</span>
      <span>PAY</span>
    </span>
  );
}

function statusLabel(status, ready) {
  if (!status?.configured) return "Chưa kết nối";
  if (!ready) return "Đã lưu";
  return "Đang hoạt động";
}

function statusDescription(status, ready) {
  if (!status?.configured) return "Nhập thông tin bên dưới để kết nối.";
  if (!ready) return "Thông tin đã được lưu và đang chờ kích hoạt.";
  return "Khách hàng có thể sử dụng phương thức này khi thanh toán.";
}

function accountDisplay(status) {
  if (!status?.configured) return "Chưa có";
  if (status.source === "restaurant") {
    return status.maskedIdentifier || "Đã lưu";
  }
  return "Đã thiết lập";
}

export default function PaymentProviderSettingsPage({
  restaurantId,
  restaurantName = "",
}) {
  const [forms, setForms] = useState(EMPTY_FORMS);
  const [modes, setModes] = useState({ momo: "sandbox", vnpay: "sandbox" });
  const [notice, setNotice] = useState(EMPTY_NOTICE);
  const [savingProvider, setSavingProvider] = useState("");

  const { data, loading, error, refetch } = useQuery(
    PAYMENT_PROVIDER_SETTINGS,
    {
      variables: { restaurantId },
      skip: !restaurantId,
      fetchPolicy: "network-only",
    },
  );
  const [saveCredential] = useMutation(SAVE_PAYMENT_CREDENTIAL);
  const [disconnectCredential] = useMutation(DISCONNECT_PAYMENT_CREDENTIAL);
  const [updatePaymentSettings] = useMutation(UPDATE_PAYMENT_SETTINGS);

  const statuses = data?.restaurantPaymentCredentialStatuses || [];
  const readinessItems = data?.restaurantPaymentIntegrationReadiness || [];
  const publicConfig = data?.restaurantPaymentPublicConfig;
  const providerConfigs = publicConfig?.providers || [];

  const savedModes = useMemo(() => {
    const next = { momo: "sandbox", vnpay: "sandbox" };
    providerConfigs.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(next, item.provider)) {
        next[item.provider] = item.mode;
      }
    });
    return next;
  }, [providerConfigs]);

  useEffect(() => {
    setModes(savedModes);
  }, [restaurantId, savedModes]);

  const statusMap = useMemo(
    () =>
      new Map(
        statuses.map((item) => [`${item.provider}:${item.mode}`, item]),
      ),
    [statuses],
  );
  const readinessMap = useMemo(
    () =>
      new Map(
        readinessItems.map((item) => [`${item.provider}:${item.mode}`, item]),
      ),
    [readinessItems],
  );

  const updateField = (provider, field, value) => {
    setForms((current) => ({
      ...current,
      [provider]: { ...current[provider], [field]: value },
    }));
    setNotice(EMPTY_NOTICE);
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
      active:
        item.provider === provider ? patch.active ?? item.active : item.active,
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
    const requiredFields =
      provider === "momo"
        ? ["partnerCode", "accessKey", "secretKey"]
        : ["tmnCode", "hashSecret"];

    if (requiredFields.some((field) => !String(form[field] || "").trim())) {
      setNotice({
        message: "Vui lòng nhập đủ các thông tin bắt buộc trước khi lưu.",
        tone: "error",
      });
      return;
    }

    setSavingProvider(provider);
    setNotice(EMPTY_NOTICE);
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
      await persistProviderSettings(provider, {
        active: Boolean(readiness?.ready),
        mode,
      });
      setForms((current) => ({
        ...current,
        [provider]: { ...EMPTY_FORMS[provider] },
      }));
      setNotice({
        message: readiness?.ready
          ? `Đã kết nối ${provider === "momo" ? "MoMo" : "VNPAY"} cho chi nhánh.`
          : "Đã lưu thông tin. Vui lòng liên hệ hỗ trợ COHAN để hoàn tất kích hoạt.",
        tone: readiness?.ready ? "success" : "info",
      });
      await refetch();
    } catch (mutationError) {
      setNotice({
        message: friendlyPaymentError(
          mutationError,
          "Không thể lưu kết nối thanh toán. Vui lòng thử lại.",
        ),
        tone: "error",
      });
    } finally {
      setSavingProvider("");
    }
  };

  const handleDisconnect = async (provider) => {
    const mode = modes[provider];
    setSavingProvider(provider);
    setNotice(EMPTY_NOTICE);
    try {
      await disconnectCredential({
        variables: { restaurantId, provider, mode },
      });
      await persistProviderSettings(provider, { active: false });
      setNotice({
        message: "Đã ngắt kết nối và ẩn phương thức khỏi bước thanh toán.",
        tone: "success",
      });
      await refetch();
    } catch (mutationError) {
      setNotice({
        message: friendlyPaymentError(
          mutationError,
          "Không thể ngắt kết nối thanh toán. Vui lòng thử lại.",
        ),
        tone: "error",
      });
    } finally {
      setSavingProvider("");
    }
  };

  const handleToggle = async (provider, active) => {
    const mode = modes[provider];
    const readiness = readinessMap.get(`${provider}:${mode}`);
    const providerName = provider === "momo" ? "MoMo" : "VNPAY";
    if (active && !readiness?.ready) {
      setNotice({
        message: "Phương thức này chưa thể bật. Vui lòng liên hệ hỗ trợ COHAN.",
        tone: "error",
      });
      return;
    }

    setSavingProvider(provider);
    setNotice(EMPTY_NOTICE);
    try {
      await persistProviderSettings(provider, { active });
      setNotice({
        message: active
          ? `Đã bật ${providerName} cho khách thanh toán.`
          : `Đã ẩn ${providerName} khỏi bước thanh toán.`,
        tone: "success",
      });
      await refetch();
    } catch (mutationError) {
      setNotice({
        message: friendlyPaymentError(
          mutationError,
          "Không thể thay đổi phương thức thanh toán. Vui lòng thử lại.",
        ),
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
    ? friendlyPaymentError(
        error,
        "Không thể tải thông tin thanh toán. Vui lòng thử lại.",
      )
    : "";
  const feedbackMessage = loading
    ? "Đang tải thông tin thanh toán..."
    : queryErrorMessage || notice.message;
  const feedbackTone = error ? "error" : loading ? "info" : notice.tone;

  return (
    <main className="payment-provider-settings">
      <header className="payment-provider-settings__header">
        <div className="payment-provider-settings__header-copy">
          <p className="payment-provider-settings__eyebrow">
            THANH TOÁN TRỰC TUYẾN
          </p>
          <h1>Kết nối MoMo và VNPAY</h1>
          <p>
            Nhập thông tin do nhà cung cấp cấp cho{" "}
            <strong>{restaurantName || "chi nhánh đang chọn"}</strong>.
          </p>
        </div>
        <div className="payment-provider-settings__security">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Thông tin được bảo vệ</strong>
            <small>Khóa bí mật không hiển thị lại sau khi lưu.</small>
          </span>
        </div>
      </header>

      {feedbackMessage ? (
        <div
          className={`payment-provider-settings__notice is-${feedbackTone}`}
          role={feedbackTone === "error" ? "alert" : "status"}
        >
          {feedbackMessage}
        </div>
      ) : null}

      <section
        className="payment-provider-settings__grid"
        aria-label="Phương thức thanh toán"
      >
        {PROVIDERS.map((providerMeta) => {
          const mode = modes[providerMeta.id];
          const status = statusMap.get(`${providerMeta.id}:${mode}`);
          const readiness = readinessMap.get(`${providerMeta.id}:${mode}`);
          const providerConfig = providerConfigs.find(
            (item) => item.provider === providerMeta.id,
          );
          const busy = savingProvider === providerMeta.id;
          const ready = Boolean(status?.configured && readiness?.ready);

          return (
            <article
              className={`payment-provider-card payment-provider-card--${providerMeta.id}`}
              key={providerMeta.id}
            >
              <div className="payment-provider-card__title">
                <ProviderLogo provider={providerMeta.id} />
                <div className="payment-provider-card__title-copy">
                  <h2>{providerMeta.name}</h2>
                  <p>{providerMeta.description}</p>
                </div>
                <span
                  className={`payment-provider-card__status ${ready ? "is-ready" : ""}`}
                >
                  {ready ? <CheckCircle2 aria-hidden="true" /> : null}
                  {statusLabel(status, ready)}
                </span>
              </div>

              <div className="payment-provider-card__summary">
                <fieldset
                  className="payment-provider-card__mode"
                  disabled={busy}
                >
                  <legend>Loại tài khoản</legend>
                  <div className="payment-provider-card__mode-options">
                    {MODE_OPTIONS.map((option) => (
                      <label
                        className={mode === option.value ? "is-selected" : ""}
                        key={option.value}
                      >
                        <input
                          type="radio"
                          name={`${providerMeta.id}-mode`}
                          value={option.value}
                          checked={mode === option.value}
                          aria-label={option.label}
                          onChange={() => {
                            setModes((current) => ({
                              ...current,
                              [providerMeta.id]: option.value,
                            }));
                            setNotice(EMPTY_NOTICE);
                          }}
                        />
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="payment-provider-card__saved-account">
                  <span>Tài khoản đang dùng</span>
                  <strong title={accountDisplay(status)}>
                    {accountDisplay(status)}
                  </strong>
                  <small>{statusDescription(status, ready)}</small>
                </div>

                <label
                  className={`payment-provider-card__toggle ${!ready ? "is-disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(providerConfig?.active && ready)}
                    onChange={(event) =>
                      handleToggle(providerMeta.id, event.target.checked)
                    }
                    disabled={busy || !ready}
                  />
                  <span
                    className="payment-provider-card__toggle-control"
                    aria-hidden="true"
                  />
                  <span className="payment-provider-card__toggle-copy">
                    <strong>Cho phép khách thanh toán</strong>
                    <small>
                      {ready
                        ? `Hiển thị ${providerMeta.name} ở bước thanh toán.`
                        : "Kết nối tài khoản trước khi bật."}
                    </small>
                  </span>
                </label>
              </div>

              {status?.configured && !readiness?.ready ? (
                <div
                  className="payment-provider-settings__notice is-error"
                  role="alert"
                >
                  Hệ thống chưa thể kích hoạt phương thức này. Vui lòng liên hệ
                  hỗ trợ COHAN.
                </div>
              ) : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave(providerMeta.id);
                }}
              >
                <div className="payment-provider-card__form-heading">
                  <div>
                    <h3>Thông tin kết nối</h3>
                    <p>{providerMeta.instruction}</p>
                  </div>
                  <a
                    href={providerMeta.guideUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink aria-hidden="true" /> Hướng dẫn lấy thông tin
                  </a>
                </div>

                {providerMeta.fields.map((field) => {
                  const fieldId = `${providerMeta.id}-${field.name}`;
                  return (
                    <div
                      className="payment-provider-card__field"
                      key={field.name}
                    >
                      <label htmlFor={fieldId}>
                        <span>{field.label}</span>
                        <small>{field.providerLabel}</small>
                      </label>
                      <input
                        id={fieldId}
                        aria-label={`${field.label} (${field.providerLabel})`}
                        aria-describedby={`${fieldId}-hint`}
                        type={field.secret ? "password" : "text"}
                        autoComplete={field.secret ? "new-password" : "off"}
                        spellCheck="false"
                        value={forms[providerMeta.id][field.name]}
                        onChange={(event) =>
                          updateField(
                            providerMeta.id,
                            field.name,
                            event.target.value,
                          )
                        }
                        placeholder={field.placeholder}
                        disabled={busy}
                      />
                      <small
                        className="payment-provider-card__field-hint"
                        id={`${fieldId}-hint`}
                      >
                        {field.hint}
                      </small>
                    </div>
                  );
                })}

                <div className="payment-provider-card__actions">
                  <button
                    type="submit"
                    className="payment-provider-card__primary"
                    disabled={busy}
                  >
                    <KeyRound aria-hidden="true" />
                    {busy
                      ? "Đang lưu..."
                      : status?.source === "restaurant"
                        ? "Cập nhật kết nối"
                        : "Lưu kết nối"}
                  </button>
                  {status?.source === "restaurant" ? (
                    <button
                      type="button"
                      className="payment-provider-card__danger"
                      onClick={() => handleDisconnect(providerMeta.id)}
                      disabled={busy}
                    >
                      <Link2Off aria-hidden="true" /> Ngắt kết nối
                    </button>
                  ) : null}
                </div>
              </form>
            </article>
          );
        })}
      </section>

      <aside className="payment-provider-settings__note">
        <strong>Nhận tiền</strong>
        <p>
          Tiền được đối soát về tài khoản ngân hàng đã đăng ký với MoMo hoặc
          VNPAY của chi nhánh.
        </p>
      </aside>
    </main>
  );
}
