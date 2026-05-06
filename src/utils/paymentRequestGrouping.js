const VIRTUAL_TABLE_CODES = new Set(["TAKEAWAY", "DELIVERY", "REMOTE", "ONLINE"]);

export function isRealDineInTableCode(orderType, tableCode) {
  const normalizedType = String(orderType || "").toLowerCase();
  const normalizedCode = String(tableCode || "").trim();
  if (normalizedType !== "dine_in") return false;
  if (!normalizedCode) return false;
  return !VIRTUAL_TABLE_CODES.has(normalizedCode.toUpperCase());
}

export function getPaymentRequestGroupKey(request = {}) {
  if (isRealDineInTableCode(request?.orderType, request?.tableCode)) {
    return `table:${request.tableCode}`;
  }

  return `order:${request?.orderId || request?.orderCode || "unknown"}`;
}

export function groupPaymentRequests(requests = []) {
  const map = new Map();

  requests.forEach((req) => {
    const groupKey = getPaymentRequestGroupKey(req);
    const isTableGroup = groupKey.startsWith("table:");

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        ...req,
        groupKey,
        isTableGroup,
        orderIds: [],
        orderCodes: [],
        totals: {
          ...(req?.totals || {}),
          grandTotal: 0,
        },
      });
    }

    const group = map.get(groupKey);
    if (req?.orderId) group.orderIds.push(req.orderId);
    if (req?.orderCode) group.orderCodes.push(req.orderCode);

    group.totals.grandTotal += Number(req?.totals?.grandTotal || 0);

    const currentAt = group.requestedAt ? new Date(group.requestedAt).getTime() : 0;
    const nextAt = req?.requestedAt ? new Date(req.requestedAt).getTime() : 0;

    if (nextAt > currentAt) {
      group.requestedAt = req.requestedAt;
      group.payment = req.payment;
    }
  });

  return Array.from(map.values());
}
