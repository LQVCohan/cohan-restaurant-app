const ACTION_LABELS = {
  "auth.login": "Đăng nhập vào hệ thống",
  "auth.logout": "Đăng xuất khỏi hệ thống",
  "review.create": "Khách hàng gửi đánh giá",
  "review.update": "Cập nhật đánh giá",
  "review.delete": "Xóa đánh giá",
  "review.react": "Bày tỏ cảm xúc với đánh giá",
  "review.helpful": "Đánh dấu đánh giá hữu ích",
  "review.unhelpful": "Bỏ đánh dấu đánh giá hữu ích",
  "review.comment.create": "Phản hồi đánh giá",
  "review.comment.update": "Cập nhật phản hồi đánh giá",
  "review.comment.delete": "Xóa phản hồi đánh giá",
  "order.create": "Tạo đơn hàng",
  "order.update": "Cập nhật đơn hàng",
  "order.cancel": "Hủy đơn hàng",
  "order.complete": "Hoàn tất đơn hàng",
  "order.item.add": "Thêm món vào đơn hàng",
  "order.item.update": "Cập nhật món trong đơn hàng",
  "order.item.cancel": "Hủy món trong đơn hàng",
  "payment.create": "Khởi tạo thanh toán",
  "payment.complete": "Hoàn tất thanh toán",
  "payment.refund": "Hoàn tiền thanh toán",
  "payment.fail": "Thanh toán không thành công",
  "reservation.create": "Tạo lượt đặt bàn",
  "reservation.update": "Cập nhật lượt đặt bàn",
  "reservation.checkin": "Xác nhận khách đã đến",
  "reservation.cancel": "Hủy lượt đặt bàn",
  "table.create": "Tạo bàn mới",
  "table.update": "Cập nhật thông tin bàn",
  "table.delete": "Xóa bàn",
  "table.merge": "Ghép bàn",
  "table.unmerge": "Tách bàn",
  "table.vr.generate": "Tạo ảnh 360° cho bàn",
  "table.vr.upload": "Tải ảnh 360° cho bàn",
  "staff.create": "Thêm nhân viên",
  "staff.update": "Cập nhật nhân viên",
  "staff.delete": "Xóa nhân viên",
  "schedule.create": "Tạo lịch làm việc",
  "schedule.update": "Cập nhật lịch làm việc",
  "schedule.delete": "Xóa lịch làm việc",
};

const SUBJECT_LABELS = {
  audit: "thay đổi quản trị",
  event: "hoạt động vận hành",
  auth: "tài khoản",
  review: "đánh giá",
  "review.comment": "phản hồi đánh giá",
  restaurant: "nhà hàng",
  floor: "khu vực phục vụ",
  table: "bàn",
  "table.vr": "ảnh 360° của bàn",
  order: "đơn hàng",
  "order.item": "món trong đơn hàng",
  payment: "thanh toán",
  reservation: "lượt đặt bàn",
  menu: "thực đơn",
  dish: "món ăn",
  category: "danh mục",
  inventory: "kho",
  "inventory.ingredient": "nguyên liệu trong kho",
  ingredient: "nguyên liệu",
  staff: "nhân viên",
  shift: "ca làm việc",
  schedule: "lịch làm việc",
  payroll: "bảng lương",
  customer: "khách hàng",
  role: "vai trò",
  permission: "quyền truy cập",
  source: "nguồn hoạt động",
  system: "hệ thống",
};

const VERB_LABELS = {
  create: "Tạo",
  add: "Thêm",
  update: "Cập nhật",
  edit: "Chỉnh sửa",
  delete: "Xóa",
  remove: "Gỡ",
  cancel: "Hủy",
  complete: "Hoàn tất",
  approve: "Duyệt",
  reject: "Từ chối",
  react: "Bày tỏ cảm xúc với",
  helpful: "Đánh dấu hữu ích cho",
  unhelpful: "Bỏ đánh dấu hữu ích cho",
  generate: "Tạo",
  upload: "Tải lên",
  download: "Tải xuống",
  view: "Xem",
  open: "Mở",
  close: "Đóng",
  login: "Đăng nhập",
  logout: "Đăng xuất",
  merge: "Ghép",
  unmerge: "Tách",
  checkin: "Xác nhận khách đã đến cho",
  checkout: "Hoàn tất phục vụ cho",
  refund: "Hoàn tiền cho",
  fail: "Không thực hiện được",
};

const OBJECT_LABELS = {
  review: "Đánh giá",
  restaurant: "Nhà hàng",
  floor: "Khu vực",
  table: "Bàn",
  order: "Đơn hàng",
  payment: "Thanh toán",
  reservation: "Đặt bàn",
  menu: "Thực đơn",
  dish: "Món ăn",
  category: "Danh mục",
  inventory: "Kho",
  ingredient: "Nguyên liệu",
  staff: "Nhân viên",
  user: "Người dùng",
  customer: "Khách hàng",
  customerprofile: "Khách hàng",
  shift: "Ca làm việc",
  schedule: "Lịch làm việc",
  payroll: "Bảng lương",
  role: "Vai trò",
  permission: "Quyền truy cập",
};

const ROLE_LABELS = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  owner: "Chủ nhà hàng",
  cashier: "Thu ngân",
  waiter: "Nhân viên phục vụ",
  kitchen: "Nhân viên bếp",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

const STATUS_LABELS = {
  audit: "Đã ghi nhận",
  info: "Đã ghi nhận",
  success: "Thành công",
  completed: "Hoàn tất",
  complete: "Hoàn tất",
  pending: "Đang chờ",
  processing: "Đang xử lý",
  failed: "Không thành công",
  fail: "Không thành công",
  error: "Có lỗi",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
};

const DETAIL_LABELS = {
  before: "Trước khi thay đổi",
  after: "Sau khi thay đổi",
  diff: "Nội dung thay đổi",
  metadata: "Thông tin bổ sung",
  meta: "Thông tin bổ sung",
  ip: "Địa chỉ truy cập",
  userAgent: "Thiết bị và trình duyệt",
  correlationId: "Mã liên kết xử lý",
  sessionId: "Mã phiên làm việc",
};

const DATA_KEY_LABELS = {
  id: "Mã",
  code: "Mã hiển thị",
  name: "Tên",
  title: "Tiêu đề",
  status: "Trạng thái",
  action: "Hành động",
  restaurantId: "Nhà hàng",
  floorId: "Khu vực",
  tableId: "Bàn",
  orderId: "Đơn hàng",
  reviewId: "Đánh giá",
  userId: "Người dùng",
  staffId: "Nhân viên",
  customerId: "Khách hàng",
  customerProfileId: "Khách hàng",
  paymentId: "Thanh toán",
  reservationId: "Đặt bàn",
  emoji: "Cảm xúc",
  reaction: "Cảm xúc",
  helpful: "Hữu ích",
  isHelpful: "Được đánh dấu hữu ích",
  reason: "Lý do",
  note: "Ghi chú",
  quantity: "Số lượng",
  amount: "Số tiền",
  total: "Tổng tiền",
  createdAt: "Thời điểm tạo",
  updatedAt: "Thời điểm cập nhật",
};

const isPresent = (value) => {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

const capitalize = (value) => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";
const normalizeToken = (value) => String(value || "").trim().toLowerCase();

const normalizeTimestamp = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const text = String(value || "").trim();
  if (/^\d{10}$/.test(text)) return new Date(Number(text) * 1000);
  if (/^\d{13}$/.test(text)) return new Date(Number(text));
  if (/^\d{16}$/.test(text)) return new Date(Math.floor(Number(text) / 1000));
  return new Date(text);
};

export const formatDateTimeParts = (value) => {
  if (!value) return { date: "--", time: "", full: "Chưa xác định thời gian" };

  const parsed = normalizeTimestamp(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: String(value), time: "", full: String(value) };
  }

  const date = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);

  return { date, time, full: `${date} lúc ${time}` };
};

export const shortenIdentifier = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 10) return text;
  return `…${text.slice(-6)}`;
};

export const humanizeAction = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Hoạt động hệ thống";

  const normalized = raw.toLowerCase();
  if (ACTION_LABELS[normalized]) return ACTION_LABELS[normalized];

  const tokens = normalized.split(/[._:/-]+/).filter(Boolean);
  if (tokens.length === 1) {
    return VERB_LABELS[tokens[0]] || capitalize(raw.replace(/[_-]+/g, " "));
  }

  const actionToken = tokens[tokens.length - 1];
  const subjectKey = tokens.slice(0, -1).join(".");
  const subject = SUBJECT_LABELS[subjectKey]
    || SUBJECT_LABELS[tokens[0]]
    || tokens.slice(0, -1).join(" ");
  const verb = VERB_LABELS[actionToken] || "Ghi nhận thay đổi về";

  return `${verb} ${subject}`.replace(/\s+/g, " ").trim();
};

export const humanizeScope = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Hoạt động trong hệ thống";

  const normalized = raw.toLowerCase();
  if (SUBJECT_LABELS[normalized]) return capitalize(SUBJECT_LABELS[normalized]);

  const tokens = normalized.split(/[._:/-]+/).filter(Boolean);
  const translated = tokens.map((token) => SUBJECT_LABELS[token] || token).join(" · ");
  return capitalize(translated);
};

export const formatStatus = (value) => {
  const normalized = normalizeToken(value);
  if (!normalized) return "Đã ghi nhận";
  return STATUS_LABELS[normalized] || capitalize(String(value).replace(/[_-]+/g, " "));
};

export const formatActor = ({
  actorName,
  actorRole,
  byUserId,
  actorId,
  actorUserId,
  customerProfileId,
} = {}) => {
  if (actorName) return String(actorName);

  const role = ROLE_LABELS[normalizeToken(actorRole)];
  const userId = actorUserId || byUserId || actorId;
  if (role && userId) return `${role} · mã ${shortenIdentifier(userId)}`;
  if (role) return role;
  if (customerProfileId) return `Khách hàng · mã ${shortenIdentifier(customerProfileId)}`;
  if (userId) return `Nhân viên · mã ${shortenIdentifier(userId)}`;
  return "Hệ thống tự động";
};

export const formatObjectReference = ({ kind, id, code, name } = {}) => {
  if (name) return String(name);

  const normalizedKind = normalizeToken(kind).replace(/[._-]+/g, "");
  const label = OBJECT_LABELS[normalizedKind] || humanizeScope(kind || "đối tượng");
  const reference = code || shortenIdentifier(id);
  return reference ? `${label} · ${reference}` : label;
};

export const formatAuditTarget = (log = {}) => {
  if (log.targetName) return String(log.targetName);
  return formatObjectReference({
    kind: log.targetType || log.entity,
    id: log.targetId || log.entityId,
  });
};

export const humanizeDataKey = (key) => {
  if (DATA_KEY_LABELS[key]) return DATA_KEY_LABELS[key];
  const readable = String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return capitalize(readable || "Thông tin");
};

const translateData = (value) => {
  if (Array.isArray(value)) return value.map(translateData);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [humanizeDataKey(key), translateData(item)]),
  );
};

export const formatDetailValue = (value) => {
  if (!isPresent(value)) return "--";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(translateData(value), null, 2);
  } catch {
    return String(value);
  }
};

export const buildDetailGroups = (detail = {}) => {
  const visibleKeys = ["before", "after", "diff", "metadata", "meta", "ip", "userAgent"];
  const technicalKeys = ["correlationId", "sessionId"];

  const toItem = (key) => ({
    key,
    label: DETAIL_LABELS[key] || humanizeDataKey(key),
    value: formatDetailValue(detail[key]),
  });

  return {
    visible: visibleKeys.filter((key) => isPresent(detail[key])).map(toItem),
    technical: technicalKeys.filter((key) => isPresent(detail[key])).map(toItem),
  };
};

export const buildSearchText = (...values) => values
  .filter((value) => value !== null && value !== undefined)
  .map((value) => typeof value === "string" ? value : formatDetailValue(value))
  .join(" ")
  .toLowerCase();

export const matchesFriendlySearch = (entry, search) => {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  return String(entry.searchText || "").includes(query);
};
