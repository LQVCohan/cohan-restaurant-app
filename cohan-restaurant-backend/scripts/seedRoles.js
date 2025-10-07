// scripts/seedRoles.js
import mongoose from "mongoose";

import { Role } from "../src/models/Role.js";

const role = [
  { name: "Admin", slug: "admin", isSystem: true, permissions: ["*"] },
  {
    name: "Manager",
    slug: "manager",
    isSystem: true,
    permissions: [
      "restaurant.read",
      "restaurant.write",
      "order.read",
      "order.write",
      "user.read",
    ],
  },
  {
    name: "Customer",
    slug: "customer",
    isSystem: true,
    permissions: [
      "restaurant.read",
      "menu.read",
      "order.create",
      "reservation.create",
      "user.self",
    ],
  },
  {
    name: "Staff",
    slug: "staff",
    isSystem: true,
    permissions: ["restaurant.read", "order.read", "shift.read"],
  },
  {
    name: "Chef",
    slug: "chef",
    parent: "staff",
    isSystem: true,
    permissions: ["kitchen.read", "kitchen.write", "order.read", "menu.read"],
  },
  {
    name: "Server",
    slug: "server",
    parent: "staff",
    isSystem: true,
    permissions: [
      "table.read",
      "order.read",
      "order.update",
      "reservation.read",
    ],
  },
  {
    name: "Cleaner",
    slug: "cleaner",
    parent: "staff",
    isSystem: true,
    permissions: ["cleaning.read", "shift.read"],
  },
  {
    name: "Shipper",
    slug: "shipper",
    parent: "staff",
    isSystem: true,
    permissions: ["delivery.read", "delivery.update", "order.read"],
  },
  {
    name: "Supervisor",
    slug: "supervisor",
    parent: "staff",
    isSystem: true,
    permissions: [
      "staff.read",
      "shift.manage",
      "order.read",
      "restaurant.read",
    ],
  },
  {
    name: "Cashier",
    slug: "cashier",
    parent: "staff",
    isSystem: true,
    permissions: ["payment.read", "payment.write", "order.read"],
  },
];

async function run() {
  for (const r of role) {
    const exists = await Role.findOne({ slug: r.slug }).lean();
    if (!exists) {
      await Role.create(r);
      console.log(`+ Created role: ${r.slug}`);
    } else {
      console.log(`= Skipped role (exists): ${r.slug}`);
    }
  }

  await mongoose.disconnect();
  console.log("🏁 Done");
}

run().catch((e) => {
  console.error(e);
});
