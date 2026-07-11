# Redesign customer home recommendations

## Current behavior

The desktop customer homepage renders **Món phù hợp với bạn** as a plain header followed by a basic equal-column card grid. When only two recommendations are available, the cards occupy a small area on the left while the rest of the shared homepage container remains visually empty. The primary and secondary actions float separately on the right, the section does not feel connected to the warmer premium homepage system, and each card uses a mouse-only `article onClick` interaction.

## Root cause

`HomeForYouSection.scss` contains only minimal isolated rules. It does not define a composed section surface, responsive card sizing based on available width, robust card hierarchy, pressed states, or reduced-motion behavior. `HomeForYouSection.jsx` also uses decorative emoji badges and a non-semantic clickable article instead of the installed Lucide icon language and a native navigation link.

## End-to-end flow checked

1. `cohan-restaurant-backend/graphql/schema/menu.graphql` exposes `MenuItem` and `topMenuItems` fields used by recommendations.
2. `cohan-restaurant-backend/graphql/resolvers/menu/query.js` returns public, orderable items scoped by restaurant and current time slot.
3. `src/hooks/useForYouRecommendations.js` loads accessible restaurants in parallel, combines menu items, applies preference/behavior ranking, and exposes recommended or fallback items.
4. `HomeForYouSection.jsx` limits the result to six items, records view/click analytics and behavior signals, then navigates to food detail.
5. `Home.jsx` mounts the section between restaurant results and the featured dish grid.
6. `HomePremiumPolish.scss` provides the shared 1080px warm homepage container; `HomeForYouSection.scss` is the visual root cause.

The schema, resolver, recommendation ranking, analytics, restaurant scoping, and navigation contract are correct and remain unchanged.

## Visual direction

Warm editorial recommendation spotlight using the existing orange/cream homepage palette, one obvious primary CTA, a composed shared surface, and responsive food cards with a single subtle image-lift interaction.

## Scope

- Recompose the section header, supporting copy, actions, recommendation cards, badges, and loading skeleton.
- Use existing Lucide icons and homepage color/spacing patterns; add no dependency or abstraction.
- Replace mouse-only card interaction with semantic React Router links while preserving click analytics and detail state.
- Make one, two, or more recommendations fill the available container cleanly without horizontal overflow.
- Preserve current loading/error/empty visibility decisions and recommendation behavior.

## Acceptance criteria

- The section reads as one coherent premium block aligned with adjacent homepage sections.
- Two recommendations no longer look like tiny isolated cards with a large accidental empty area.
- Food name, restaurant, price, recommendation reason, and warning state have clear hierarchy.
- Card navigation works with mouse, keyboard, Ctrl/Cmd-click, and visible focus.
- Primary and secondary actions remain clear at desktop/tablet widths and stack cleanly on narrow widths.
- Images reserve layout space, long names truncate safely, and price figures do not shift.
- Hover/pressed motion uses transform/opacity and reduced-motion users receive a static experience.
- No schema, resolver, hook ranking, analytics event, permission, dependency, or route contract changes.

## Out of scope

- Recommendation algorithm changes.
- Cart actions inside recommendation cards.
- Homepage-wide redesign or changes to `DishGrid`.
- New design system tokens, shared card abstraction, icon library, or package.
- Backend tests or schema changes.

## Validation plan

- Run the narrowest lint/test command covering `HomeForYouSection` if one exists.
- Run the frontend build.
- Review the final JSX/SCSS for semantic controls, visible focus, reduced motion, image dimensions, and overflow at 768/1024/1440px; compare 390x844 and 430x932 when a browser environment is available.
