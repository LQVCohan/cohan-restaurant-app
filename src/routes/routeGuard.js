export const resolveRoleName = (me) => {
  if (!me || typeof me !== "object") return null;

  if (typeof me.roleName === "string" && me.roleName.trim()) {
    return me.roleName;
  }

  if (typeof me.role?.slug === "string" && me.role.slug.trim()) {
    return me.role.slug;
  }

  return null;
};

export const hasAllowedRole = (allowedRoles, roleName) => {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  if (!roleName || typeof roleName !== "string") {
    return false;
  }

  return allowedRoles.includes(roleName);
};
