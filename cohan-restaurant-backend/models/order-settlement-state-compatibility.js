const SETTLEMENT_STATE_PATHS = ["sessionStatus", "orderPaymentStatus"];
const INSTALL_MARKER = Symbol.for("cohan.orderSettlementStateCompatibilityInstalled");

export function normalizeOrderSettlementState(value) {
  if (value === undefined || value === null) return value;
  return String(value).trim().toLowerCase();
}

/**
 * A few legacy settlement paths still assign uppercase lifecycle values such as
 * CLOSED and PAID. The Order schema stores these enums in lowercase. Registering
 * setters at the model boundary keeps old callers compatible and prevents a
 * successful provider callback from rolling back only because Mongoose rejects
 * the parent table-session state during settlement.
 */
export function installOrderSettlementStateCompatibility(OrderModel) {
  if (!OrderModel?.schema || OrderModel[INSTALL_MARKER]) return OrderModel;

  for (const pathName of SETTLEMENT_STATE_PATHS) {
    const schemaType = OrderModel.schema.path(pathName);
    if (!schemaType) {
      throw new Error(`ORDER_SETTLEMENT_STATE_PATH_MISSING:${pathName}`);
    }
    schemaType.set(normalizeOrderSettlementState);
  }

  Object.defineProperty(OrderModel, INSTALL_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return OrderModel;
}

export default installOrderSettlementStateCompatibility;
