import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 760px)";

const getMatches = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);

    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return isMobile;
}
