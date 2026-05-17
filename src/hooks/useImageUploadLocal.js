import { useAvatarUploadLocal } from "./useAvatarUploadLocal";

const guessProvider = (url = "") => {
  if (!url) return null;
  if (url.includes("amazonaws.com") || url.includes("cloudfront.net")) return "s3";
  return "local-api";
};

export function useImageUploadLocal() {
  const { upload } = useAvatarUploadLocal();

  const uploadImage = async (fileOrBlob, options = {}, onProgress) => {
    const { folder = "images", type = "image", context } = options || {};

    const file =
      fileOrBlob instanceof File
        ? fileOrBlob
        : new File([fileOrBlob], `${type || "image"}-${Date.now()}.webp`, {
            type: fileOrBlob?.type || "image/webp",
            lastModified: Date.now(),
          });

    try {
      const url = await upload(file, onProgress);
      return {
        url,
        assetId: null,
        provider: guessProvider(url),
        context: context || null,
        folder,
      };
    } catch (error) {
      return {
        url: null,
        assetId: null,
        provider: null,
        context: context || null,
        folder,
        error,
      };
    }
  };

  return { uploadImage };
}

export default useImageUploadLocal;
