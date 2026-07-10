import { validatePublicTableOrderSessionAccess } from "../../../src/services/publicTableOrderAccess.service.js";
import { withTableOrderSessionCookieCredentials } from "../shared/tableOrderSessionCookies.js";
import publicTablePaymentMutation from "./publicTablePaymentMutation.js";

async function requireVerifiedTableSession(input, ctx) {
  const credentialContext = withTableOrderSessionCookieCredentials(
    ctx,
    input?.tableId,
  );
  await validatePublicTableOrderSessionAccess({
    ctx: credentialContext,
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
