import { isLocalImageUri } from "./localImageStore";

export const isLocalImageUrl = (src) => isLocalImageUri(src);

export const isRemoteImageUrl = (src) =>
  typeof src === "string" && /^https?:\/\//i.test(src);

export const getImagePersistenceStatus = (src) => {
  if (!src) return "empty";
  if (isLocalImageUrl(src)) return "localOnly";
  if (isRemoteImageUrl(src)) return "synced";
  return "unknown";
};
