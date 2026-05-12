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
  "publicTableSession.graphql",
  "tableCustomer.graphql",
  "printSetting.graphql",
  "review.graphql",
  "promotion.graphql",
  "event_package.graphql",
  "table_event.graphql",
  "coupon.graphql",
  "cart.graphql",
  "search.graphql",
  "shippingTracking.graphql",
  "orderTracking.graphql",
  "supplier.graphql",
  "communication.graphql",
  "availability.graphql",
  "posCustomer.graphql",
  "attendance_overtime.graphql",
].map((f) => fs.readFileSync(path.join(schemaDir, f), "utf8"));

const typeDefs = mergeTypeDefs(files, { useSchemaDefinition: true });

export default typeDefs;
