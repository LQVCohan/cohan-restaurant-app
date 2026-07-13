const HERO_FOOD_VISUALS = [
  {
    src: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1100&q=88",
    alt: "Mâm món Việt giao nhanh",
  },
  {
    src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1100&q=88",
    alt: "Pizza nóng hổi",
  },
  {
    src: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1100&q=88",
    alt: "Món ăn tươi ngon",
  },
];

const HERO_IMAGE_SELECTOR = ".hero__slider .hero__main-img";
const HERO_VISUAL_STYLE_ID = "cohan-hero-food-visual-guard";

export const getHeroFoodVisual = (index = 0) => {
  const normalizedIndex = Number.isFinite(Number(index))
    ? Math.abs(Math.trunc(Number(index))) % HERO_FOOD_VISUALS.length
    : 0;

  return HERO_FOOD_VISUALS[normalizedIndex];
};

const toAbsoluteUrl = (src) => {
  try {
    return new URL(src, document.baseURI).href;
  } catch {
    return src;
  }
};

const ensureGuardStyle = () => {
  if (document.getElementById(HERO_VISUAL_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = HERO_VISUAL_STYLE_ID;
  style.textContent = `
    ${HERO_IMAGE_SELECTOR}:not([data-hero-food-visual-locked="true"]) {
      opacity: 0 !important;
    }
  `;
  document.head.appendChild(style);
};

const syncHeroImages = () => {
  const images = Array.from(document.querySelectorAll(HERO_IMAGE_SELECTOR));

  images.forEach((image, index) => {
    const visual = getHeroFoodVisual(index);
    const expectedSrc = toAbsoluteUrl(visual.src);
    const isActive = image.classList.contains("active");
    const expectedAlt = isActive ? visual.alt : "";

    if (image.src !== expectedSrc) {
      image.src = visual.src;
    }
    if (image.alt !== expectedAlt) {
      image.alt = expectedAlt;
    }
    if (image.dataset.heroFoodVisualLocked !== "true") {
      image.dataset.heroFoodVisualLocked = "true";
    }
  });
};

export const installHeroFoodVisualGuard = () => {
  if (
    typeof document === "undefined" ||
    typeof MutationObserver === "undefined"
  ) {
    return () => {};
  }

  ensureGuardStyle();

  let syncQueued = false;
  const queueSync = () => {
    if (syncQueued) return;
    syncQueued = true;

    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (callback) => Promise.resolve().then(callback);

    schedule(() => {
      syncQueued = false;
      syncHeroImages();
    });
  };

  const observer = new MutationObserver((mutations) => {
    const requiresSync = mutations.some((mutation) => {
      if (mutation.type === "childList") {
        return mutation.addedNodes.length > 0;
      }

      if (
        mutation.type === "attributes" &&
        mutation.target instanceof HTMLImageElement &&
        mutation.target.matches(HERO_IMAGE_SELECTOR)
      ) {
        return true;
      }

      return false;
    });

    if (requiresSync) queueSync();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "alt", "class"],
  });

  queueSync();

  return () => observer.disconnect();
};
