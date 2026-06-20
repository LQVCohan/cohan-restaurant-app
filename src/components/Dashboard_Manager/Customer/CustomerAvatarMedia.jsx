import React, { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { toApiAssetUrl } from "@/lib/apiBaseUrl";

const IMAGE_EXTENSION_RE = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

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

const resolveAvatarCandidate = (customer) =>
  customer?.avatarUrl || customer?.raw?.avatarUrl || customer?.avatar || "";

const getInitials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const CustomerAvatarMedia = ({
  customer,
  name,
  iconSize = 24,
  className = "",
  alt,
}) => {
  const candidate = resolveAvatarCandidate(customer);
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
        alt={alt || `Ảnh đại diện của ${name || "khách hàng"}`}
        className={className || undefined}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (typeof candidate === "string" && candidate.trim() && !isImageReference(candidate)) {
    return (
      <span className={className || undefined} aria-hidden="true">
        {candidate.trim()}
      </span>
    );
  }

  const initials = getInitials(name);
  if (initials) {
    return (
      <span className={className || undefined} aria-label={`Ảnh đại diện của ${name}`}>
        {initials}
      </span>
    );
  }

  return <User size={iconSize} className={className || undefined} aria-hidden="true" />;
};

export default CustomerAvatarMedia;
