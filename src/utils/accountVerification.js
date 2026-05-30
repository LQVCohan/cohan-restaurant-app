export function accountActivationPolicy() {
  return String(
    import.meta.env.VITE_ACCOUNT_ACTIVATION_REQUIRE ||
      import.meta.env.VITE_VERIFICATION_POLICY ||
      "email",
  ).toLowerCase();
}

export function isAccountVerified(user) {
  if (!user) return false;
  const emailVerified = user.emailVerified === true;
  const phoneVerified = user.phoneVerified === true;
  const hasEmail = Boolean(user.email);
  const hasPhone = Boolean(user.phone);
  const policy = accountActivationPolicy();
  if (policy === "both") return (!hasEmail || emailVerified) && (!hasPhone || phoneVerified);
  if (policy === "phone") return phoneVerified || (!hasPhone && emailVerified);
  if (policy === "any") return emailVerified || phoneVerified;
  if (!hasEmail && hasPhone) return phoneVerified;
  return emailVerified;
}

export function verificationLabel(user) {
  if (isAccountVerified(user)) {
    if (user?.emailVerified && !user?.phoneVerified) return "Đã xác minh email";
    if (user?.phoneVerified && !user?.emailVerified) return "Đã xác minh SĐT";
    return "Đã xác minh";
  }
  if (!user?.email && !user?.phone) return "Thiếu email/SĐT";
  if (user?.status === "pending") return "Chờ xác minh";
  return "Chưa xác minh";
}

export function verificationStatus(user) {
  if (isAccountVerified(user)) {
    if (user?.emailVerified && !user?.phoneVerified) return "email_verified";
    if (user?.phoneVerified && !user?.emailVerified) return "phone_verified";
    return "verified";
  }
  if (user?.status === "pending") return "pending";
  return "unverified";
}
