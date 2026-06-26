import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mergeTypeDefs } from "@graphql-tools/merge";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaDir = __dirname;
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
  "reservationChangeReview.graphql",
  "supply.graphql",
  "event_log.graphql",
  "payments.graphql",
  "paymentTransfer.graphql",
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
  "search.graphql",
  "shippingTracking.graphql",
  "orderTracking.graphql",
  "supplier.graphql",
  "communication.graphql",
  "aiChatbot.graphql",
  "availability.graphql",
  "posCustomer.graphql",
  "attendance_overtime.graphql",
  "audit_log.graphql",
  "systemSetting.graphql",
  "backup.graphql",
].map((fileName) => fs.readFileSync(path.join(schemaDir, fileName), "utf8"));

const staffAvatarSchema = `
extend type Mutation {
  updateStaffAvatar(userId: ID!, input: UpdateAvatarInput!): StaffPrivateProfile!
}
`;
files.push(staffAvatarSchema);

const typeDefs = mergeTypeDefs(files, { useSchemaDefinition: true });

export default typeDefs;
