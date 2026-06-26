# GSAP Performance Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill when reviewing animation smoothness, jank, layout shifts, scroll performance, or repeated list/card animations.

## Rules for this project

- Animate transform and opacity first: `x`, `y`, `scale`, `rotation`, `autoAlpha`.
- Avoid animation of layout properties like `width`, `height`, `top`, `left`, `margin`, and `padding`.
- Use `will-change` only while an animation is active, then clear it.
- Use `overwrite: 'auto'` to prevent competing tweens on the same target.
- Prefer batching or IntersectionObserver for lists instead of animating every element on every render.
- Keep homepage motion light on mobile.
- Respect `prefers-reduced-motion`.

## Checklist

- No animation should block search, cart, checkout, booking, or restaurant navigation.
- Newly fetched restaurants/dishes can animate in, but repeated renders should not re-run heavy timelines.
- If animation fails, content must remain visible.
