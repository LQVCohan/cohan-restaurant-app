# GSAP Plugins Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill when a feature needs a GSAP plugin such as Flip, Draggable, Observer, ScrollToPlugin, SplitText, or MorphSVG.

## Rules for this project

- Do not add plugins by default; core GSAP is enough for most customer homepage motion.
- Add a plugin only when the requested interaction cannot be handled cleanly with core tweens/timelines.
- Keep plugin registration centralized and documented.
- Avoid plugins that increase bundle size without a clear user-facing benefit.
- For ordering, checkout, booking, and search flows, prioritize reliability over visual novelty.

## Candidate plugin use cases

- Flip: smooth layout changes for cards or menu categories.
- Observer: advanced pointer/touch gestures.
- ScrollToPlugin: controlled smooth scroll if native scroll is not enough.
- SplitText: headline text animation, only if it remains readable and accessible.
