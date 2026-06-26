# GSAP Utils Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill when motion code needs utility helpers such as `gsap.utils.toArray`, `clamp`, `mapRange`, `random`, `snap`, `wrap`, or `selector`.

## Rules for this project

- Use `gsap.utils.toArray` for stable element lists inside a scoped root.
- Prefer utilities over custom helper code when GSAP already provides the behavior.
- Keep utility use readable; do not turn simple selectors into clever abstractions.
- Use utilities to keep homepage animation deterministic and easy to debug.

## Examples

- Convert a NodeList into an array before stagger animation.
- Clamp pointer effects so cards do not move too far.
- Map scroll or pointer input to a small transform range.
