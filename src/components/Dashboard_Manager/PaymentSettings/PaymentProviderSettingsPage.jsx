import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { CheckCircle2, CreditCard, KeyRound, Link2Off, ShieldCheck, WalletCards } from "lucide-react";
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
    description: "Ví điện tử và QR MoMo dành cho merchant.",
    icon: WalletCards,
    fields: [
      ["partnerCode", "Partner Code"],
      ["accessKey", "Access Key"],
      ["secretKey", "Secret Key"],
    ],
  },
  {
    id: "vnpay",
    name: "VNPAY",
    description: "Thẻ ngân hàng nội địa, quốc tế hoặc VNPAY-QR.",
    icon: CreditCard,
    fields: [
      ["tmnCode", "TmnCode"],
      ["hashSecret", "Hash Secret"],
      ["bankCode", "Kênh thanh toán (không bắt buộc)"],
    ],
  },
];

const EMPTY_FORMS = {
  momo: { partnerCode: "", accessKey: "", secretKey: "" },
  vnpay: { tmnCode: "", hashSecret: "", bankCode: "VNBANK" },
};

const statusLabel = (status) => {
  if (!status?.configured) return "Chưa cấu hình";
  return status.source === "restaurant" ? "Tài khoản nhà hàng" : "Tài khoản nền tảng";
};

export default function PaymentProviderSettingsPage({ restaurantId, restaurantName = "" }) {
  const [forms, setForms] = useState(EMPTY_FORMS);
  const [modes, setModes] = useState({ momo: "sandbox", vnpay: "sandbox" });
  const [notice, setNotice] = useState("");
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
  const providerConfigs = publicConfig?.providers || [];

  const statusMap = useMemo(
    () => new Map(statuses.map((item) => [`${item.provider}:${item.mode}`, item])),
    [statuses],
  );

  const updateField = (provider, field, value) => {
    setForms((current) => ({
      ...current,
      [provider]: { ...current[provider], [field]: value },
    }));
    setNotice("");
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
      setNotice("Vui lòng nhập đầy đủ thông tin bắt buộc trước khi lưu.");
      return;
    }

    setSavingProvider(provider);
    setNotice("");
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
      setNotice(`Đã lưu tài khoản ${provider === "momo" ? "MoMo" : "VNPAY"} cho nhà hàng.`);
      await refetch();
    } catch (mutationError) {
      setNotice(mutationError?.message || "Không thể lưu cấu hình thanh toán.");
    } finally {
      setSavingProvider("");
    }
  };

  const handleDisconnect = async (provider) => {
    const mode = modes[provider];
    setSavingProvider(provider);
    setNotice("");
    try {
      await disconnectCredential({ variables: { restaurantId, provider, mode } });
      setNotice("Đã ngắt tài khoản riêng. Hệ thống sẽ dùng tài khoản nền tảng khi có cấu hình hợp lệ.");
      await refetch();
    } catch (mutationError) {
      setNotice(mutationError?.message || "Không thể ngắt kết nối cổng thanh toán.");
    } finally {
      setSavingProvider("");
    }
  };

  const handleToggle = async (provider, active) => {
    setSavingProvider(provider);
    setNotice("");
    try {
      await persistProviderSettings(provider, { active, mode: modes[provider] });
      setNotice(active ? "Đã bật cổng thanh toán." : "Đã tắt cổng thanh toán.");
      await refetch();
    } catch (mutationError) {
      setNotice(mutationError?.message || "Không thể cập nhật trạng thái cổng thanh toán.");
    } finally {
      setSavingProvider("");
    }
  };

  if (!restaurantId) {
    return (
      <section className="payment-provider-settings payment-provider-settings--empty">
        <KeyRound aria-hidden="true" />
        <h2>Chọn một chi nhánh</h2>
        <p>Chọn nhà hàng ở thanh trên cùng để cấu hình tài khoản MoMo hoặc VNPAY.</p>
      </section>
    );
  }

  return (
    <main className="payment-provider-settings">
      <header className="payment-provider-settings__header">
        <div>
          <p className="payment-provider-settings__eyebrow">THANH TOÁN TRỰC TUYẾN</p>
          <h1>Cấu hình cổng thanh toán</h1>
          <p>
            Kết nối tài khoản merchant cho <strong>{restaurantName || "chi nhánh đang chọn"}</strong>.
            Khóa bí mật được mã hóa và không hiển thị lại sau khi lưu.
          </p>
        </div>
        <div className="payment-provider-settings__security">
          <ShieldCheck aria-hidden="true" />
          <span>AES-256-GCM<br /><small>Không lưu khóa dạng rõ</small></span>
        </div>
      </header>

      {(loading || error || notice) && (
        <div className={`payment-provider-settings__notice ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>
          {loading ? "Đang đọc cấu hình thanh toán..." : error?.message || notice}
        </div>
      )}

      <section className="payment-provider-settings__grid" aria-label="Danh sách cổng thanh toán">
        {PROVIDERS.map((providerMeta) => {
          const Icon = providerMeta.icon;
          const mode = modes[providerMeta.id];
          const status = statusMap.get(`${providerMeta.id}:${mode}`);
          const providerConfig = providerConfigs.find((item) => item.provider === providerMeta.id);
          const busy = savingProvider === providerMeta.id;
          return (
            <article className="payment-provider-card" key={providerMeta.id}>
              <div className="payment-provider-card__title">
                <span className="payment-provider-card__icon"><Icon aria-hidden="true" /></span>
                <div>
                  <h2>{providerMeta.name}</h2>
                  <p>{providerMeta.description}</p>
                </div>
                <span className={`payment-provider-card__status ${status?.configured ? "is-ready" : ""}`}>
                  {status?.configured && <CheckCircle2 aria-hidden="true" />}
                  {statusLabel(status)}
                </span>
              </div>

              <div className="payment-provider-card__summary">
                <label>
                  Môi trường
                  <select
                    value={mode}
                    onChange={(event) => setModes((current) => ({ ...current, [providerMeta.id]: event.target.value }))}
                    disabled={busy}
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </label>
                <div>
                  <span>Định danh đã lưu</span>
                  <strong>{status?.maskedIdentifier || "Chưa có"}</strong>
                </div>
                <label className="payment-provider-card__toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(providerConfig?.active)}
                    onChange={(event) => handleToggle(providerMeta.id, event.target.checked)}
                    disabled={busy || !status?.configured}
                  />
                  <span>Bật cho khách hàng</span>
                </label>
              </div>

              <form onSubmit={(event) => { event.preventDefault(); handleSave(providerMeta.id); }}>
                {providerMeta.fields.map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      type={field === "bankCode" ? "text" : "password"}
                      autoComplete="new-password"
                      value={forms[providerMeta.id][field]}
                      onChange={(event) => updateField(providerMeta.id, field, event.target.value)}
                      placeholder={field === "bankCode" ? "VNBANK, VNPAYQR hoặc để trống" : `Nhập ${label}`}
                      disabled={busy}
                    />
                  </label>
                ))}
                <div className="payment-provider-card__actions">
                  <button type="submit" className="payment-provider-card__primary" disabled={busy}>
                    <KeyRound aria-hidden="true" />
                    {busy ? "Đang xử lý..." : status?.source === "restaurant" ? "Thay tài khoản" : "Lưu tài khoản"}
                  </button>
                  {status?.source === "restaurant" && (
                    <button type="button" className="payment-provider-card__danger" onClick={() => handleDisconnect(providerMeta.id)} disabled={busy}>
                      <Link2Off aria-hidden="true" /> Ngắt tài khoản riêng
                    </button>
                  )}
                </div>
              </form>
            </article>
          );
        })}
      </section>

      <aside className="payment-provider-settings__note">
        <strong>Lưu ý về ví Cohan Balance</strong>
        <p>Tiền nạp vào ví khách hàng thuộc nền tảng COHAN nên vẫn dùng tài khoản merchant của hệ thống. Tài khoản tại trang này áp dụng cho đặt cọc, đơn hàng và POS của chi nhánh.</p>
      </aside>
    </main>
  );
}
