# Design

## Direction

Compact restaurant operations UI using the existing sage surfaces, clear task grouping, native controls, and progressive disclosure. No new palette, dependency, or decorative AI treatment.

## Decisions

- Floor-plan codes are deterministic operational identifiers, not AI output. Preserve persisted names; generate only missing names from the active floor level and fill the first available sequence.
- Own the map in React. Initialize one Leaflet instance when the address panel mounts, keep coordinates in component state, and tear it down on unmount.
- Treat the mutation response as the write acknowledgement. Avoid an immediate read-after-write consistency gate that can be stale.
- Use three employee-detail tabs because they correspond to distinct manager questions: contact, work record, and account access.
- Keep the attendance correction path one form, but collapse optional evidence by default and pin actions to the bottom.
- Present attendance exceptions as a responsive two-column review queue, reverting to one column on narrow screens.
- In the compact manager leave modal, use one labelled native select for leave type. Keep the richer radio choices in the staff wizard where step-by-step selection is the primary task.

## Accessibility and responsive behavior

- Native buttons/selects, labelled inputs, tab/tabpanel relationships, visible focus, and 44px touch targets.
- Dialog actions remain reachable with internal scrolling and sticky actions.
- Map controls have accessible names; map remains a labelled region.
- Two-column layouts collapse at mobile breakpoints without horizontal overflow.
- Existing shared modal focus trap and Escape behavior remain in use for leave requests.
