import { validatePublicTableOrderSessionAccess } from "../../../src/services/publicTableOrderAccess.service.js";
import publicTablePaymentMutation from "./publicTablePaymentMutation.js";

async function requireVerifiedTableSession(input, ctx) {
  await validatePublicTableOrderSessionAccess({
    ctx,
    restaurantId: input?.restaurantId,
    tableId: input?.tableId,
    requireOrderable: false,
  });
}

export const PublicTableAccessGuardMutation = {
  async publicRequestTablePayment(parent, args, ctx, info) {
    await requireVerifiedTableSession(args?.input, ctx);
    return publicTablePaymentMutation.publicRequestTablePayment(
      parent,
      args,
      ctx,
      info,
    );
  },

  async publicCallStaffForTable(parent, args, ctx, info) {
    await requireVerifiedTableSession(args?.input, ctx);
    return publicTablePaymentMutation.publicCallStaffForTable(
      parent,
      args,
      ctx,
      info,
    );
  },
};

export default PublicTableAccessGuardMutation;
