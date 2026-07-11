import { GraphQLError } from "graphql";
import {
  BASIC_EMAIL_REGEX,
  BASIC_PHONE_REGEX,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
} from "../shared/customerIdentity.js";

export function hasValidCheckoutContact(input = {}) {
  const shipping = input?.shipping || {};
  const customer = input?.customer || {};
  const email = normalizeCustomerEmail(shipping.email ?? customer.email);
  const phone = normalizeCustomerPhone(shipping.phone ?? customer.phone);
  return Boolean(
    (email && BASIC_EMAIL_REGEX.test(email)) ||
      (phone && BASIC_PHONE_REGEX.test(phone)),
  );
}

export function withCheckoutContactGuard(mutation = {}) {
  return {
    ...mutation,
    async createCheckoutOrders(parent, args, ctx, info) {
      if (!hasValidCheckoutContact(args?.input)) {
        throw new GraphQLError(
          "Vui lòng nhập email hoặc số điện thoại hợp lệ để nhà hàng xác nhận đơn.",
          { extensions: { code: "CHECKOUT_CONTACT_REQUIRED" } },
        );
      }
      return mutation.createCheckoutOrders.call(mutation, parent, args, ctx, info);
    },
  };
}

export default withCheckoutContactGuard;
