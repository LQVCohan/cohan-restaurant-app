# Design — QR table companion

## Direction

The scanner should feel like a small host stand inside COHAN: warm ivory paper, dark forest framing, restrained burnt-orange actions and one clear camera aperture. It should look operational and trustworthy rather than like a generic neon scanner.

## Layout

- A concise introduction explains the outcome: scan the code placed on the current table.
- The camera surface is the primary visual object with a quiet frame, four corner markers and a single scan line.
- Trust and privacy copy sits next to the scanner on desktop and below it on mobile.
- Manual entry remains visible as a fallback, not hidden behind a modal.
- The existing table-session page uses the same surface, type and color tokens so the handoff feels continuous.

## Interaction

- Camera starts only from an explicit button and stops when the user leaves or scanning succeeds.
- Scanner feedback is announced politely; invalid QR feedback is an alert.
- Only an internal table-session path is opened after validation.
- Mobile exposes scanning from the sticky header while keeping the 5-item bottom navigation unchanged.
- Motion uses opacity/transform only and is disabled for reduced motion.
