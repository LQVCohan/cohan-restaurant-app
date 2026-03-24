export const PaymentResolvers = {
  PaymentTransaction: {
    orderId(parent) {
      if (parent.orderId) return String(parent.orderId);
      if (Array.isArray(parent.orderIds) && parent.orderIds.length) {
        return String(parent.orderIds[0]);
      }
      return String(parent._id);
    },
    method(parent) {
      const value = String(parent.method || "cash").toLowerCase();
      if (value === "bank_transfer") return "bank_transfer";
      if (value === "e_wallet") return "e_wallet";
      if (value === "transfer") return "transfer";
      if (value === "other") return "other";
      if (value === "card") return "card";
      return "cash";
    },
  },
  Invoice: {
    orderId(parent) {
      if (parent.orderId) return String(parent.orderId);
      if (Array.isArray(parent.orderIds) && parent.orderIds.length) {
        return String(parent.orderIds[0]);
      }
      return String(parent._id);
    },
  },
  Cashflow: {
    reference(parent) {
      if (!parent.ref) return null;
      return {
        kind: parent.ref.kind || null,
        id: parent.ref.id ? String(parent.ref.id) : null,
        orderId:
          parent.ref.orderId ||
          (Array.isArray(parent.ref.orderIds) && parent.ref.orderIds.length
            ? String(parent.ref.orderIds[0])
            : null),
      };
    },
  },
};
