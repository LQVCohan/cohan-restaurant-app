export class OrderItemHydrationError extends Error {
  constructor(message, code = "INVALID_ITEMS") {
    super(message);
    this.name = "OrderItemHydrationError";
    this.code = code;
  }
}

export function throwInvalidOrderItems(message) {
  throw new OrderItemHydrationError(message, "INVALID_ITEMS");
}

export function assertPositiveIntegerGrams(value, field = "weightGrams") {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number <= 0) {
    throwInvalidOrderItems(`${field} must be a positive integer in grams`);
  }
  return number;
}

export function assertPositiveHydrationNumber(value, field = "quantity") {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throwInvalidOrderItems(`${field} must be greater than zero`);
  }
  return number;
}
