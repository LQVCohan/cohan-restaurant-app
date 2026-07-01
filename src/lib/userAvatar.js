import { toApiAssetUrl } from "@/lib/apiBaseUrl";

const IMAGE_AVATAR_EXTENSION = /\.(png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i;

export const isImageAvatar = (value) =>
  typeof value === "string" &&
  (/^https?:\/\//.test(value) ||
    value.startsWith("/") ||
    value.startsWith("data:image") ||
    value.startsWith("blob:") ||
    IMAGE_AVATAR_EXTENSION.test(value));

export const getInitials = (name, fallback = "ND") => {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
};

export const getDisplayUser = (user) => {
  if (!user) return { fullName: "Người dùng", roleName: "Đang tải...", email: "", avatar: "", status: "INACTIVE" };
  return {
    fullName: user.fullName || user.name || "Người dùng",
    roleName: user.role?.name || user.roleName || "Nhân viên",
    email: user.email || "",
    avatar: user.avatarUrl || user.avatar || user.avatarIcon || "",
    status: user.status || "ACTIVE",
  };
};

export const resolveUserAvatarSrc = (userOrAvatar) => {
  const avatar = typeof userOrAvatar === "string" ? userOrAvatar : getDisplayUser(userOrAvatar).avatar;
  if (!isImageAvatar(avatar)) return "";
  return toApiAssetUrl(avatar);
};
