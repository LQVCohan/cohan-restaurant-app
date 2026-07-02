import { useEffect, useRef } from "react";
import loadGsapRuntime from "@/utils/gsapRuntime";

const HERO_TARGETS = [
  ".hero__badge",
  ".hero__title",
  ".hero__subtitle",
  ".hero__search-box",
  ".hero__stats",
];

const SECTION_TARGETS = [
  ".restaurant-grid__header",
  ".categories__header",
  ".dish-grid__header",
  ".how-it-works__header",
  ".footer-saas .footer-col",
];

const CARD_TARGETS = [
  ".res-card",
  ".categories__card",
  ".dish-card",
  ".dish-grid__fallback-card",
  ".how-it-works__card",
];

const DYNAMIC_ROOTS = [
  ".restaurant-grid__list",
  ".categories__grid",
  ".dish-grid__list",
  ".dish-grid__grid",
  ".dish-grid__fallback-grid",
  ".how-it-works__grid",
];

const PRESS_TARGETS = [
  ".hero__slider-btn",
  ".hero__btn-search",
  ".hero__btn-location",
  ".restaurant-grid__view-all",
  ".categories__view-all",
  ".dish-grid__view-all",
  ".res-card__btn",
  ".dish-card__btn-add",
  ".dish-grid__fallback-body button",
].join(", ");

const uniqueElements = (items) => [...new Set(items.filter(Boolean))];

const useGsapHomeMotion = () => {
  const rootRef = useRef(null);

  useEffect(() => {
    let isDisposed = false;
    let mediaContext = null;

    loadGsapRuntime()
      .then((gsap) => {
        if (!gsap || isDisposed || !rootRef.current) return;

        mediaContext = gsap.matchMedia();
        mediaContext.add("(prefers-reduced-motion: no-preference)", () => {
          const cleanupFns = [];
          const root = rootRef.current;
          if (!root) return undefined;

          const ctx = gsap.context(() => {
            gsap.defaults({ duration: 0.5, ease: "power3.out", overwrite: "auto" });

            const heroTargets = uniqueElements(
              HERO_TARGETS.flatMap((selector) => gsap.utils.toArray(selector))
            );
            const heroMedia = root.querySelector(".hero__image-area");

            gsap.set([...heroTargets, heroMedia].filter(Boolean), {
              willChange: "transform, opacity",
            });

            const intro = gsap.timeline({ defaults: { clearProps: "transform,opacity,visibility,willChange" } });
            intro
              .from(heroTargets, {
                autoAlpha: 0,
                y: 24,
                stagger: 0.055,
                duration: 0.5,
              })
              .from(
                heroMedia,
                {
                  autoAlpha: 0,
                  x: 34,
                  scale: 0.96,
                  duration: 0.62,
                },
                "<0.1"
              );

            const revealSelector = [...SECTION_TARGETS, ...CARD_TARGETS].join(", ");
            const revealTargets = uniqueElements(gsap.utils.toArray(revealSelector));

            const revealElement = (element, index = 0) => {
              if (!element || element.dataset.gsapHomeSeen === "true") return;
              element.dataset.gsapHomeSeen = "true";
              gsap.set(element, { willChange: "transform, opacity" });
              gsap.from(element, {
                autoAlpha: 0,
                y: 22,
                scale: 0.985,
                duration: 0.48,
                delay: Math.min(index * 0.035, 0.18),
                clearProps: "transform,opacity,visibility,willChange",
              });
            };

            if ("IntersectionObserver" in window) {
              const revealObserver = new IntersectionObserver(
                (entries) => {
                  entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    revealElement(entry.target);
                    revealObserver.unobserve(entry.target);
                  });
                },
                { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
              );

              revealTargets.forEach((element) => revealObserver.observe(element));
              cleanupFns.push(() => revealObserver.disconnect());
            } else {
              revealTargets.forEach(revealElement);
            }

            const dynamicRoots = uniqueElements(
              DYNAMIC_ROOTS.flatMap((selector) => gsap.utils.toArray(selector))
            );
            const cardSelector = CARD_TARGETS.join(", ");

            if (dynamicRoots.length > 0 && "MutationObserver" in window) {
              const listObserver = new MutationObserver((mutations) => {
                const addedCards = [];
                mutations.forEach((mutation) => {
                  mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    if (node.matches?.(cardSelector)) addedCards.push(node);
                    node.querySelectorAll?.(cardSelector)?.forEach((child) => addedCards.push(child));
                  });
                });

                const uniqueCards = uniqueElements(addedCards);
                if (!uniqueCards.length) return;
                gsap.set(uniqueCards, { willChange: "transform, opacity" });
                gsap.from(uniqueCards, {
                  autoAlpha: 0,
                  y: 20,
                  scale: 0.972,
                  duration: 0.4,
                  stagger: 0.035,
                  clearProps: "transform,opacity,visibility,willChange",
                });
              });

              dynamicRoots.forEach((element) => listObserver.observe(element, { childList: true }));
              cleanupFns.push(() => listObserver.disconnect());
            }

            const pressDown = (event) => {
              const target = event.target.closest?.(PRESS_TARGETS);
              if (!target || !root.contains(target) || target.disabled) return;
              gsap.to(target, { scale: 0.982, duration: 0.08, ease: "power2.out" });
            };

            const pressUp = (event) => {
              const target = event.target.closest?.(PRESS_TARGETS);
              if (!target || !root.contains(target) || target.disabled) return;
              gsap.to(target, {
                scale: 1,
                duration: 0.18,
                ease: "back.out(2)",
                clearProps: "transform",
              });
            };

            root.addEventListener("pointerdown", pressDown);
            root.addEventListener("pointerup", pressUp);
            root.addEventListener("pointercancel", pressUp);
            root.addEventListener("pointerleave", pressUp);
            cleanupFns.push(() => {
              root.removeEventListener("pointerdown", pressDown);
              root.removeEventListener("pointerup", pressUp);
              root.removeEventListener("pointercancel", pressUp);
              root.removeEventListener("pointerleave", pressUp);
            });
          }, root);

          return () => {
            cleanupFns.forEach((cleanup) => cleanup());
            ctx.revert();
          };
        });
      })
      .catch(() => {
        // Progressive enhancement: keep the page static if GSAP cannot load.
      });

    return () => {
      isDisposed = true;
      mediaContext?.revert();
    };
  }, []);

  return rootRef;
};

export default useGsapHomeMotion;
