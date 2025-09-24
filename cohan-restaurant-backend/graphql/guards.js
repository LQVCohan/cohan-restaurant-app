export function requireAuth(ctx) {
  if (!ctx?.user?.id) {
    const err = new Error("UNAUTHENTICATED");
    err.statusCode = 401;
    throw err;
  }
}

export function requireRoles(ctx, allowed = []) {
  requireAuth(ctx);
  const userRoles = ctx.user.roles || [];
  if (!allowed.some((r) => userRoles.includes(r))) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }
}

export function requireRestaurantScope(ctx, restaurantId) {
  requireAuth(ctx);
  // tuỳ mô hình: admin bỏ qua; manager cần đúng restaurantId
  const roles = ctx.user.roles || [];
  if (roles.includes("admin")) return;
  if (
    !ctx.user.restaurantId ||
    String(ctx.user.restaurantId) !== String(restaurantId)
  ) {
    const err = new Error("FORBIDDEN_SCOPE");
    err.statusCode = 403;
    throw err;
  }
}
