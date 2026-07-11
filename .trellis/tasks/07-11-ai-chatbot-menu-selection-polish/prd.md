# AI chatbot menu selection polish

## Current behavior

After a menu recommendation, choosing `Chọn món` expands the chatbot to 760 px and renders the configuration form below the previous conversation. The selected dish has weak hierarchy, technical-looking availability feedback, dense controls, mixed blue/orange styling, and the chat composer remains visually competitive with the add-to-cart task.

## Root cause

The ordering flow is functionally present in `AiChatbotWidget.jsx`, but the late menu-detail styles in `AiChatbotWidget.scss` still use an older blue utility-card treatment. Existing global chatbot overrides focus on inline suggestions and do not define a focused selected-item state.

## End-to-end flow traced

`AskAiChatbotInput/pageContext schema -> aiChatbot resolver -> restaurantChatbotReviewed.service -> restaurantChatbot.service -> restaurantChatbotCore.service intent/context/provider -> AiChatbotWidget sendMessage -> menu source card -> selected item queries -> menuItemLiveState -> addCartItem -> CartProvider -> selected-item UI`.

For the sample question `nay coi đá banh, có gì ăn ngon ngon k`:

1. The frontend sends the message, current pathname, restaurant scope when available, user role and recent history.
2. Core keyword classification recognizes `ăn` and `ngon` as `menu` intent.
3. Restaurant scope is resolved from the page/selected item; on the home page it remains global unless a restaurant can be resolved.
4. Available menu items are queried from MongoDB, preference scoring/ranking is applied, then Gemini receives only verified context.
5. The response is normalized into safe menu sources/actions; the widget replaces a long menu answer with compact copy and renders `Chọn món` cards.
6. Selecting a source fetches the real menu item, restaurant ordering state and live stock before enabling `Thêm vào giỏ`.

## Base content/configuration review

The chatbot already has three content layers:

- a fixed safety/system instruction in `restaurantChatbotCore.service.js`;
- dynamic verified context for restaurant, menu, coupon, order, reservation, cart, page and role;
- restaurant-editable knowledge items through the AI knowledge GraphQL API and manager knowledge page.

Restaurant settings also configure welcome text, starter questions, handoff and fallback behavior. This task does not change those contracts.

## Scope

- Add one late-loaded CSS layer for the selected-menu state.
- Use the existing COHAN orange/warm-neutral design language.
- Reduce the selected panel width, constrain prior messages, emphasize item/price/options/quantity/note/status and make the primary cart action obvious.
- Hide the chat composer only while configuring a selected dish so the user has one main task.
- Improve keyboard focus, pressed/disabled states, mobile layout and reduced-motion behavior.
- Preserve all queries, mutations, restaurant scope, live stock checks, cart behavior and feedback controls.

## Files

- `src/styles/AiChatbotMenuSelectionPolish.css`: focused selected-menu presentation and responsive states.
- `src/main.jsx`: import the late override after existing AI styles.

## Acceptance criteria

1. Selecting a recommended dish displays a clear focused configuration panel rather than a stretched utility card.
2. Dish name, price, serving option, quantity, note, availability and primary action have an obvious reading order.
3. The composer and unrelated suggestion actions do not compete with the selected-dish task.
4. Buttons have at least 44 px touch targets and visible focus/disabled/pressed states.
5. The selected state does not overflow at 390x844 or 430x932.
6. Existing GraphQL/menu/cart logic remains unchanged.

## Validation plan

- Static review against `AiChatbotWidget.jsx`, `AiChatbotWidget.scss`, `AiChatbotWidgetInlineSuggestions.css` and current component tests.
- Targeted `AiChatbotWidget.basic.test.jsx` run when an execution environment is available.
- `npm run build` when an execution environment is available.
- Browser checks at 390x844, 430x932, 1024 and 1440 px when a runtime is available.

## Out of scope

- Changing recommendation ranking, Gemini prompts, GraphQL schema or MongoDB queries.
- Automatically adding a dish without user confirmation.
- Replacing the existing chatbot component or adding a UI dependency.
