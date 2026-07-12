import React, { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink } from "lucide-react";
import "./PaymentGatewaySetupGuide.scss";

function SetupUrl({ label, value, copiedKey, onCopy }) {
  const copied = copiedKey === label;
  return (
    <div className="payment-gateway-setup__url-row">
      <span>{label}</span>
      <code title={value}>{value || "Chưa xác định"}</code>
      <button type="button" onClick={() => onCopy(label, value)} disabled={!value}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Đã sao chép" : "Sao chép"}
      </button>
    </div>
  );
}

export default function PaymentGatewaySetupGuide({ setup }) {
  const [copiedKey, setCopiedKey] = useState("");

  const copyUrl = async (label, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(label);
      window.setTimeout(() => setCopiedKey(""), 1800);
    } catch {
      setCopiedKey("");
    }
  };

  return (
    <section className="payment-gateway-setup" aria-labelledby="payment-gateway-setup-title">
      <div className="payment-gateway-setup__heading">
        <div>
          <p>LUỒNG THIẾT LẬP VNPAY</p>
          <h2 id="payment-gateway-setup-title">Từ tài khoản merchant đến lúc khách thanh toán</h2>
        </div>
        <a href="https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html" target="_blank" rel="noreferrer">
          Tài liệu VNPAY <ExternalLink aria-hidden="true" />
        </a>
      </div>

      {!setup?.publiclyReachable ? (
        <div className="payment-gateway-setup__warning" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Backend chưa có địa chỉ công khai</strong>
            <p>
              URL hiện tại là <code>{setup?.publicBaseUrl || "localhost"}</code>. VNPAY không thể gửi IPN về địa chỉ nội bộ; quản trị hệ thống cần cấu hình <code>API_PUBLIC_BASE_URL</code> trước khi đăng ký URL bên dưới.
            </p>
          </div>
        </div>
      ) : null}

      <ol className="payment-gateway-setup__steps">
        <li>
          <span>1</span>
          <div><strong>Đăng ký tài khoản VNPAY merchant</strong><p>Nhận bộ TmnCode và Hash Secret đúng với môi trường Sandbox hoặc Production.</p></div>
        </li>
        <li>
          <span>2</span>
          <div className="payment-gateway-setup__callback-step">
            <strong>Đăng ký URL kỹ thuật với VNPAY</strong>
            <p>Gửi IPN URL cho VNPAY và dùng Return URL khi cấu hình website/điểm bán.</p>
            <div className="payment-gateway-setup__urls">
              <SetupUrl label="IPN URL" value={setup?.vnpayIpnUrl} copiedKey={copiedKey} onCopy={copyUrl} />
              <SetupUrl label="Return URL" value={setup?.vnpayReturnUrl} copiedKey={copiedKey} onCopy={copyUrl} />
            </div>
          </div>
        </li>
        <li>
          <span>3</span>
          <div><strong>Nhập thông tin kết nối</strong><p>Chọn đúng loại tài khoản, nhập TmnCode, Hash Secret và cách thanh toán ưu tiên ở thẻ VNPAY phía dưới.</p></div>
        </li>
        <li>
          <span>4</span>
          <div><strong>Lưu, thử giao dịch rồi bật cho khách</strong><p>Lưu kết nối sẽ đồng bộ môi trường và bật VNPAY. Hãy chạy một giao dịch Sandbox trước khi chuyển sang tài khoản chính thức.</p></div>
        </li>
      </ol>
    </section>
  );
}
