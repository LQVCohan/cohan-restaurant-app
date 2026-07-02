const GSAP_CDN_URL = "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js";
const GSAP_SCRIPT_ID = "cohan-gsap-runtime";

let gsapRuntimePromise = null;

export const loadGsapRuntime = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  if (window.gsap) return Promise.resolve(window.gsap);
  if (gsapRuntimePromise) return gsapRuntimePromise;

  gsapRuntimePromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GSAP_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.gsap || null), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GSAP_SCRIPT_ID;
    script.src = GSAP_CDN_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.gsap || null);
    script.onerror = () => reject(new Error("Cannot load GSAP runtime"));
    document.head.appendChild(script);
  }).catch((error) => {
    gsapRuntimePromise = null;
    throw error;
  });

  return gsapRuntimePromise;
};

export default loadGsapRuntime;
