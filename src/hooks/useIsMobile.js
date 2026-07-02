import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 760px)";

const getMediaQuery = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_QUERY)
    : null;

const getMatches = () => getMediaQuery()?.matches ?? false;

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    const media = getMediaQuery();
    if (!media) return undefined;

    const update = () => setIsMobile(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  return isMobile;
}
