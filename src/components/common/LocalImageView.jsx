import React from "react";
import useLocalImageUrl from "../../hooks/useLocalImageUrl";
import { LOCAL_IMAGE_VARIANTS } from "../../utils/localImageStore";

const LocalImageView = ({
  src,
  alt = "",
  variant = LOCAL_IMAGE_VARIANTS.PREVIEW,
  className = "",
  fallback = null,
  onError,
  ...props
}) => {
  const { src: resolvedSrc, isResolving, error } = useLocalImageUrl(src, variant);

  if (!src || isResolving || error || !resolvedSrc) {
    return fallback || null;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={onError}
      loading="lazy"
      {...props}
    />
  );
};

export default LocalImageView;
