const toFiniteNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const nonNegative = (value, fallback = 0) =>
  Math.max(0, toFiniteNumber(value, fallback) ?? fallback);

export const getAuthoritativeLineTotal = (item = {}) => {
  const storedLineTotal = toFiniteNumber(item?.lineSubtotal);
  if (storedLineTotal != null) return Math.max(0, storedLineTotal);

  const quantity = nonNegative(item?.quantity);
  if (!(quantity > 0)) return 0;

  const finalUnitPrice = toFiniteNumber(item?.unitPrice ?? item?.price);
  if (finalUnitPrice != null) {
    return Math.max(0, finalUnitPrice) * quantity;
  }

  const baseUnitPrice = nonNegative(
    item?.baseUnitPrice ?? item?.basePrice ?? item?.servingVariant?.price,
  );
  const modifiersPrice = nonNegative(
    item?.modifiersPricePerUnit ?? item?.modifiersPrice,
  );
  return (baseUnitPrice + modifiersPrice) * quantity;
};

export const getAuthoritativeUnitPrice = (item = {}) => {
  const quantity = nonNegative(item?.quantity);
  const lineTotal = getAuthoritativeLineTotal(item);
  if (quantity > 0 && lineTotal >= 0) return lineTotal / quantity;

  const finalUnitPrice = toFiniteNumber(item?.unitPrice ?? item?.price);
  if (finalUnitPrice != null) return Math.max(0, finalUnitPrice);

  return (
    nonNegative(
      item?.baseUnitPrice ?? item?.basePrice ?? item?.servingVariant?.price,
    ) +
    nonNegative(item?.modifiersPricePerUnit ?? item?.modifiersPrice)
  );
};

export const normalizeLegacyPaymentDisplayItem = (item = {}) => {
  const finalUnitPrice = getAuthoritativeUnitPrice(item);
  const storedModifierPrice = nonNegative(
    item?.modifiersPricePerUnit ?? item?.modifiersPrice,
  );
  const storedBasePrice = toFiniteNumber(
    item?.baseUnitPrice ?? item?.basePrice ?? item?.servingVariant?.price,
  );

  let basePrice =
    storedBasePrice == null
      ? Math.max(0, finalUnitPrice - storedModifierPrice)
      : Math.max(0, storedBasePrice);
  let modifiersPrice = storedModifierPrice;

  if (Math.abs(basePrice + modifiersPrice - finalUnitPrice) > 1) {
    if (basePrice <= finalUnitPrice) {
      modifiersPrice = finalUnitPrice - basePrice;
    } else {
      basePrice = finalUnitPrice;
      modifiersPrice = 0;
    }
  }

  return {
    ...item,
    price: basePrice,
    modifiersPrice,
    lineSubtotal: getAuthoritativeLineTotal(item),
  };
};
