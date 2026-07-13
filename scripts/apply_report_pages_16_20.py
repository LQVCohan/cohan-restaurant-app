from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, content):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected 1 exact match, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def sub_once(path, pattern, replacement, flags=re.MULTILINE | re.DOTALL):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: expected 1 regex match, found {count}: {pattern[:120]!r}")
    write(path, updated)


def insert_before_last(path, marker, content):
    text = read(path)
    index = text.rfind(marker)
    if index < 0:
        raise RuntimeError(f"{path}: marker not found: {marker!r}")
    write(path, text[:index] + content + text[index:])


write(
    "src/utils/userFacingError.js",
    '''const TECHNICAL_ERROR_PATTERN =
  /(Variable\\s+"\\$|got invalid value|cannot represent|GraphQL|ApolloError|TypeError|ReferenceError|SyntaxError|ObjectId|ECONN(?:REFUSED|RESET)|\\bat input\\.[a-z]|\\bextensions\\.code\\b|\\bstatus code\\s*\\d{3}\\b|\\b[a-f0-9]{24}\\b|\\b[0-9a-f]{8}-[0-9a-f-]{27,}\\b|stack trace|resolver|non-nullable)/i;

const getRawMessage = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return (
    value?.graphQLErrors?.[0]?.message ||
    value?.networkError?.message ||
    value?.message ||
    String(value)
  );
};

export const isTechnicalErrorMessage = (value) =>
  TECHNICAL_ERROR_PATTERN.test(getRawMessage(value));

export const toUserFacingErrorMessage = (
  value,
  fallback = "Thao tác chưa hoàn tất. Vui lòng thử lại.",
) => {
  const raw = getRawMessage(value).trim();
  if (!raw || TECHNICAL_ERROR_PATTERN.test(raw)) return fallback;
  return raw
    .replace(
      /\\b(categoryId|itemId|restaurantId|orderId|userId)\\b/gi,
      "thông tin liên quan",
    )
    .replace(/\\s{2,}/g, " ")
    .trim();
};
''',
)

write(
    "src/utils/userFacingError.test.js",
    '''import { describe, expect, it } from "vitest";
import {
  isTechnicalErrorMessage,
  toUserFacingErrorMessage,
} from "./userFacingError";

describe("userFacingError", () => {
  it("hides GraphQL scalar and internal identifier details", () => {
    const raw =
      'Variable "$input" got invalid value at input.startDate; DateTime cannot represent value ObjectId 64ad4f7b8ac9c32100112233';
    expect(isTechnicalErrorMessage(raw)).toBe(true);
    expect(toUserFacingErrorMessage(raw, "Dữ liệu chưa hợp lệ.")).toBe(
      "Dữ liệu chưa hợp lệ.",
    );
  });

  it("preserves useful business messages", () => {
    expect(toUserFacingErrorMessage("Số điện thoại đã được sử dụng.")).toBe(
      "Số điện thoại đã được sử dụng.",
    );
  });
});
''',
)

# Technical window.alert messages must keep error severity after copy is sanitized.
sub_once(
    "src/context/NotificationProvider.jsx",
    r'''const notifyAlert = \(message\) => \{\s*const alertMessage = toAlertMessage\(message\);\s*showNotification\(alertMessage, getAlertNotificationType\(alertMessage\)\);\s*\};''',
    '''const notifyAlert = (message) => {
      const rawMessage =
        message instanceof Error
          ? message.message || ALERT_FALLBACK_MESSAGE
          : String(message || ALERT_FALLBACK_MESSAGE);
      const alertMessage = toAlertMessage(message);
      const type = TECHNICAL_ERROR_PATTERN.test(rawMessage)
        ? "error"
        : getAlertNotificationType(rawMessage);
      showNotification(alertMessage, type);
    };''',
)

# Guest creation returns the authoritative record to the UI refresh path.
sub_once(
    "src/hooks/useUserManagement.js",
    r'''const createGuest = async \(\{\s*fullName = "Guest",\s*phone,\s*expiresInDays = 30,\s*\}\) => \{\s*await createGuestMut\(\{ variables: \{ fullName, phone, expiresInDays \} \}\);\s*\};''',
    '''const createGuest = async ({
    fullName = "Guest",
    phone,
    expiresInDays = 30,
  }) => {
    const result = await createGuestMut({
      variables: { fullName, phone, expiresInDays },
    });
    return result?.data?.createGuestUser || null;
  };''',
)

replace_once(
    "src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx",
    'import { useNotification } from "../../../hooks/useNotification";\n',
    'import { useNotification } from "../../../hooks/useNotification";\nimport { toUserFacingErrorMessage } from "../../../utils/userFacingError";\n',
)
sub_once(
    "src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx",
    r'''await createGuest\(\{\s*fullName: form\.fullName\.trim\(\),\s*phone: normalizePhoneVN\(form\.phone\),\s*expiresInDays: 30,\s*\}\);\s*const syncResult =\s*typeof onCreated === "function" \? await onCreated\(\) : null;''',
    '''const createdGuest = await createGuest({
          fullName: form.fullName.trim(),
          phone: normalizePhoneVN(form.phone),
          expiresInDays: 30,
        });
        const syncResult =
          typeof onCreated === "function"
            ? await onCreated(createdGuest)
            : null;''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx",
    '        provider: "local",\n        status: "active",\n',
    '        provider: "local",\n',
)
sub_once(
    "src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx",
    r'''const graphError = err\?\.graphQLErrors\?\.\[0\];\s*let msg =\s*graphError\?\.message \|\|\s*err\?\.message \|\|\s*"Không thể tạo khách hàng\. Vui lòng thử lại\.";\s*const lower = msg\.toLowerCase\(\);\s*if \(\s*lower\.includes\("already in use"\) \|\|\s*lower\.includes\("duplicate"\) \|\|\s*lower\.includes\("exists"\)\s*\) \{\s*msg = "Email, số điện thoại hoặc tên đăng nhập đã được sử dụng\.";\s*\}\s*setSubmitError\(msg\);\s*showNotification\(msg, "error"\);''',
    '''const rawMessage =
        err?.graphQLErrors?.[0]?.message || err?.message || "";
      const lower = rawMessage.toLowerCase();
      const msg =
        lower.includes("already in use") ||
        lower.includes("duplicate") ||
        lower.includes("exists")
          ? "Email, số điện thoại hoặc tên đăng nhập đã được sử dụng."
          : toUserFacingErrorMessage(
              err,
              "Không thể tạo khách hàng. Vui lòng kiểm tra thông tin và thử lại.",
            );
      setSubmitError(msg);
      showNotification(msg, "error");''',
)
insert_before_last(
    "src/components/Dashboard_Manager/Customer/AddCustomerModal.test.jsx",
    "});",
    '''
  it("passes the created guest to the list refresh callback", async () => {
    const createdGuest = {
      id: "guest-1",
      fullName: "Khách nhanh",
      phone: "0901234567",
      isGuest: true,
    };
    mocks.createGuest.mockResolvedValueOnce(createdGuest);
    const onCreated = vi.fn().mockResolvedValue({ visibleInCurrentList: true });
    render(<AddCustomerModal onClose={vi.fn()} onCreated={onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: /Khách vãng lai/i }));
    fireEvent.change(getControl("new-guest-full-name"), {
      target: { value: "Khách nhanh" },
    });
    fireEvent.change(getControl("new-guest-phone"), {
      target: { value: "0901234567" },
    });
    fireEvent.submit(document.querySelector("#add-customer-form"));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdGuest));
  });

  it("does not let the client force a registered account active", async () => {
    mocks.createUser.mockResolvedValueOnce({
      data: { createUser: { user: { id: "customer-1" } } },
    });
    render(
      <AddCustomerModal
        onClose={vi.fn()}
        onCreated={vi.fn().mockResolvedValue({})}
      />,
    );
    fireEvent.change(getControl("new-customer-full-name"), {
      target: { value: "Nguyễn An" },
    });
    fireEvent.change(getControl("new-customer-email"), {
      target: { value: "an@example.com" },
    });
    fireEvent.change(getControl("new-customer-password"), {
      target: { value: "Matkhau123" },
    });
    fireEvent.change(getControl("new-customer-password-confirmation"), {
      target: { value: "Matkhau123" },
    });
    fireEvent.submit(document.querySelector("#add-customer-form"));
    await vi.waitFor(() => expect(mocks.createUser).toHaveBeenCalled());
    expect(mocks.createUser.mock.calls[0][0]).not.toHaveProperty("status");
  });
''',
)

# Promotion modal: selected restaurant is authoritative, technical labels/errors are hidden.
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    'import { useCoupons } from "../../../hooks/useCoupons";\n',
    'import { useCoupons } from "../../../hooks/useCoupons";\nimport { toUserFacingErrorMessage } from "../../../utils/userFacingError";\n',
)
sub_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    r'''const SUPPORTED_CHANNELS = \{.*?\n\};\n\nconst getCustomerTier''',
    '''const SUPPORTED_CHANNELS = {
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

const getCustomerTier''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '.filter((p) => !restaurantId || String(p.restaurantId) === String(restaurantId))',
    '.filter((p) => isCurrentOffer(p, restaurantId))',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '  coupons.forEach((coupon) => {',
    '  coupons\n    .filter((coupon) => isCurrentOffer(coupon, restaurantId))\n    .forEach((coupon) => {',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '  couponPackages.forEach((couponPackage) => {',
    '  couponPackages\n    .filter((couponPackage) => isCurrentOffer(couponPackage, restaurantId))\n    .forEach((couponPackage) => {',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '  const { allPromotions, loading: promotionsLoading } = usePromotions();\n  const { allCoupons, allCouponPackages } = useCoupons();',
    '''  const {
    allPromotions,
    loading: promotionsLoading,
    error: promotionsError,
  } = usePromotions({
    restaurantId,
    activeOnly: true,
    showErrorBanner: false,
  });
  const { allCoupons, allCouponPackages } = useCoupons(restaurantId);''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    'setErrorMsg("Lên lịch gửi sau chưa có job queue thật, chỉ hỗ trợ gửi ngay.");',
    'setErrorMsg("Tính năng lên lịch gửi chưa sẵn sàng. Vui lòng chọn gửi ngay.");',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    'reason = err?.message || "Gửi thất bại";',
    '''reason = toUserFacingErrorMessage(
            err,
            "Chưa gửi được ưu đãi tới khách hàng này.",
          );''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    'setErrorMsg(err?.message || "Gửi chiến dịch thất bại.");',
    '''setErrorMsg(
        toUserFacingErrorMessage(
          err,
          "Chưa thể gửi chiến dịch. Vui lòng kiểm tra và thử lại.",
        ),
      );''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '<button className="pm-close-btn" onClick={onClose}>',
    '<button type="button" className="pm-close-btn" onClick={onClose} aria-label="Đóng cửa sổ gửi ưu đãi">',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '{promotionsLoading && <div className="pm-state">Đang tải ưu đãi từ database...</div>}',
    '{promotionsLoading && <div className="pm-state">Đang tải danh sách ưu đãi...</div>}',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '''{!promotionsLoading && offerOptions.length === 0 && (
                <div className="pm-state">Không có ưu đãi/coupon nào trong database.</div>
              )}''',
    '''{promotionsError && !promotionsLoading && (
                <div className="pm-state pm-state--error" role="alert">
                  Chưa thể tải ưu đãi của nhà hàng này. Vui lòng thử lại.
                </div>
              )}
              {!promotionsLoading && !promotionsError && offerOptions.length === 0 && (
                <div className="pm-state">Nhà hàng chưa có ưu đãi đang áp dụng.</div>
              )}''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '<span className={`promo-tag type-${offer.kind}`}>{offer.kind}</span>',
    '''<span className={`promo-tag type-${offer.kind}`}>
                      {OFFER_KIND_LABELS[offer.kind] || "Ưu đãi"}
                    </span>''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '{ id: "segment", label: "Theo segment", icon: <Zap size={14} /> },',
    '{ id: "segment", label: "Theo nhóm khách", icon: <Zap size={14} /> },',
)
sub_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    r'''<label>\s*<input\s*type="radio"\s*name="schedule"\s*value="later"\s*checked=\{scheduleType === "later"\}\s*onChange=\{\(e\) => setScheduleType\(e\.target\.value\)\}\s*/>\s*<div>Lên lịch gửi sau \(chưa hỗ trợ\)</div>\s*</label>''',
    '''<label className="is-disabled" title="Tính năng đang được hoàn thiện">
                    <input
                      type="radio"
                      name="schedule"
                      value="later"
                      checked={scheduleType === "later"}
                      onChange={(e) => setScheduleType(e.target.value)}
                      disabled
                    />
                    <div>Lên lịch gửi sau — chưa sẵn sàng</div>
                  </label>''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    '<h4>Lịch sử chiến dịch (DB - từ chat log)</h4>',
    '<h4>Lịch sử gửi ưu đãi</h4>',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/PromotionModal.jsx",
    'export default PromotionModal;',
    '''export const __testables = {
  buildOfferOptions,
  isCurrentOffer,
};

export default PromotionModal;''',
)
write(
    "src/components/Dashboard_Manager/Customer/PromotionModal.scope.test.jsx",
    '''import { describe, expect, it } from "vitest";
import { __testables } from "./PromotionModal";

describe("PromotionModal offer scope", () => {
  it("keeps only current offers from the selected restaurant", () => {
    const rows = __testables.buildOfferOptions(
      [
        { id: "p1", name: "Đang chạy", restaurantId: "r1", status: "active" },
        { id: "p2", name: "Hết hạn", restaurantId: "r1", status: "expired" },
      ],
      [
        { id: "c1", name: "Mã đúng", restaurantId: "r1", isActive: true },
        { id: "c2", name: "Sai nhà hàng", restaurantId: "r2", isActive: true },
      ],
      [],
      "r1",
    );
    expect(rows.map((row) => row.sourceId)).toEqual(["p1", "c1"]);
  });
});
''',
)

# Public reviews never expose technical backend messages or broken image icons.
replace_once(
    "src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.jsx",
    'import { AuthContext } from "@/context/AuthContext";\n',
    'import { AuthContext } from "@/context/AuthContext";\nimport { toUserFacingErrorMessage } from "@/utils/userFacingError";\n',
)
review_path = "src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.jsx"
review_text = read(review_path)
review_replacements = {
    'error?.message || "Không thể cập nhật tương tác đánh giá."': 'toUserFacingErrorMessage(error, "Không thể cập nhật tương tác đánh giá.")',
    'error?.message || "Không thể đánh dấu hữu ích."': 'toUserFacingErrorMessage(error, "Không thể đánh dấu hữu ích.")',
    'error?.message || "Không thể gửi báo cáo đánh giá."': 'toUserFacingErrorMessage(error, "Không thể gửi báo cáo đánh giá.")',
    'error?.message || "Không thể tải thêm đánh giá."': 'toUserFacingErrorMessage(error, "Không thể tải thêm đánh giá.")',
    'error?.message || "Không thể gửi đánh giá."': 'toUserFacingErrorMessage(error, "Không thể gửi đánh giá.")',
}
for old, new in review_replacements.items():
    if old not in review_text:
        raise RuntimeError(f"{review_path}: review error expression missing: {old}")
    review_text = review_text.replace(old, new)
review_text = review_text.replace(
    '<span>Không thể tải đánh giá: {reviewsError.message}</span>',
    '<span>Chưa thể tải đánh giá. Vui lòng thử lại.</span>',
)
if review_text == read(review_path):
    raise RuntimeError("ReviewsSection: no changes applied")
write(review_path, review_text)
# Add a safe visual fallback to both review image surfaces.
review_text = read(review_path)
needle = 'decoding="async"\n'
if review_text.count(needle) < 2:
    raise RuntimeError("ReviewsSection: expected at least two async images")
review_text = review_text.replace(
    needle,
    '''decoding="async"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = "/cohan_logo_icon.svg";
                          }}
''',
    2,
)
write(review_path, review_text)
replace_once(
    "src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.test.jsx",
    'expect((await screen.findAllByText("Lỗi GraphQL"))[0]).toBeInTheDocument();',
    '''expect(
      (await screen.findAllByText("Không thể gửi đánh giá."))[0],
    ).toBeInTheDocument();
    expect(screen.queryByText("Lỗi GraphQL")).not.toBeInTheDocument();''',
)

# Exact customer context for recent-order history.
replace_once(
    "src/components/Dashboard_Manager/Order/OrderManagement.jsx",
    '  const [showHistory, setShowHistory] = useState(false);\n',
    '''  const [showHistory, setShowHistory] = useState(false);
  const [historyCustomerContext, setHistoryCustomerContext] = useState({
    customerId: "",
    customerName: "",
  });
''',
)
sub_once(
    "src/components/Dashboard_Manager/Order/OrderManagement.jsx",
    r'''const openFromQuery = \(query = \{\}\) => \{\s*const orderId = String\(query\?\.orderId \|\| ""\)\.trim\(\);\s*const restaurantId = String\(query\?\.restaurantId \|\| ""\)\.trim\(\);\s*if \(!orderId\) return;\s*if \(\s*restaurantId &&\s*selectedRestaurantId &&\s*restaurantId !== String\(selectedRestaurantId\)\s*\) \{\s*return;\s*\}\s*void openOrderDetailById\(orderId\);\s*\};''',
    '''const openFromQuery = (query = {}) => {
      const orderId = String(query?.orderId || "").trim();
      const restaurantId = String(query?.restaurantId || "").trim();
      const customerId = String(query?.customerId || "").trim();
      const customerName = String(query?.customerName || "").trim();
      if (
        restaurantId &&
        selectedRestaurantId &&
        restaurantId !== String(selectedRestaurantId)
      ) {
        return;
      }
      if (!orderId && (customerId || customerName)) {
        setHistoryCustomerContext({ customerId, customerName });
        setShowHistory(true);
      }
      if (orderId) void openOrderDetailById(orderId);
    };''',
)
replace_once(
    "src/components/Dashboard_Manager/Order/OrderManagement.jsx",
    '''    openFromQuery({
      orderId: params.get("orderId"),
      restaurantId: params.get("restaurantId"),
    });''',
    '''    openFromQuery({
      orderId: params.get("orderId"),
      restaurantId: params.get("restaurantId"),
      customerId: params.get("customerId"),
      customerName: params.get("customerName"),
    });''',
)
replace_once(
    "src/components/Dashboard_Manager/Order/OrderManagement.jsx",
    '    params.delete("orderId");\n',
    '    params.delete("orderId");\n    params.delete("customerId");\n    params.delete("customerName");\n',
)
replace_once(
    "src/components/Dashboard_Manager/Order/OrderManagement.jsx",
    '  const refetchOrders = useCallback(\n',
    '''  const closeHistory = useCallback(() => {
    setShowHistory(false);
    setHistoryCustomerContext({ customerId: "", customerName: "" });
    const params = new URLSearchParams(window.location.search);
    params.delete("customerId");
    params.delete("customerName");
    const search = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, []);

  const refetchOrders = useCallback(
''',
)
replace_once(
    "src/components/Dashboard_Manager/Order/OrderManagement.jsx",
    '''          <HistoryModal
            restaurantId={selectedRestaurantId}
            onClose={() => setShowHistory(false)}
            onViewOrder={(order) => setSelectedOrder(order)}
          />''',
    '''          <HistoryModal
            restaurantId={selectedRestaurantId}
            customerId={historyCustomerContext.customerId}
            customerName={historyCustomerContext.customerName}
            onClose={closeHistory}
            onViewOrder={(order) => setSelectedOrder(order)}
          />''',
)
replace_once(
    "src/components/Dashboard_Manager/Order/components/HistoryModal.jsx",
    'import { formatDiscountReasonLabel } from "@/utils/discountDisplay";\n',
    'import { formatDiscountReasonLabel } from "@/utils/discountDisplay";\nimport { toUserFacingErrorMessage } from "@/utils/userFacingError";\n',
)
replace_once(
    "src/components/Dashboard_Manager/Order/components/HistoryModal.jsx",
    'const HistoryModal = ({ restaurantId, onClose, onViewOrder }) => {',
    '''const HistoryModal = ({
  restaurantId,
  customerId = "",
  customerName = "",
  onClose,
  onViewOrder,
}) => {''',
)
replace_once(
    "src/components/Dashboard_Manager/Order/components/HistoryModal.jsx",
    'setErrorMsg(err?.message || "Không tải được lịch sử đơn.");',
    '''setErrorMsg(
        toUserFacingErrorMessage(
          err,
          "Chưa thể tải lịch sử đơn. Vui lòng thử lại.",
        ),
      );''',
)
sub_once(
    "src/components/Dashboard_Manager/Order/components/HistoryModal.jsx",
    r'''const history = useMemo\(\(\) => \{.*?\}, \[allOrders, statusFilter\]\);\s*\n\s*const summary = useMemo\(\(\) => \{.*?return \{ served, completed, cancelled, total: allOrders\.length \};\s*\}, \[allOrders\]\);''',
    '''const customerOrders = useMemo(() => {
    const normalizedCustomerId = String(customerId || "").trim();
    const normalizedCustomerName = String(customerName || "")
      .trim()
      .toLocaleLowerCase("vi");
    if (!normalizedCustomerId && !normalizedCustomerName) return allOrders;
    return allOrders.filter((order) => {
      const orderCustomerId = String(order?.user?.id || "").trim();
      if (normalizedCustomerId && orderCustomerId === normalizedCustomerId) {
        return true;
      }
      const orderCustomerName = String(order?.user?.fullName || "")
        .trim()
        .toLocaleLowerCase("vi");
      return Boolean(
        !normalizedCustomerId &&
          normalizedCustomerName &&
          orderCustomerName === normalizedCustomerName,
      );
    });
  }, [allOrders, customerId, customerName]);

  const history = useMemo(() => {
    if (statusFilter === "all") return customerOrders;
    return customerOrders.filter((o) => o.currentStatus === statusFilter);
  }, [customerOrders, statusFilter]);

  const summary = useMemo(() => {
    const served = customerOrders.filter((o) => o.currentStatus === "served").length;
    const completed = customerOrders.filter(
      (o) => o.currentStatus === "completed",
    ).length;
    const cancelled = customerOrders.filter(
      (o) => o.currentStatus === "cancelled",
    ).length;
    return { served, completed, cancelled, total: customerOrders.length };
  }, [customerOrders]);''',
)
replace_once(
    "src/components/Dashboard_Manager/Order/components/HistoryModal.jsx",
    '''              <p className="hm-header__subtitle">
                Xem lại các đơn đã hoàn thành hoặc hủy
              </p>''',
    '''              <p className="hm-header__subtitle">
                {customerName
                  ? `Đơn hàng của ${customerName}`
                  : "Xem lại các đơn đã hoàn thành hoặc hủy"}
              </p>''',
)
insert_before_last(
    "src/components/Dashboard_Manager/Order/components/HistoryModal.test.jsx",
    "});",
    '''
  it("filters history by the exact customer id", async () => {
    loadOrdersAll.mockResolvedValueOnce({
      data: {
        ordersByRestaurant: {
          edges: [
            {
              node: {
                id: "order-a",
                orderCode: "POS-A",
                currentStatus: "completed",
                user: { id: "customer-a", fullName: "Nguyễn An" },
                items: [],
                totals: { grandTotal: 100000 },
              },
            },
            {
              node: {
                id: "order-b",
                orderCode: "POS-B",
                currentStatus: "completed",
                user: { id: "customer-b", fullName: "Nguyễn An" },
                items: [],
                totals: { grandTotal: 120000 },
              },
            },
          ],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    });
    render(
      <HistoryModal
        restaurantId="restaurant-1"
        customerId="customer-a"
        customerName="Nguyễn An"
        onClose={vi.fn()}
        onViewOrder={vi.fn()}
      />,
    );
    expect(await screen.findByText("#POS-A")).toBeInTheDocument();
    expect(screen.queryByText("#POS-B")).not.toBeInTheDocument();
    expect(screen.getByText("Đơn hàng của Nguyễn An")).toBeInTheDocument();
  });
''',
)

# Customer analytics actions move to actual data and exact customer searches.
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerManagement.jsx",
    '  const [searchDebounced, setSearchDebounced] = useState("");\n',
    '''  const [searchDebounced, setSearchDebounced] = useState("");

  useEffect(() => {
    const applyNavigationSearch = (query = {}) => {
      const value = String(query?.search || query?.customerName || "").trim();
      if (value) setSearchQuery(value);
    };
    const params = new URLSearchParams(window.location.search);
    applyNavigationSearch({
      search: params.get("search"),
      customerName: params.get("customerName"),
    });
    const handleNavigation = (event) => {
      if (event?.detail?.page !== "customers") return;
      applyNavigationSearch(event.detail.query);
    };
    window.addEventListener("manager:navigation-query", handleNavigation);
    return () =>
      window.removeEventListener("manager:navigation-query", handleNavigation);
  }, []);
''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    'const navigateManagerPage = (page, query = {}) => {',
    '''export const scrollToCustomerInsight = (targetId) => {
  if (typeof document === "undefined") return false;
  const target = document.getElementById(targetId);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus?.({ preventScroll: true });
  return true;
};

const navigateManagerPage = (page, query = {}) => {''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    'onClick: () => navigateManagerPage("customers", { segment: "dormant" }),',
    'onClick: () => scrollToCustomerInsight("customer-insight-dormant"),',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    'onClick: () => navigateManagerPage("customers", { segment: "high-value" }),',
    'onClick: () => scrollToCustomerInsight("customer-insight-high-value"),',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    '''            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Khách lâu chưa quay lại</h3>''',
    '''            <section
              id="customer-insight-dormant"
              className="customer-panel"
              tabIndex={-1}
            >
              <div className="customer-panel__head">
                <div>
                  <h3>Khách lâu chưa quay lại</h3>''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    'onClick={() => navigateManagerPage("customers", { segment: "dormant" })}',
    'onClick={() => navigateManagerPage("customers")}',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    'onClick={() => navigateManagerPage("customers", { customerId: customer?.userId })}',
    '''onClick={() =>
                              navigateManagerPage("customers", {
                                search: customer?.fullName || customer?.phone || "",
                                customerName: customer?.fullName || "",
                              })
                            }''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    '''            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Khách giá trị cao</h3>''',
    '''            <section
              id="customer-insight-high-value"
              className="customer-panel"
              tabIndex={-1}
            >
              <div className="customer-panel__head">
                <div>
                  <h3>Khách giá trị cao</h3>''',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    'onClick={() => navigateManagerPage("customers", { segment: "high-value" })}',
    'onClick={() => navigateManagerPage("customers")}',
)
replace_once(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.jsx",
    'onClick={() => navigateManagerPage("orders", { customerId: customer?.userId })}',
    '''onClick={() =>
                              navigateManagerPage("orders", {
                                customerId: customer?.userId,
                                customerName: customer?.fullName || "",
                                restaurantId: effectiveRestaurantId,
                              })
                            }''',
)
write(
    "src/components/Dashboard_Manager/Customer/CustomerAnalyticsPage.navigation.test.jsx",
    '''import { describe, expect, it, vi } from "vitest";
import { scrollToCustomerInsight } from "./CustomerAnalyticsPage";

describe("Customer analytics actions", () => {
  it("moves to the exact cohort panel", () => {
    const target = document.createElement("section");
    target.id = "customer-insight-dormant";
    target.scrollIntoView = vi.fn();
    target.focus = vi.fn();
    document.body.appendChild(target);
    expect(scrollToCustomerInsight(target.id)).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    target.remove();
  });
});
''',
)

Path(".trellis/tasks/07-13-report-pages-16-20").mkdir(parents=True, exist_ok=True)
write(
    ".trellis/tasks/07-13-report-pages-16-20/prd.md",
    '''# Report pages 16–20

## Scope
- Customer creation and guest synchronization.
- Customer analytics actions and exact customer/order navigation.
- Promotion recipient/restaurant scoping and plain Vietnamese copy.
- Review error privacy and broken-image resilience.
- Remaining customer-history and technical-alert findings from quality review.

## Acceptance
- Guest creation returns the authoritative record to the list refresh path.
- Registered account status remains backend-controlled.
- Raw GraphQL/Apollo/internal identifiers never reach customer-facing errors.
- Customer recent-order and analytics actions open the correct customer context.
- Promotion offers cannot cross restaurant scope and unsupported scheduling cannot be selected.
''',
)

print("report pages 16-20 patch applied")
