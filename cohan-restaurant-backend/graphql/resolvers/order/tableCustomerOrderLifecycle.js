import { TableCustomer } from "../../../models/index.js";
import { toId } from "./helper/orderUtils.js";

const hasCustomerIdentity = (customer) =>
  Boolean(
    customer &&
      [customer.fullName, customer.name, customer.phone, customer.email].some(
        (value) => String(value || "").trim(),
      ),
  );

const buildCustomerInput = (row) => {
  if (!row) return null;
  const customer = {
    fullName: String(row.customerName || "").trim() || undefined,
    phone: String(row.customerPhone || "").trim() || undefined,
    email: String(row.customerEmail || "").trim() || undefined,
  };
  return hasCustomerIdentity(customer) ? customer : null;
};

async function findTableCustomer(input = {}) {
  const restaurantId = toId(input.restaurantId);
  const tableId = toId(input.tableId);
  const tableCode = String(input.tableCode || "").trim();
  if (!restaurantId || (!tableId && !tableCode)) return null;

  const lookup = {
    restaurantId,
    ...(tableId && tableCode
      ? { $or: [{ tableId }, { tableCode }] }
      : tableId
        ? { tableId }
        : { tableCode }),
  };

  return TableCustomer.findOne(lookup).sort({ updatedAt: -1 }).lean();
}

export function withTableCustomerOrderLifecycle(orderMutation) {
  if (typeof orderMutation?.createOrderForTable !== "function") {
    return orderMutation;
  }

  return {
    ...orderMutation,

    async createOrderForTable(parent, args = {}, ctx, info) {
      const input = args?.input || {};
      const shouldHydrate =
        !input.userId && !hasCustomerIdentity(input.customer);
      const tableCustomer = shouldHydrate
        ? await findTableCustomer(input)
        : null;

      const savedCustomer = buildCustomerInput(tableCustomer);
      // Contact resolution tolerates a guest record that already expired. Only fall
      // back to the stored id when the snapshot has no usable contact information.
      const savedUserId =
        !savedCustomer && tableCustomer?.customerUserId
          ? String(tableCustomer.customerUserId)
          : null;
      const nextArgs =
        savedCustomer || savedUserId
          ? {
              ...args,
              input: {
                ...input,
                ...(savedCustomer ? { customer: savedCustomer } : {}),
                ...(savedUserId ? { userId: savedUserId } : {}),
              },
            }
          : args;

      const result = await orderMutation.createOrderForTable.call(
        this,
        parent,
        nextArgs,
        ctx,
        info,
      );

      const resolvedUserId = toId(
        result?.order?.userId || result?.order?.user?.id,
      );
      if (tableCustomer?._id && resolvedUserId) {
        await TableCustomer.updateOne(
          {
            _id: tableCustomer._id,
            restaurantId: toId(input.restaurantId),
          },
          {
            $set: {
              customerUserId: resolvedUserId,
              updatedAt: new Date(),
            },
          },
        ).catch(() => {
          // The order already owns the guest identity; snapshot writeback is secondary.
        });
      }

      return result;
    },
  };
}

export const __testables = {
  hasCustomerIdentity,
  buildCustomerInput,
  findTableCustomer,
};
