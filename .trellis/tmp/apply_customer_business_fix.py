from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, content):
    (ROOT / path).write_text(content, encoding='utf-8')

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise RuntimeError(f'Expected text not found in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    write(path, text)

def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'Expected one regex match in {path}, got {count}: {pattern[:120]!r}')
    write(path, updated)

# ---------------- GraphQL contracts ----------------
path = 'cohan-restaurant-backend/graphql/schema/user.graphql'
replace_once(path,
'''    customerRank: CustomerRankFilterInput
    sortBy: CustomerSortBy = CREATED_AT''',
'''    customerRank: CustomerRankFilterInput
    activityStatuses: [String!]
    sortBy: CustomerSortBy = CREATED_AT''')
replace_once(path,
'''  customerRankSettings(restaurantId: ID!): CustomerRankSettings!
  roleList''',
'''  customerRankSettings(restaurantId: ID!): CustomerRankSettings!
  customerNote(restaurantId: ID!, userId: ID!): String!
  roleList''')
replace_once(path,
'''  customerType: CustomerType
  captchaToken: String

  userType''',
'''  customerType: CustomerType
  captchaToken: String
  restaurantId: ID

  userType''')

path = 'cohan-restaurant-backend/graphql/schema/index.js'
replace_once(path,
'''  createGuestUser(fullName: String, phone: String, expiresInDays: Int): User''',
'''  createGuestUser(fullName: String, phone: String, expiresInDays: Int, restaurantId: ID!): User''')

# ---------------- Customer model ----------------
path = 'cohan-restaurant-backend/models/customer.model.js'
replace_once(path,
'''const customerSchema = new mongoose.Schema(''',
'''const customerNoteSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    noteInternal: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const customerSchema = new mongoose.Schema(''')
replace_once(path,
'''    archivedRestaurants: {
      type: [archivedRestaurantSchema],
      default: [],
    },
    foodPreferences:''',
'''    archivedRestaurants: {
      type: [archivedRestaurantSchema],
      default: [],
    },
    customerNotes: {
      type: [customerNoteSchema],
      default: [],
    },
    foodPreferences:''')
replace_once(path,
'''customerSchema.index({ customerRestaurants: 1 });''',
'''customerSchema.index({ customerRestaurants: 1 });
customerSchema.index({ "customerNotes.restaurantId": 1 });''')

# ---------------- User mutations ----------------
path = 'cohan-restaurant-backend/graphql/resolvers/user/mutation.js'
replace_once(path,
'''      customerType,
      captchaToken,
    } = input;

    if (!fullName?.trim()) {''',
'''      customerType,
      captchaToken,
      restaurantId,
    } = input;

    const isManagedCustomerCreate = Boolean(restaurantId);
    let managedRestaurantObjectId = null;
    if (isManagedCustomerCreate) {
      requireRole(ctx?.user, ["admin", "manager"]);
      await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);
      if (!mongoose.isValidObjectId(restaurantId)) {
        throw new GraphQLError("Invalid restaurantId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await requireRestaurantAccess(ctx, restaurantId);
      managedRestaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
    }

    if (!fullName?.trim()) {''')
replace_once(path,
'''    if (recaptchaEnabled) {
      const recaptcha = await verifyRecaptcha(captchaToken, ctx);''',
'''    if (recaptchaEnabled && !isManagedCustomerCreate) {
      const recaptcha = await verifyRecaptcha(captchaToken, ctx);''')
replace_once(path,
'''    if (shouldRequireVerification) {
      try {''',
'''    if (managedRestaurantObjectId) {
      const membershipIds = (doc.customerRestaurants || []).map(String);
      if (!membershipIds.includes(String(managedRestaurantObjectId))) {
        doc.customerRestaurants = [
          ...(doc.customerRestaurants || []),
          managedRestaurantObjectId,
        ];
      }
      const recentIds = (doc.refRestaurants || [])
        .map(String)
        .filter((id) => id !== String(managedRestaurantObjectId));
      doc.refRestaurants = [
        managedRestaurantObjectId,
        ...recentIds.slice(0, 11).map((id) => new mongoose.Types.ObjectId(id)),
      ];
      await doc.save();
    }

    if (shouldRequireVerification) {
      try {''')
regex_once(path,
    r'''  async createGuestUser\(_, \{ fullName, phone, expiresInDays = 30 \}, \{ user \}\) \{.*?\n  \},\n\n  // === Admin update user ===''',
'''  async createGuestUser(
    _,
    { fullName, phone, expiresInDays = 30, restaurantId },
    ctx,
  ) {
    requireRole(ctx?.user, ["admin", "manager"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    await requireRestaurantAccess(ctx, restaurantId);

    const normalizedPhone = phone ? normalizePhone(phone) : undefined;
    if (normalizedPhone) {
      const existing = await Customer.findOne({
        phone: normalizedPhone,
        deletedAt: null,
      }).lean();
      if (existing) {
        throw new GraphQLError("Phone already in use", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    const rid = new mongoose.Types.ObjectId(restaurantId);
    const doc = new Customer({
      fullName: (fullName || "Guest").trim(),
      phone: normalizedPhone,
      status: "active",
      isGuest: true,
      guestExpiresAt: dayjs().add(expiresInDays, "day").toDate(),
      customerType: "NEW",
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpending: 0,
      customerRestaurants: [rid],
      refRestaurants: [rid],
    });

    await doc.save();
    const saved = await User.findById(doc._id)
      .populate("role")
      .lean({ virtuals: true });
    return sanitizeUserForClient(saved);
  },

  // === Admin update user ===''',
    flags=re.S,
)
regex_once(path,
    r'''    customer\.noteInternal =\n      typeof noteInternal === "string" \? noteInternal\.trim\(\) : "";\n    await customer\.save\(\);''',
'''    const normalizedNote =
      typeof noteInternal === "string" ? noteInternal.trim() : "";
    const noteIndex = (customer.customerNotes || []).findIndex(
      (entry) => String(entry?.restaurantId || "") === String(rid),
    );
    const noteEntry = {
      restaurantId: rid,
      noteInternal: normalizedNote,
      updatedAt: new Date(),
      updatedBy: ctx?.user?.id
        ? new mongoose.Types.ObjectId(ctx.user.id)
        : undefined,
    };
    if (noteIndex >= 0) customer.customerNotes[noteIndex] = noteEntry;
    else customer.customerNotes.push(noteEntry);
    await customer.save();''')
replace_once(path,
'''    if (!normalizedRanks.length) {
      throw new GraphQLError("Ranks cannot be empty", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    normalizedRanks.sort''',
'''    if (!normalizedRanks.length) {
      throw new GraphQLError("Ranks cannot be empty", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const normalizedNames = normalizedRanks.map((rank) => rank.name.toLowerCase());
    const thresholds = normalizedRanks.map((rank) => rank.minPoints);
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new GraphQLError("Rank names must be unique", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (new Set(thresholds).size !== thresholds.length) {
      throw new GraphQLError("Rank thresholds must be unique", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (!thresholds.includes(0)) {
      throw new GraphQLError("The lowest rank must start at 0 points", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    normalizedRanks.sort''')

# ---------------- User queries ----------------
path = 'cohan-restaurant-backend/graphql/resolvers/user/query.js'
regex_once(path,
    r'''function buildSearchCond\(search\) \{.*?\n\}''',
'''function buildSearchCond(search) {
  if (!search || !search.trim()) return null;
  const q = search.trim();
  const clauses = [
    { fullName: new RegExp(q, "i") },
    { email: new RegExp(q, "i") },
    { phone: new RegExp(q, "i") },
    { username: new RegExp(q, "i") },
  ];
  if (mongoose.isValidObjectId(q)) clauses.push({ _id: toObjectId(q) });
  return { $or: clauses };
}''',
    flags=re.S,
)
replace_once(path,
'''  customerRoleId = null,
  customerRank = null,
}) {''',
'''  customerRoleId = null,
  customerRank = null,
  activityStatuses = null,
}) {''')
replace_once(path,
'''  const clauses = [activeCond, restaurantScopeCond, kindClause, searchCond, ...rankClauses].filter(Boolean);''',
'''  const normalizedStatuses = new Set(
    (Array.isArray(activityStatuses) ? activityStatuses : [])
      .map((status) => String(status || "").toLowerCase())
      .filter((status) => ["online", "offline"].includes(status)),
  );
  let activityClause = null;
  if (normalizedStatuses.size === 1 && normalizedStatuses.has("online")) {
    activityClause = { isOnline: true };
  } else if (normalizedStatuses.size === 1 && normalizedStatuses.has("offline")) {
    activityClause = { $or: [{ isOnline: false }, { isOnline: { $exists: false } }] };
  } else if (Array.isArray(activityStatuses) && normalizedStatuses.size === 0) {
    return { finalCond: { _id: { $exists: false } }, empty: true };
  }
  const clauses = [
    activeCond,
    restaurantScopeCond,
    kindClause,
    searchCond,
    activityClause,
    ...rankClauses,
  ].filter(Boolean);''')
replace_once(path,
'''      customerRank,
      sortBy = "CREATED_AT",''',
'''      customerRank,
      activityStatuses,
      sortBy = "CREATED_AT",''')
replace_once(path,
'''      restaurantId, search, includeGuests, customerKind, customerRoleId: customerRole?._id, customerRank,
    });''',
'''      restaurantId,
      search,
      includeGuests,
      customerKind,
      customerRoleId: customerRole?._id,
      customerRank,
      activityStatuses,
    });''')
replace_once(path,
'''  async customerDetailAnalytics(_, { userId, restaurantId }, ctx) {''',
'''  async customerNote(_, { userId, restaurantId }, ctx) {
    requireRole(ctx?.user, ["admin", "manager", "staff"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_READ);
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid customer note scope", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    await requireRestaurantAccess(ctx, restaurantId);
    const customer = await Customer.findOne({
      _id: toObjectId(userId),
      customerRestaurants: { $in: [toObjectId(restaurantId)] },
      deletedAt: null,
    })
      .select("customerNotes noteInternal")
      .lean();
    if (!customer) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    const scopedNote = (customer.customerNotes || []).find(
      (entry) => String(entry?.restaurantId || "") === String(restaurantId),
    );
    return scopedNote?.noteInternal || customer.noteInternal || "";
  },

  async customerDetailAnalytics(_, { userId, restaurantId }, ctx) {''')
replace_once(path,
'''    const orders = await Order.find(cond)
      .sort({ createdAt: -1 })''',
'''    const orders = await Order.find({
      ...cond,
      currentStatus: { $nin: ["cancelled", "failed", "draft"] },
    })
      .sort({ createdAt: -1 })''')
replace_once(path,
'''    const orders = await Order.find({
      restaurantId: rid,
      userId: { $in: validUserIds },
    })''',
'''    const orders = await Order.find({
      restaurantId: rid,
      userId: { $in: validUserIds },
      currentStatus: { $nin: ["cancelled", "failed", "draft"] },
    })''')
replace_once(path,
'''      const grandTotal = Number(o?.totals?.grandTotal || 0);''',
'''      const paymentStatus = String(
        o?.payment?.status || o?.orderPaymentStatus || "",
      ).toLowerCase();
      const grandTotal =
        paymentStatus === "refunded"
          ? 0
          : Number(o?.totals?.grandTotal || 0);''')

# ---------------- Archive permissions ----------------
path = 'cohan-restaurant-backend/graphql/resolvers/user/customerArchive.js'
replace_once(path,
'''  requireRole(ctx?.user, ["admin"]);
  await requirePermission(ctx, PERMISSIONS.CUSTOMER_READ);''',
'''  requireRole(ctx?.user, ["admin", "manager"]);
  await requirePermission(ctx, PERMISSIONS.CUSTOMER_READ);''')
replace_once(path,
'''  requireRole(ctx?.user, ["admin"]);
  await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);''',
'''  requireRole(ctx?.user, ["admin", "manager"]);
  await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);''')

# ---------------- Frontend user hook ----------------
path = 'src/hooks/useUserManagement.js'
replace_once(path,
'''    $customerRank: CustomerRankFilterInput
    $sortBy: CustomerSortBy''',
'''    $customerRank: CustomerRankFilterInput
    $activityStatuses: [String!]
    $sortBy: CustomerSortBy''')
replace_once(path,
'''      customerRank: $customerRank
      sortBy: $sortBy''',
'''      customerRank: $customerRank
      activityStatuses: $activityStatuses
      sortBy: $sortBy''')
replace_once(path,
'''        totalSpending
        emailVerified''',
'''        totalSpending
        wallet { status provider currency balance }
        emailVerified''')
replace_once(path,
'''    $expiresInDays: Int
  ) {''',
'''    $expiresInDays: Int
    $restaurantId: ID!
  ) {''')
replace_once(path,
'''      expiresInDays: $expiresInDays
    ) {''',
'''      expiresInDays: $expiresInDays
      restaurantId: $restaurantId
    ) {''')
replace_once(path,
'''const statusToCardStatus = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "active") return "online";
  if (s === "pending") return "away";
  return "offline";
};''',
'''const statusToCardStatus = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "pending") return "away";
  return "offline";
};''')
replace_once(path,
'''      noteInternal: u.noteInternal || "",
      isGuest: !!u.isGuest,''',
'''      noteInternal: u.noteInternal || "",
      wallet: u.wallet || null,
      isGuest: !!u.isGuest,''')
replace_once(path,
'''    restaurantId, search, includeGuests = true, customerKind = "ALL", customerRank, sortBy = "CREATED_AT", sortDirection = "DESC", limit = 30, cursor, append = false,
  } = {}) => {
    const variables = { restaurantId, search: typeof search === "string" ? search : undefined, includeGuests, customerKind, customerRank, sortBy, sortDirection, limit, cursor };''',
'''    restaurantId, search, includeGuests = true, customerKind = "ALL", customerRank, activityStatuses, sortBy = "CREATED_AT", sortDirection = "DESC", limit = 30, cursor, append = false,
  } = {}) => {
    const variables = { restaurantId, search: typeof search === "string" ? search : undefined, includeGuests, customerKind, customerRank, activityStatuses, sortBy, sortDirection, limit, cursor };''')
replace_once(path,
'''    phone,
    expiresInDays = 30,
  }) => {
    const result = await createGuestMut({
      variables: { fullName, phone, expiresInDays },''',
'''    phone,
    expiresInDays = 30,
    restaurantId,
  }) => {
    const result = await createGuestMut({
      variables: { fullName, phone, expiresInDays, restaurantId },''')

# ---------------- Add customer modal ----------------
path = 'src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx'
regex_once(path,
    r'''/\* ===== Map VN label -> enum BE ===== \*/\nconst VN_TO_ENUM = \(v\) => \{.*?\n\};\n\n''',
    '',
    flags=re.S,
)
replace_once(path,
'''const AddCustomerModal = ({ onClose, onCreated }) => {''',
'''const AddCustomerModal = ({ onClose, onCreated, restaurantId }) => {''')
replace_once(path,
'''    customerTypeVN: "Mới",
    addressDetail:''',
'''    addressDetail:''')
replace_once(path,
'''          expiresInDays: 30,
        });''',
'''          expiresInDays: 30,
          restaurantId,
        });''')
replace_once(path,
'''        customerType: VN_TO_ENUM(form.customerTypeVN),
        roleSlug: "customer",''',
'''        customerType: "NEW",
        restaurantId,
        roleSlug: "customer",''')
regex_once(path,
    r'''\n            <Section title="Phân loại khách hàng">.*?</Section>\n''',
'''\n            <Section title="Phân loại khách hàng">
              <p className="text-sm text-slate-600">
                Hạng khách được hệ thống tự động xác định theo điểm và ngưỡng của
                nhà hàng. Khách mới bắt đầu từ hạng thấp nhất.
              </p>
            </Section>
''',
    flags=re.S,
)

# ---------------- Customer management ----------------
path = 'src/components/Dashboard_Manager/Customer/CustomerManagement.jsx'
replace_once(path,
'''  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showExportModal''',
'''  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [campaignCustomers, setCampaignCustomers] = useState([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [showExportModal''')
replace_once(path,
'''  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery''',
'''  const [activeFilter, setActiveFilter] = useState("all");
  const [activeStatuses, setActiveStatuses] = useState(["online", "offline"]);
  const [searchQuery''')
replace_once(path,
'''        customerRank: customerRankFilter,
        limit: pageSize,''',
'''        customerRank: customerRankFilter,
        activityStatuses: activeStatuses,
        limit: pageSize,''')
replace_once(path,
'''      customerRankFilter,
      getCustomersPage,''',
'''      customerRankFilter,
      activeStatuses,
      getCustomersPage,''')
replace_once(path,
'''  const handleFilter = (filterKey) => {
    if (typeof filterKey === "object" && filterKey?.category) {
      filterKey = filterKey.category;
    }
    setActiveFilter(filterKey);
  };''',
'''  const handleFilter = (filterValue) => {
    if (typeof filterValue === "object" && filterValue?.category) {
      setActiveFilter(filterValue.category);
      const statuses = Object.entries(filterValue.status || {})
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => key)
        .filter((key) => ["online", "offline"].includes(key));
      setActiveStatuses(statuses);
      return;
    }
    setActiveFilter(filterValue);
  };

  const handleOpenPromotionModal = async () => {
    if (!selectedRestaurantId || campaignLoading) return;
    setCampaignLoading(true);
    try {
      const rows = await getCustomerExportRows({
        restaurantId: selectedRestaurantId,
        includeGuests: true,
        limit: 2000,
        sortBy: "CREATED_AT",
        sortDirection: "DESC",
      });
      setCampaignCustomers(rows);
      setShowPromotionModal(true);
    } catch (error) {
      console.error("Load campaign recipients failed", error);
      setCampaignCustomers(customersVisible || []);
      setShowPromotionModal(true);
    } finally {
      setCampaignLoading(false);
    }
  };''')
replace_once(path,
'''    setActiveFilter("all");
    setSelectedCustomer''',
'''    setActiveFilter("all");
    setActiveStatuses(["online", "offline"]);
    setSelectedCustomer''')
replace_once(path,
'''      label: "Đang hoạt động",''',
'''      label: "Hoạt động (trang)",''')
replace_once(path,
'''      label: "Khách VIP",''',
'''      label: "VIP (trang)",''')
replace_once(path,
'''      label: "Khách mới",''',
'''      label: "Khách mới (trang)",''')
replace_once(path,
'''            label: "Gửi ưu đãi",
            icon: <Gift size={16} aria-hidden="true" />,
            onClick: () => setShowPromotionModal(true),''',
'''            label: campaignLoading ? "Đang tải khách..." : "Gửi ưu đãi",
            icon: <Gift size={16} aria-hidden="true" />,
            onClick: handleOpenPromotionModal,
            disabled: campaignLoading || !selectedRestaurantId,''')
replace_once(path,
'''          customers={customersVisible}
          restaurantId={selectedRestaurantId}''',
'''          customers={campaignCustomers}
          rankSettings={rankSettings}
          restaurantId={selectedRestaurantId}''')

# ---------------- Customer filters ----------------
path = 'src/components/Dashboard_Manager/Customer/CustomerFilters.jsx'
regex_once(path,
    r'''const STATUS_META = \{.*?\n\};''',
'''const STATUS_META = {
  online: {
    label: "Đang trực tuyến",
    color: "#22c55e",
    icon: <Wifi size={14} />,
  },
  offline: {
    label: "Không trực tuyến",
    color: "#94a3b8",
    icon: <CircleSlash size={14} />,
  },
};''',
    flags=re.S,
)
replace_once(path,
'''    online: true,
    ordering: true,
    away: true,
    offline: true,''',
'''    online: true,
    offline: true,''')
replace_once(path,
'''      status: { online: true, ordering: true, away: true, offline: true },''',
'''      status: { online: true, offline: true },''')
# Remove now-unused icons.
replace_once(path, '  Coffee,\n  LogOut,\n', '')

# ---------------- Promotion modal ----------------
path = 'src/components/Dashboard_Manager/Customer/PromotionModal.jsx'
regex_once(path,
    r'''const getCustomerTier = \(customer\) => \{.*?\n\};''',
'''const getCustomerTier = (customer, rankSettings = []) => {
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
};''',
    flags=re.S,
)
replace_once(path,
'''const buildRecipientSet = (customers, targetMode, manualIds, segment) => {''',
'''const buildRecipientSet = (
  customers,
  targetMode,
  manualIds,
  segment,
  rankSettings,
) => {''')
replace_once(path,
'''    if (segment === "vip") return getCustomerTier(c) === "vip";
    if (segment === "frequent") return getCustomerTier(c) === "frequent";
    if (segment === "new") return getCustomerTier(c) === "new";''',
'''    if (segment === "vip") return getCustomerTier(c, rankSettings) === "vip";
    if (segment === "frequent")
      return getCustomerTier(c, rankSettings) === "frequent";
    if (segment === "new") return getCustomerTier(c, rankSettings) === "new";''')
replace_once(path,
'''const PromotionModal = ({ onClose, customers = [], restaurantId: restaurantIdProp = null }) => {''',
'''const PromotionModal = ({
  onClose,
  customers = [],
  rankSettings = [],
  restaurantId: restaurantIdProp = null,
}) => {''')
replace_once(path,
'''    () => buildRecipientSet(customers, targetMode, manualRecipientIds, segmentKey),
    [customers, targetMode, manualRecipientIds, segmentKey]''',
'''    () =>
      buildRecipientSet(
        customers,
        targetMode,
        manualRecipientIds,
        segmentKey,
        rankSettings,
      ),
    [customers, targetMode, manualRecipientIds, segmentKey, rankSettings]''')
replace_once(path,
'''          channel: "support",
          targetRole: "support",
          subject: `Khách hàng #${String(customer.id).padStart(4, "0")} - ${
            customer?.name || "Khách hàng"
          }`,''',
'''          channel: "support",
          participantIds: [customer.id],
          subject: `Khách hàng #${String(customer.id).padStart(4, "0")} - ${
            customer?.name || customer?.fullName || "Khách hàng"
          }`,''')

# ---------------- Customer modal ----------------
path = 'src/components/Dashboard_Manager/Customer/CustomerModal.jsx'
replace_once(path,
'''import { navigateToManagerOrders } from "./customerOrderNavigation";''',
'''import { navigateToManagerOrders } from "./customerOrderNavigation";
import { toUserFacingErrorMessage } from "../../../utils/userFacingError";''')
replace_once(path,
'''const GET_CUSTOMER_DETAIL_ANALYTICS = gql`''',
'''const GET_CUSTOMER_NOTE = gql`
  query GetCustomerNote($userId: ID!, $restaurantId: ID!) {
    customerNote(userId: $userId, restaurantId: $restaurantId)
  }
`;

const GET_CUSTOMER_DETAIL_ANALYTICS = gql`''')
replace_once(path,
'''  const detailAnalytics = detailAnalyticsData?.customerDetailAnalytics || null;''',
'''  const detailAnalytics = detailAnalyticsData?.customerDetailAnalytics || null;
  const { data: noteData } = useQuery(GET_CUSTOMER_NOTE, {
    skip: !isOpen || !customer?.id || !restaurantId,
    variables: {
      userId: String(customer?.id || ""),
      restaurantId,
    },
    fetchPolicy: "network-only",
    errorPolicy: "all",
  });''')
replace_once(path,
'''    const hasWallet = customer?.wallet?.id || customer?.hasWallet;
    const isActive = customer?.wallet?.isActive ?? hasWallet;''',
'''    const hasWallet = customer?.wallet || customer?.hasWallet;
    const isActive =
      customer?.wallet?.status === "active" ||
      customer?.wallet?.isActive === true ||
      customer?.hasWallet === true;''')
replace_once(path,
'''  useEffect(() => {
    const incomingNotes = customer?.noteInternal || customer?.notes || "";
    setNotes(incomingNotes);
    setTempNotes(incomingNotes);
    setIsEditingNotes(false);
  }, [customer?.id, customer?.noteInternal, customer?.notes]);''',
'''  useEffect(() => {
    const incomingNotes =
      noteData?.customerNote ?? customer?.noteInternal ?? customer?.notes ?? "";
    setNotes(incomingNotes);
    setTempNotes(incomingNotes);
    setIsEditingNotes(false);
  }, [
    customer?.id,
    customer?.noteInternal,
    customer?.notes,
    noteData?.customerNote,
  ]);''')
replace_once(path,
'''      showNotification(err?.message || "Không thể gửi xác nhận.", "error");''',
'''      showNotification(
        toUserFacingErrorMessage(err, "Không thể gửi xác nhận."),
        "error",
      );''')
replace_once(path,
'''        err?.message || "Không thể lưu ghi chú khách hàng.",''',
'''        toUserFacingErrorMessage(err, "Không thể lưu ghi chú khách hàng."),''')
replace_once(path,
'''            channel: "support",
            targetRole: "support",
            subject: `Khách hàng #${String(customer.id).padStart(4, "0")} - ${displayName || "Khách vãng lai"}`,''',
'''            channel: "support",
            participantIds: [customer.id],
            subject: `Khách hàng #${String(customer.id).padStart(4, "0")} - ${displayName || "Khách vãng lai"}`,''')
replace_once(path,
'''      setChatError(err?.message || "Không thể mở hội thoại.");''',
'''      setChatError(
        toUserFacingErrorMessage(err, "Không thể mở hội thoại."),
      );''')
replace_once(path,
'''      setChatError(err?.message || "Gửi tin nhắn thất bại.");''',
'''      setChatError(
        toUserFacingErrorMessage(err, "Gửi tin nhắn thất bại."),
      );''')

# ---------------- Archive frontend ----------------
path = 'src/components/Dashboard_Manager/Customer/CustomerArchiveControls.jsx'
replace_once(path,
'''import { useNotification } from "../../../hooks/useNotification";''',
'''import { useNotification } from "../../../hooks/useNotification";
import { toUserFacingErrorMessage } from "../../../utils/userFacingError";''')
replace_once(path,
'''  const isAdmin = isAdminRole(user);

  const { data''',
'''  const isAdmin = isAdminRole(user);
  const canManageArchive = isAdmin || isManagerRole(user);

  const { data''')
replace_once(path,
'''      skip: !isOpen || !isAdmin || !selectedRestaurantId,''',
'''      skip: !isOpen || !canManageArchive || !selectedRestaurantId,''')
replace_once(path,
'''      if (isAdmin) setIsOpen(true);''',
'''      if (canManageArchive) setIsOpen(true);''')
replace_once(path,
'''        archiveError?.message || "Không thể ẩn danh sách khách hàng.",''',
'''        toUserFacingErrorMessage(
          archiveError,
          "Không thể ẩn danh sách khách hàng.",
        ),''')
replace_once(path,
'''        restoreError?.message || "Không thể khôi phục khách hàng.",''',
'''        toUserFacingErrorMessage(
          restoreError,
          "Không thể khôi phục khách hàng.",
        ),''')
replace_once(path,
'''        {isAdmin ? (
          <button''',
'''        {canManageArchive ? (
          <button''')
replace_once(path,
'''      {isAdmin ? (
        <Modal''',
'''      {canManageArchive ? (
        <Modal''')
replace_once(path,
'''                  {error.message || "Không thể tải danh sách đã ẩn."}''',
'''                  {toUserFacingErrorMessage(
                    error,
                    "Không thể tải danh sách đã ẩn.",
                  )}''')

# ---------------- Correct totals in list/card ----------------
path = 'src/components/Dashboard_Manager/Customer/CustomerList.jsx'
replace_once(path,
'''  const total = sortedOrders.reduce(
    (sum, entry) => sum + getEntryAmount(entry),
    0,
  );
  return {
    orderCount: sortedOrders.length,
    total,
    lastOrder: sortedOrders[0],
  };''',
'''  const recentTotal = sortedOrders.reduce(
    (sum, entry) => sum + getEntryAmount(entry),
    0,
  );
  const storedOrderCount = Number(customer?.totalOrders);
  const storedTotal = Number(customer?.totalSpending);
  return {
    orderCount:
      Number.isFinite(storedOrderCount) && storedOrderCount >= 0
        ? storedOrderCount
        : sortedOrders.length,
    total:
      Number.isFinite(storedTotal) && storedTotal >= 0
        ? storedTotal
        : recentTotal,
    lastOrder: sortedOrders[0],
  };''')

path = 'src/components/Dashboard_Manager/Customer/CustomerCard.jsx'
replace_once(path,
'''    const count = sortedRecentOrders.length;
    const total = sortedRecentOrders.reduce(
      (sum, entry) => sum + getEntryAmount(entry),
      0,
    );
    const avg = count > 0 ? total / count : 0;''',
'''    const recentCount = sortedRecentOrders.length;
    const recentTotal = sortedRecentOrders.reduce(
      (sum, entry) => sum + getEntryAmount(entry),
      0,
    );
    const storedCount = Number(customer?.totalOrders);
    const storedTotal = Number(customer?.totalSpending);
    const count =
      Number.isFinite(storedCount) && storedCount >= 0
        ? storedCount
        : recentCount;
    const total =
      Number.isFinite(storedTotal) && storedTotal >= 0
        ? storedTotal
        : recentTotal;
    const avg = count > 0 ? total / count : 0;''')
replace_once(path,
'''          <div className="lbl">Đơn gần đây</div>''',
'''          <div className="lbl">Tổng đơn</div>''')

print('Customer business flow patches applied successfully.')
