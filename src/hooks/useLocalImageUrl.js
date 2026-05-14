import { useEffect, useState } from "react";
import {
  createLocalImageObjectUrl,
  isLocalImageUri,
  LOCAL_IMAGE_VARIANTS,
} from "../utils/localImageStore";

const useLocalImageUrl = (src, variant = LOCAL_IMAGE_VARIANTS.PREVIEW) => {
  const [resolvedSrc, setResolvedSrc] = useState(src || "");
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let objectUrl = null;

    const resolve = async () => {
      setError(null);

      if (!src) {
        setResolvedSrc("");
        setIsResolving(false);
        return;
      }

      if (!isLocalImageUri(src)) {
        setResolvedSrc(src);
        setIsResolving(false);
        return;
      }

      setIsResolving(true);
      try {
        objectUrl = await createLocalImageObjectUrl(src, variant);
        if (!isMounted) return;
        setResolvedSrc(objectUrl || "");
      } catch (err) {
        if (!isMounted) return;
        setResolvedSrc("");
        setError(err);
      } finally {
        if (isMounted) setIsResolving(false);
      }
    };

    resolve();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, variant]);

  return { src: resolvedSrc, isResolving, error };
};

export default useLocalImageUrl;
