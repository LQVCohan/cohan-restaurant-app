import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mergeTypeDefs } from "@graphql-tools/merge";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaDir = __dirname;

const readSchemaFile = (fileName) => {
  const source = fs.readFileSync(path.join(schemaDir, fileName), "utf8");

  if (fileName === "wallet.graphql") {
    return source.replace(
      "myWalletTransactions(input: WalletTransactionFilterInput): [WalletTransaction!]!",
      "myWalletTransactions(input: WalletTransactionFilterInput, limit: Int = 20, offset: Int = 0): [WalletTransaction!]!",
    );
  }

  if (fileName !== "user.graphql") return source;

  const firstWalletField = source.indexOf("\n  wallet: Wallet");
  const lastWalletField = source.lastIndexOf("\n  wallet: Wallet");
  if (firstWalletField === -1 || firstWalletField === lastWalletField) return source;

  // ponytail: user.graphql currently has one duplicate User.wallet line; strip only the later copy during schema load.
  return `${source.slice(0, lastWalletField)}${source.slice(lastWalletField + "\n  wallet: Wallet".length)}`;
};

const files = [
  "base.graphql",
  "user.graphql",
  "payrollReadiness.graphql",
  "payrollPagination.graphql",
  "managerDashboard.graphql",
  "frontendCompatibility.graphql",
  "restaurant.graphql",
  "role.graphql",
  "permission.graphql",
  "menu.graphql",
  "category.graphql",
  "modifier.graphql",
  "floor_table.graphql",
  "inventory.graphql",
  "order.graphql",
  "reservation.graphql",
  "supply.graphql",
  "event_log.graphql",
  "payments.graphql",
  "paymentTransfer.graphql",
  "walletEnums.graphql",
  "wallet.graphql",
  "publicTableSession.graphql",
  "tableCustomer.graphql",
  "printSetting.graphql",
  "review.graphql",
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
  "audit_log.graphql",
  "systemSetting.graphql",
  "backup.graphql",
].map(readSchemaFile);

const staffAvatarSchema = `
extend type Mutation {
  updateStaffAvatar(userId: ID!, input: UpdateAvatarInput!): StaffPrivateProfile!
}
`;
files.push(staffAvatarSchema);

const typeDefs = mergeTypeDefs(files, { useSchemaDefinition: true });

export default typeDefs;
