const toAmount = (value) => Math.max(0, Number(value || 0));

export function getReservationDepositAvailability(reservation) {
  if (!reservation) {
    return {
      menuDepositAvailable: 0,
      tableDepositRefundAmount: 0,
      tableDepositRetainedAmount: 0,
    };
  }

  const total = toAmount(reservation.depositAmount);
  const menu = Math.min(total, toAmount(reservation.menuDepositAmount));
  const table = Math.min(total, toAmount(reservation.tableDepositAmount));
  const alreadySettled = Math.min(
    total,
    toAmount(reservation.depositAppliedAmount),
  );
  const menuPreviouslySettled = Math.min(menu, alreadySettled);
  const tablePreviouslySettled = Math.min(
    table,
    Math.max(0, alreadySettled - menuPreviouslySettled),
  );
  const menuDepositAvailable = Math.max(0, menu - menuPreviouslySettled);
  const tableDepositAvailable = Math.max(0, table - tablePreviouslySettled);
  const tableDepositRefundEligible =
    reservation.tableDepositRefundEligible !== false;

  return {
    menuDepositAvailable,
    tableDepositRefundAmount: tableDepositRefundEligible
      ? tableDepositAvailable
      : 0,
    tableDepositRetainedAmount: tableDepositRefundEligible
      ? 0
      : tableDepositAvailable,
  };
}

export function calculateReservationDepositSettlement({
  grossTotal = 0,
  menuDepositAvailable = 0,
  tableDepositRefundAmount = 0,
} = {}) {
  const gross = toAmount(grossTotal);
  const menuAvailable = toAmount(menuDepositAvailable);
  const tableRefund = toAmount(tableDepositRefundAmount);
  const menuDepositCredit = Math.min(gross, menuAvailable);
  const menuDepositRefund = Math.max(0, menuAvailable - menuDepositCredit);
  const amountToCollect = Math.max(0, gross - menuDepositCredit);
  const totalRefund = tableRefund + menuDepositRefund;
  const customerNet = amountToCollect - totalRefund;

  return {
    grossTotal: gross,
    menuDepositCredit,
    menuDepositRefund,
    tableDepositRefund: tableRefund,
    totalRefund,
    amountToCollect,
    customerNet,
    customerPays: Math.max(0, customerNet),
    customerReceives: Math.max(0, -customerNet),
  };
}
