export class OrderItemHydrationError extends Error {
  constructor(message, code = "INVALID_ITEMS") {
    super(message);
    this.name = "OrderItemHydrationError";
    this.code = code;
  }
}
