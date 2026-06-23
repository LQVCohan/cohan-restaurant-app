---
name: figma-implement-design
description: >
  Translate Figma designs into production-ready code with visual fidelity. Use when the user provides
  a Figma URL, asks to implement a Figma component/frame, or wants UI code to match a design spec.
source: https://github.com/openai/skills/blob/main/skills/.curated/figma-implement-design/SKILL.md
---

# Figma Implement Design

Use this skill only when the deliverable is code in this repository. If the task is editing the Figma canvas itself, this skill is not enough.

## Workflow

1. Extract the Figma file key and node id from the supplied URL, or use the selected node if a Figma MCP server exposes it.
2. Fetch design context: layout, typography, colors, spacing, components, variants, and assets.
3. Capture a screenshot/reference image and keep it as the visual source of truth.
4. Map the Figma output to this repo's framework and conventions. Do not paste generated Tailwind/React blindly if the project uses existing SCSS/CSS/component patterns.
5. Use real Figma assets when provided. Do not add icon packages or placeholder art for assets that already exist in the Figma payload.
6. Implement responsive, interaction, empty/loading/error, keyboard, and focus states.
7. Compare the result against the screenshot and fix visible mismatches before finalizing.

## Repo rules

- Reuse existing components and design tokens first.
- Keep changes near the screen/component being implemented.
- Document any intentional visual deviation from Figma.
- If Figma tooling is unavailable, ask for screenshots/specs or clearly state the limitation.
