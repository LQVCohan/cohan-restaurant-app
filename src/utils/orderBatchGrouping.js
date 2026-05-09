export function groupItemsByBatch(items = []) {
  const groups = new Map();

  for (const item of items || []) {
    const key =
      item?.sourceOrderId ||
      item?.sourceOrderCode ||
      (item?.isNew ? "draft" : "unknown");

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        orderId: item?.sourceOrderId || null,
        orderCode: item?.sourceOrderCode || null,
        status: item?.sourceOrderStatus || null,
        createdAt: item?.sourceOrderCreatedAt || null,
        batchIndex: item?.batchIndex || null,
        isDraft: !!item?.isNew,
        items: [],
      });
    }

    groups.get(key).items.push(item);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.isDraft && !b.isDraft) return 1;
    if (!a.isDraft && b.isDraft) return -1;
    return Number(a.batchIndex || 9999) - Number(b.batchIndex || 9999);
  });
}
