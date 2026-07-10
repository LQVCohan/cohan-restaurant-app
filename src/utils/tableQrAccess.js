const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const MAX_QR_PAYLOAD_LENGTH = 8192;
const MAX_TOKEN_LENGTH = 4096;

const invalidResult = (message) => ({ ok: false, message });

export function parseTableAccessQr(rawValue, baseUrl) {
  const value = String(rawValue || "").trim();

  if (!value) {
    return invalidResult("Hãy quét mã QR hoặc dán địa chỉ được in trên bàn.");
  }

  if (value.length > MAX_QR_PAYLOAD_LENGTH) {
    return invalidResult("Mã QR quá dài và không đúng định dạng bàn của COHAN.");
  }

  let url;

  try {
    url = new URL(
      value,
      baseUrl ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "https://cohan.local"),
    );
  } catch {
    return invalidResult("Không đọc được địa chỉ trong mã QR. Hãy thử quét lại.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return invalidResult("Mã QR không sử dụng địa chỉ web an toàn.");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const [resource, restaurantId, tableId] = pathParts;

  if (
    pathParts.length !== 3 ||
    resource !== "table" ||
    !OBJECT_ID_PATTERN.test(restaurantId || "") ||
    !OBJECT_ID_PATTERN.test(tableId || "")
  ) {
    return invalidResult("Đây không phải mã QR truy cập bàn của COHAN.");
  }

  const token = String(url.searchParams.get("token") || "").trim();

  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return invalidResult("Mã QR của bàn bị thiếu hoặc đã hỏng. Hãy nhờ nhân viên hỗ trợ.");
  }

  return {
    ok: true,
    restaurantId,
    tableId,
    token,
    path: `/table/${restaurantId}/${tableId}?token=${encodeURIComponent(token)}`,
  };
}
