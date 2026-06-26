# GSAP Timeline Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill when homepage or customer UI motion needs a sequence: hero copy, visual area, section cards, modal entrance, or multi-step storytelling.

## Rules for this project

- Prefer one timeline for related entrance motion instead of chained timeouts.
- Use labels and relative positions like `<0.1`, `+=0.1`, or `-=0.2` when sequencing UI.
- Keep timelines scoped with `gsap.context()` and reverted on cleanup.
- Do not delay actions that should feel instant, such as search, cart, booking, or navigation.
- Do not use timeline callbacks to change React state unless there is a clear user-visible need.

## Recommended pattern

```js
const tl = gsap.timeline({ defaults: { duration: 0.5, ease: 'power3.out' } });
tl.from('.hero__badge', { autoAlpha: 0, y: 16 })
  .from('.hero__title', { autoAlpha: 0, y: 20 }, '<0.08')
  .from('.hero__search-box', { autoAlpha: 0, y: 16 }, '<0.08')
  .from('.hero__image-area', { autoAlpha: 0, x: 32, scale: 0.96 }, '<0.05');
```
