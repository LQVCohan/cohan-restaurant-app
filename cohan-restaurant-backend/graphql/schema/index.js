import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mergeTypeDefs } from "@graphql-tools/merge";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaDir = __dirname;

const staffResolverCompatibilityPrelude = `
type AuthPayload {
  token: String!
  user: User!
}

input UpdateAvatarInput {
  fileBase64: String
  fileUrl: String
  clear: Boolean
}

input CreateWalletInput {
  provider: String
  currency: String
}

input StaffBusinessContextInput {
  brandId: ID!
  restaurantId: ID!
}

extend input CreateUserInput {
  staffBusinessContext: StaffBusinessContextInput
}
`;

const userMutationCompatibilitySchema = `
input AssignRoleToUserInput {
  userId: ID!
  roleId: ID!
}

extend input UpdateUserInput {
  avatarUrl: String
}

input AdminUpdateUserInput {
  fullName: String
  username: String
  email: String
  phone: String
  address: AddressInput
  avatarUrl: String
  status: String
  roleId: ID
  refRestaurantIds: [ID!]
  customerType: CustomerType
  loyaltyPoints: Int
  totalOrders: Int
  totalSpending: Float
  isGuest: Boolean
  guestExpiresAt: DateTime

  department: DepartmentType
  positionTitle: String
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  shiftType: ShiftType
  workingDays: [StaffWorkingDay!]
  dateJoined: DateTime
  dateLeft: DateTime
  baseSalary: Int
  hourlyRate: Float
  commissionRate: Float
  salaryType: StaffSalaryType
  noteInternal: String
  emergencyContact: EmergencyContactInput
}

extend type Mutation {
  assignRoleToUser(input: AssignRoleToUserInput!): User
  createGuestUser(fullName: String, phone: String, expiresInDays: Int): User
  adminUpdateUser(userId: ID!, input: AdminUpdateUserInput!): User
  updateCustomerMetrics(id: ID!, restaurantId: ID!, loyaltyPoints: Int!, customerType: CustomerType!): User
  resendUserVerification(userId: ID!, channel: VerificationChannel = AUTO): VerificationResult
  resendSmsVerification(phone: String!): Boolean
}
`;

const customerExportRowsField = `
  customerExportRows(
    restaurantId: ID!
    search: String
    includeGuests: Boolean = true
    customerKind: CustomerKindFilter = ALL
    customerRank: CustomerRankFilterInput
    sortBy: CustomerSortBy = CREATED_AT
    sortDirection: SortDirection = DESC
    limit: Int = 1000
  ): [User!]!`;

const customerListSummariesField = `customerListSummaries(
    restaurantId: ID!
    userIds: [ID!]!
    recentLimit: Int = 5
    topDishLimit: Int = 3
  ): [CustomerListSummary!]!`;

const stripDomainOwnedStaffCompatibilityFields = (source) => {
  const domainOwnedMutationFields = [
    "publishSchedule(input: PublishScheduleInput!): CompatibilityNode",
    "changePublishedShiftGroupTime(input: ChangePublishedShiftGroupTimeInput!): CompatibilityNode",
    "addStaffToPublishedShiftGroup(input: AddStaffToPublishedShiftGroupInput!): CompatibilityNode",
    "deletePublishedShiftGroup(input: DeletePublishedShiftGroupInput!): CompatibilityNode",
  ];

  return domainOwnedMutationFields.reduce(
    (nextSource, field) => nextSource.replace(`\n  ${field}`, ""),
    source,
  );
};

const readSchemaFile = (fileName) => {
  const source = fs.readFileSync(path.join(schemaDir, fileName), "utf8");

  if (fileName === "payments.graphql") {
    return source
      .replace(
        "  e_wallet\n  other",
        "  e_wallet\n  provider\n  momo\n  vnpay\n  other",
      )
      .replace(
        "  orderId: ID!\n  customerId:",
        "  orderId: ID\n  customerId:",
      )
      .replace(
        "type PaymentTransaction {\n  id: ID!\n  orderId: ID!",
        "type PaymentTransaction {\n  id: ID!\n  orderId: ID",
      );
  }

  if (fileName === "wallet.graphql") {
    return source.replace(
      "myWalletTransactions(input: WalletTransactionFilterInput): [WalletTransaction!]!",
      "myWalletTransactions(input: WalletTransactionFilterInput, limit: Int = 20, offset: Int = 0): [WalletTransaction!]!",
    );
  }

  if (fileName === "customerRankSettings.graphql") {
    return source.replace("customerRankSettings(restaurantId: ID!):", "customerRankSettings(restaurantId: ID):");
  }

  if (fileName === "frontendCompatibility.graphql") {
    return source.replace(
      "staffSchedulingAssistant(restaurantId: ID!, horizonDays: Int): StaffSchedulingAssistant",
      "staffSchedulingAssistant(restaurantId: ID!, horizonDays: Int, timezone: String): StaffSchedulingAssistant",
    );
  }

  if (fileName === "staffResolverCompatibility.graphql") {
    return `${staffResolverCompatibilityPrelude}\n${stripDomainOwnedStaffCompatibilityFields(source)
      .replace(
        "createMyWallet(input: CreateWalletInput!): Wallet",
        "createMyWallet(input: CreateWalletInput!): User",
      )
      .replace(
        "updateUser(id: ID, input: UpdateUserInput!): User",
        "updateUser(input: UpdateUserInput!): User",
      )}`;
  }

  if (fileName !== "user.graphql") return source;

  const firstWalletField = source.indexOf("\n  wallet: Wallet");
  const lastWalletField = source.lastIndexOf("\n  wallet: Wallet");
  const withoutDuplicateWallet = firstWalletField === -1 || firstWalletField === lastWalletField
    ? source
    : `${source.slice(0, lastWalletField)}${source.slice(lastWalletField + "\n  wallet: Wallet".length)}`;

  return withoutDuplicateWallet
    .replace(
      "createUser(input: CreateUserInput!): User!",
      "createUser(input: CreateUserInput!): AuthPayload!",
    )
    .replace(
      "updateUser(id: ID!, input: UpdateUserInput!): User!",
      "updateUser(input: UpdateUserInput!): User!",
    )
    .replace(
      "updateCustomerMetrics(input: UpdateCustomerMetricsInput!): User!",
      "updateCustomerMetrics(input: UpdateCustomerMetricsInput, id: ID, restaurantId: ID, loyaltyPoints: Int, customerType: CustomerType): User!",
    )
    .replace(
      "customerListSummaries(restaurantId: ID!, userIds: [ID!]!): [CustomerListSummary!]!",
      `${customerListSummariesField}${customerExportRowsField}`,
    )
    .replace(
      "customerDetailAnalytics(restaurantId: ID!, userId: ID!): CustomerDetailAnalytics!",
      "customerDetailAnalytics(restaurantId: ID, userId: ID!): CustomerDetailAnalytics!",
    )
    .replace(
      "changePublishedShiftGroupTime(input: ChangePublishedShiftGroupTimeInput!): ScheduleChangeLog!",
      "changePublishedShiftGroupTime(input: ChangePublishedShiftGroupTimeInput!): Boolean!",
    )
    .replace(
      "addStaffToPublishedShiftGroup(input: AddStaffToPublishedShiftGroupInput!): ScheduleChangeLog!",
      "addStaffToPublishedShiftGroup(input: AddStaffToPublishedShiftGroupInput!): CompatibilityNode!",
    )
    .replace(
      "deletePublishedShiftGroup(input: DeletePublishedShiftGroupInput!): ScheduleChangeLog!",
      "deletePublishedShiftGroup(input: DeletePublishedShiftGroupInput!): Boolean!",
    );
};

const files = [
  "base.graphql",
  "user.graphql",
  "authSocial.graphql",
  "payrollReadiness.graphql",
  "payrollPagination.graphql",
  "managerDashboard.graphql",
  "frontendCompatibility.graphql",
  "restaurant.graphql",
  "restaurantInitialSetup.graphql",
  "brand.graphql",
  "role.graphql",
  "permission.graphql",
  "menu.graphql",
  "menuMultiSlot.graphql",
  "customerMenuItemLocations.graphql",
  "category.graphql",
  "modifier.graphql",
  "floor_table.graphql",
  "inventory.graphql",
  "inventoryCount.graphql",
  "order.graphql",
  "reservation.graphql",
  "supply.graphql",
  "event_log.graphql",
  "payments.graphql",
  "paymentCredentials.graphql",
  "paymentTransfer.graphql",
  "walletEnums.graphql",
  "wallet.graphql",
  "paymentIdempotency.graphql",
  "publicTableSession.graphql",
  "tableCustomer.graphql",
  "printSetting.graphql",
  "review.graphql",
  "reviewReliability.graphql",
  "promotion.graphql",
  "customerCombo.graphql",
  "event_package.graphql",
  "table_event.graphql",
  "coupon.graphql",
  "user_coupon.graphql",
  "coupon_redemption.graphql",
  "cart.graphql",
  "customerFavorite.graphql",
  "customerAddress.graphql",
  "customerAccountSecurity.graphql",
  "customerRankSettings.graphql",
  "search.graphql",
  "shippingTracking.graphql",
  "orderTracking.graphql",
  "supplier.graphql",
  "communication.graphql",
  "aiChatbot.graphql",
  "availability.graphql",
  "posCustomer.graphql",
  "staffAttendanceRecord.graphql",
  "attendance_overtime.graphql",
  "staffSchedulingAssistant.graphql",
  "staffResolverCompatibility.graphql",
  "staffSelfServiceCompatibility.graphql",
  "staffPerformancePolicy.graphql",
  "operationCompatibilityExtras.graphql",
  "operationCompatibilityExtras2.graphql",
  "audit_log.graphql",
  "systemSetting.graphql",
  "backup.graphql",
].map(readSchemaFile);

files.push(userMutationCompatibilitySchema);

const staffManagementSchema = `
extend type Mutation {
  updateStaffAvatar(userId: ID!, input: UpdateAvatarInput!): StaffPrivateProfile!
  setStaffAccountStatus(userId: ID!, status: String!): StaffPrivateProfile!
}
`;
files.push(staffManagementSchema);

const typeDefs = mergeTypeDefs(files, { useSchemaDefinition: true });

export default typeDefs;
