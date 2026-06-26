# GSAP ScrollTrigger Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill only when scroll-linked animation is truly needed: pinning, scrubbed motion, section reveal, or scroll progress effects.

## Rules for this project

- Do not add ScrollTrigger for simple homepage entrance motion; use core GSAP plus IntersectionObserver first.
- Register plugins once if importing from the npm package.
- Refresh ScrollTrigger after layout-changing data loads.
- Clean up triggers on unmount.
- Avoid scroll effects that make ordering, menu, checkout, or booking harder to use.
- Respect `prefers-reduced-motion` and mobile performance.

## When not to use

- Basic fade-up cards.
- Button press feedback.
- Simple modal enter/exit.
- Any motion that can be done with core GSAP and observer-based reveals.
