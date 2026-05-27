function toPlainObject(user) {
  if (!user) return null;
  if (typeof user.toObject === "function") return user.toObject({ virtuals: true });
  return { ...user };
}

function sanitizeRole(role) {
  if (!role || typeof role !== "object") return role || null;
  return Object.fromEntries(
    Object.entries({
      _id: role._id,
      id: role.id,
      name: role.name,
      slug: role.slug,
      permissions: Array.isArray(role.permissions) ? role.permissions : undefined,
    }).filter(([, value]) => typeof value !== "undefined"),
  );
}

export function sanitizeUserForClient(user) {
  const source = toPlainObject(user);
  if (!source) return null;

  const roleName = String(source.roleName || source.role?.slug || source.role?.name || "").toLowerCase();
  return Object.fromEntries(
    Object.entries({
      _id: source._id,
      id: source.id || (source._id ? String(source._id) : undefined),
      fullName: source.fullName || source.name,
      username: source.username,
      email: source.email,
      phone: source.phone,
      avatarUrl: source.avatarUrl,
      address: source.address,
      status: source.status,
      userType: source.userType,
      role: sanitizeRole(source.role),
      roleName,
      refRestaurants: source.refRestaurants,
      restaurantForStaff: source.restaurantForStaff,
      loyaltyRank: source.loyaltyRank,
      wallet: source.wallet
        ? { provider: source.wallet.provider, currency: source.wallet.currency, balance: source.wallet.balance }
        : undefined,
      customer: source.customer,
      isGuest: source.isGuest,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    }).filter(([, value]) => typeof value !== "undefined"),
  );
}
