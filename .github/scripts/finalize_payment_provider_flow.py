from pathlib import Path
import subprocess


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one match in {path}, found {count}: {old[:160]!r}"
        )
    write(path, text.replace(old, new, 1))


def patch_server() -> None:
    path = "cohan-restaurant-backend/src/server/createServer.js"
    subprocess.run(["git", "checkout", "origin/main", "--", path], check=True)

    replace_once(
        path,
        'import { applyPaymentProviderCallback, createReservationPayment, getPaymentSessionById, listReservationPayments, reconcileBankTransferWebhook } from "../services/payment/paymentSession.service.js";',
        'import { applyPaymentProviderCallback, createReservationPayment, getPaymentSessionById, listReservationPayments, reconcileBankTransferWebhook } from "../services/payment/paymentSession.service.js";\nimport { isVnpaySuccessful, verifyMomoCallback, verifyVnpayCallback } from "../services/payment/providers.js";',
    )
    replace_once(
        path,
        'import { ChatThread, Order } from "../../models/index.js";',
        'import { ChatThread, Order, PaymentSession } from "../../models/index.js";',
    )

    marker = (
        "export function buildContentSecurityPolicyDirectives({ inProduction, "
        "allowedOrigins, s3PublicBase, allowUnsafeInlineStyle }) {"
    )
    helpers = '''function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildPaymentReturnPage({ provider, verified, successful, paymentFound, reference }) {
  const providerLabel = String(provider || "").toLowerCase() === "momo" ? "MoMo" : "VNPAY";
  let title = "Đã ghi nhận kết quả thanh toán";
  let message = "Vui lòng quay lại cửa sổ COHAN. Hệ thống sẽ tự động cập nhật khi cổng thanh toán gửi xác nhận.";

  if (!verified) {
    title = "Không thể xác thực kết quả thanh toán";
    message = "Dữ liệu trả về không hợp lệ. Vui lòng quay lại COHAN và kiểm tra trạng thái giao dịch trước khi thử lại.";
  } else if (!paymentFound) {
    title = "Không tìm thấy phiên thanh toán";
    message = "COHAN chưa xác định được giao dịch tương ứng. Vui lòng quay lại ứng dụng để kiểm tra.";
  } else if (!successful) {
    title = "Giao dịch chưa hoàn tất";
    message = "Cổng thanh toán chưa xác nhận giao dịch thành công. Vui lòng quay lại COHAN để thử lại hoặc chọn phương thức khác.";
  }

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p>Phương thức: <strong>${escapeHtml(providerLabel)}</strong></p>
      ${reference ? `<p>Mã tham chiếu: <strong>${escapeHtml(reference)}</strong></p>` : ""}
      <p>Bạn có thể đóng trang này sau khi quay lại COHAN.</p>
    </main>
  </body>
</html>`;
}

export function getVnpayIpnValidationError({ signatureValid, payment, payload = {} }) {
  if (!signatureValid) return { RspCode: "97", Message: "Invalid Checksum" };
  if (!payment) return { RspCode: "01", Message: "Order not found" };

  const providerAmount = Math.round(Number(payload.vnp_Amount || 0) / 100);
  const expectedAmount = Math.round(Number(payment.amount || 0));
  if (providerAmount !== expectedAmount) {
    return { RspCode: "04", Message: "Invalid Amount" };
  }
  return null;
}

'''
    replace_once(path, marker, helpers + marker)

    text = read(path)
    start = text.index('  app.post("/api/payments/webhooks/:provider"')
    end = text.index('  app.get("/api/reverse-geocode"', start)
    routes = '''  app.get("/api/payments/webhooks/vnpay", async (req, reply) => {
    try {
      const payload = { ...(req.query || {}) };
      const signatureValid = verifyVnpayCallback({ ...payload });
      const reference = payload.vnp_TxnRef;
      const payment = signatureValid && reference
        ? await PaymentSession.findOne({ provider: "vnpay", reference })
        : null;
      const validationError = getVnpayIpnValidationError({ signatureValid, payment, payload });
      if (validationError) return reply.code(200).send(validationError);

      const alreadyConfirmed = String(payment.status || "").toLowerCase() === "success";
      const updatedPayment = await applyPaymentProviderCallback({
        provider: "vnpay",
        payload: { ...payload },
        source: "webhook",
      });
      if (updatedPayment?.status === "success" && !updatedPayment?.realtimeEmitSkipped) {
        await emitPaymentRealtime({ io: app.io, payment: updatedPayment, eventType: "PAYMENT_VERIFIED" });
      }
      return reply.code(200).send({
        RspCode: alreadyConfirmed ? "02" : "00",
        Message: alreadyConfirmed ? "Order already confirmed" : "Confirm Success",
      });
    } catch (err) {
      req.log.error({ err }, "VNPAY IPN failed");
      return reply.code(200).send({ RspCode: "99", Message: "Unknown error" });
    }
  });

  app.post("/api/payments/webhooks/:provider", async (req, reply) => {
    try {
      const payment = await applyPaymentProviderCallback({
        provider: req.params?.provider,
        payload: req.body || {},
        source: "webhook",
      });
      if (payment?.status === "success" && !payment?.realtimeEmitSkipped) {
        await emitPaymentRealtime({ io: app.io, payment, eventType: "PAYMENT_VERIFIED" });
      }
      return reply.send({ ok: true, paymentId: String(payment._id), status: payment.status });
    } catch (err) {
      req.log.error({ err }, "payment webhook failed");
      return reply.code(400).send({ ok: false, message: err?.message || "Webhook failed" });
    }
  });

  app.get("/api/payments/return/:provider", async (req, reply) => {
    const provider = String(req.params?.provider || "").toLowerCase();
    const payload = { ...(req.query || {}) };
    const reference = provider === "momo" ? payload.orderId : payload.vnp_TxnRef;
    try {
      const verified = provider === "momo"
        ? verifyMomoCallback(payload)
        : provider === "vnpay"
          ? verifyVnpayCallback(payload)
          : false;
      const payment = reference
        ? await PaymentSession.findOne({ provider, reference }).lean()
        : null;
      const successful = verified && (
        provider === "momo"
          ? Number(payload.resultCode) === 0
          : provider === "vnpay" && isVnpaySuccessful(payload)
      );
      return reply
        .type("text/html; charset=utf-8")
        .send(buildPaymentReturnPage({
          provider,
          verified,
          successful,
          paymentFound: Boolean(payment),
          reference,
        }));
    } catch (err) {
      req.log.warn({ err, provider, reference }, "payment return display failed");
      return reply
        .type("text/html; charset=utf-8")
        .send(buildPaymentReturnPage({
          provider,
          verified: false,
          successful: false,
          paymentFound: false,
          reference,
        }));
    }
  });

'''
    write(path, text[:start] + routes + text[end:])


def patch_payment_service() -> None:
    path = "cohan-restaurant-backend/src/services/payment/paymentSession.service.js"
    text = read(path)
    if "isVnpaySuccessful," not in text:
        text = text.replace(
            "  createVnpayPayment,\n",
            "  createVnpayPayment,\n  isVnpaySuccessful,\n",
            1,
        )
    start = text.index("function mapProviderStatus(provider, payload) {")
    end = text.index("\nexport async function applyPaymentProviderCallback", start)
    replacement = '''function mapProviderStatus(provider, payload) {
  if (provider === "momo") {
    return Number(payload?.resultCode) === 0 ? "success" : "failed";
  }
  if (isVnpaySuccessful(payload)) return "success";
  const code = String(payload?.vnp_ResponseCode || "");
  if (code === "24") return "cancelled";
  return "failed";
}
'''
    write(path, text[:start] + replacement + text[end:])


def patch_provider_verifier() -> None:
    path = "cohan-restaurant-backend/src/services/payment/providers.js"
    text = read(path)
    start = text.index("export function verifyVnpayCallback")
    mutation_start = text.index("  const isValid = safeCompareString(expected, secureHash);", start)
    mutation_end = text.index("  return isValid;", mutation_start) + len("  return isValid;")
    write(
        path,
        text[:mutation_start]
        + "  return safeCompareString(expected, secureHash);"
        + text[mutation_end:],
    )


def patch_restaurant_ui() -> None:
    path = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx"
    text = read(path)
    card_start = text.index('className="profile-section-card payment-provider-card"')
    row_start = text.index('                      <Row gutter={16}>', card_start)
    row_end = text.index('                      </Row>', row_start) + len(
        '                      </Row>'
    )
    controls = '''                      <Row gutter={[12, 12]} align="middle" justify="space-between">
                        <Col flex="auto">
                          <Text type="secondary">
                            {provider.provider === "momo"
                              ? "Cho phép khách hàng thanh toán qua MoMo"
                              : "Cho phép khách hàng thanh toán qua VNPAY"}
                          </Text>
                        </Col>
                        <Col>
                          <Form.Item label="Đang sử dụng" style={{ marginBottom: 0 }}>
                            <Switch
                              checked={provider.active !== false}
                              onChange={(checked) =>
                                setRestaurantForm((p) => {
                                  const providers = [...(p.paymentSettings?.providers || [])];
                                  providers[idx] = { ...providers[idx], active: checked };
                                  return { ...p, paymentSettings: { ...(p.paymentSettings || {}), providers } };
                                })
                              }
                            />
                          </Form.Item>
                        </Col>
                      </Row>'''
    write(path, text[:row_start] + controls + text[row_end:])

    main_path = "src/main.jsx"
    main = read(main_path).replace(
        'import "./components/Dashboard_Manager/RestaurantInfo/RestaurantPaymentMethodsSimple.css";\n',
        "",
    )
    write(main_path, main)
    for obsolete in (
        "src/components/Dashboard_Manager/RestaurantInfo/RestaurantPaymentMethodsSimple.css",
        "src/components/Dashboard_Manager/RestaurantInfo/RestaurantPaymentMethodsSimple.test.js",
    ):
        file_path = Path(obsolete)
        if file_path.exists():
            file_path.unlink()


def patch_tests() -> None:
    provider_test = "cohan-restaurant-backend/tests/services/payment-providers.security.test.js"
    replace_once(
        provider_test,
        '''    expect(verifyVnpayCallback(signedFailure)).toBe(true);
    expect(signedFailure.vnp_ResponseCode).toBe("02");''',
        '''    expect(verifyVnpayCallback(signedFailure)).toBe(true);
    expect(isVnpaySuccessful(signedFailure)).toBe(false);
    expect(signedFailure.vnp_ResponseCode).toBe("00");''',
    )

    callback_test = "cohan-restaurant-backend/tests/server/payment-provider-callback-contract.test.js"
    write(
        callback_test,
        '''import { describe, expect, it } from "vitest";
import {
  buildPaymentReturnPage,
  getVnpayIpnValidationError,
} from "../../src/server/createServer.js";

describe("payment provider callback contracts", () => {
  it("validates VNPAY IPN in checksum, order and amount order", () => {
    const payment = { amount: 150000 };
    const mismatched = { vnp_Amount: "10000000" };
    const matching = { vnp_Amount: "15000000" };

    expect(getVnpayIpnValidationError({ signatureValid: false, payment, payload: mismatched }))
      .toEqual({ RspCode: "97", Message: "Invalid Checksum" });
    expect(getVnpayIpnValidationError({ signatureValid: true, payment: null, payload: matching }))
      .toEqual({ RspCode: "01", Message: "Order not found" });
    expect(getVnpayIpnValidationError({ signatureValid: true, payment, payload: mismatched }))
      .toEqual({ RspCode: "04", Message: "Invalid Amount" });
    expect(getVnpayIpnValidationError({ signatureValid: true, payment, payload: matching }))
      .toBeNull();
  });

  it("renders a user-facing return page without raw callback data", () => {
    const html = buildPaymentReturnPage({
      provider: "vnpay",
      verified: true,
      successful: true,
      paymentFound: true,
      reference: '<script>alert("x")</script>',
    });

    expect(html).toContain("Đã ghi nhận kết quả thanh toán");
    expect(html).toContain("VNPAY");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("vnp_SecureHash");
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it("shows a clear error state for an unverified return", () => {
    const html = buildPaymentReturnPage({
      provider: "momo",
      verified: false,
      successful: false,
      paymentFound: true,
      reference: "MOMO-REF-1",
    });

    expect(html).toContain("Không thể xác thực kết quả thanh toán");
    expect(html).toContain("MoMo");
  });
});
''',
    )

    component_test = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx"
    text = read(component_test)
    if 'shows only customer-facing MoMo and VNPAY controls' not in text:
        index = text.rfind("\n});\n")
        if index < 0:
            raise RuntimeError("Could not find final describe terminator")
        test = '''

  it("shows only customer-facing MoMo and VNPAY controls", async () => {
    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    fireEvent.click(
      screen.getByRole("tab", { name: /Thanh toán trực tuyến/i }),
    );

    await waitFor(() => {
      expect(screen.getAllByText("MoMo").length).toBeGreaterThan(0);
      expect(screen.getAllByText("VNPAY").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Môi trường kết nối")).not.toBeInTheDocument();
    expect(screen.queryByText("Kiểm thử")).not.toBeInTheDocument();
    expect(screen.queryByText("Vận hành thực tế")).not.toBeInTheDocument();
    expect(screen.queryByText("Thứ tự ưu tiên")).not.toBeInTheDocument();
    expect(screen.queryByText("Tên hiển thị")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));
    expect(
      updateRestaurantMock.mock.calls[0][0].variables.input.paymentSettings.providers,
    ).toEqual(restaurant.paymentSettings.providers);
  });'''
        write(component_test, text[:index] + test + text[index:])


def validate_source() -> None:
    server = read("cohan-restaurant-backend/src/server/createServer.js")
    service = read("cohan-restaurant-backend/src/services/payment/paymentSession.service.js")
    provider = read("cohan-restaurant-backend/src/services/payment/providers.js")
    ui = read("src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx")

    assert 'app.get("/api/payments/webhooks/vnpay"' in server
    assert 'app.post("/api/payments/webhooks/:provider"' in server
    assert 'app.get("/api/payments/return/:provider"' in server
    assert "isVnpaySuccessful(payload)" in service
    assert "const isValid = safeCompareString" not in provider
    assert "Môi trường kết nối" not in ui
    assert "Thứ tự ưu tiên" not in ui
    assert "Tên hiển thị" not in ui


if __name__ == "__main__":
    patch_server()
    patch_payment_service()
    patch_provider_verifier()
    patch_restaurant_ui()
    patch_tests()
    validate_source()
    print("Focused payment provider patch applied successfully")
