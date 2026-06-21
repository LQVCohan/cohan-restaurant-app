import React, { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { toApiAssetUrl } from "@/lib/apiBaseUrl";

const IMAGE_EXTENSION_RE = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

const AVATAR_COLORS = [
  "#536c61",
  "#2f7d68",
  "#735637",
  "#425466",
  "#7b6a58",
  "#5f7167",
];

const isImageReference = (value) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;

  return (
    /^(https?:)?\/\//i.test(normalized) ||
    normalized.startsWith("/") ||
    normalized.startsWith("data:image/") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("uploads/") ||
    normalized.startsWith("upload/") ||
    IMAGE_EXTENSION_RE.test(normalized)
  );
};

const resolveAvatarCandidate = (employee) =>
  employee?.avatarUrl ||
  employee?.avatar ||
  employee?.photoUrl ||
  employee?.profileImage ||
  employee?.raw?.avatarUrl ||
  employee?.raw?.avatar ||
  employee?.raw?.photoUrl ||
  employee?.raw?.profileImage ||
  "";

const getInitials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getAvatarColor = (name) => {
  const normalized = String(name || "");
  const hash = Array.from(normalized).reduce(
    (total, character) => total + character.codePointAt(0),
    0,
  );
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const StaffAvatarMedia = ({
  employee,
  name,
  className = "",
  iconSize = 22,
  eager = false,
}) => {
  const candidate = resolveAvatarCandidate(employee);
  const imageSrc = useMemo(
    () => (isImageReference(candidate) ? toApiAssetUrl(candidate.trim()) : ""),
    [candidate],
  );
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  if (imageSrc && !imageFailed) {
    return (
      <img
        src={imageSrc}
        alt={`Ảnh đại diện của ${name || "nhân viên"}`}
        className={className || undefined}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  const initials = getInitials(name);
  if (initials) {
    return (
      <span
        className={className || undefined}
        style={{ backgroundColor: getAvatarColor(name) }}
        aria-label={`Ảnh đại diện của ${name}`}
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={className || undefined}
      style={{ backgroundColor: AVATAR_COLORS[0] }}
      aria-label="Ảnh đại diện nhân viên"
    >
      <User size={iconSize} aria-hidden="true" />
    </span>
  );
};

export { getInitials, isImageReference, resolveAvatarCandidate };
export default StaffAvatarMedia;
