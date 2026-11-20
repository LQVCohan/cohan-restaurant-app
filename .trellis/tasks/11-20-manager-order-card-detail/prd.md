# Manager orders, phase 3

Put identity, waiting time, and one primary action first on the card. Ordinary priority, long notes and full item modifiers take space today, and remote pending orders present two details controls for the same modal. Keep the actionable alerts, preview up to two item lines, and give keyboard users explicit controls for order and item details. In the detail dialog, show customer, order type, payment and delivery facts before items, with totals, timeline and tracking available below. Keep all existing mutation handlers, proof checks, permissions, and kitchen actions.

The Order model feeds the scoped ordersByRestaurantNow resolver and the order-by-id resolver (ORDER_READ per restaurant). The list Apollo operation and useOrderManagement detail hook populate OrderCard and OrderModal via the existing OrderManagementCore callbacks. Status changes, rejection, item supervision and printing continue through the same guarded mutations and refresh handlers.

- OrderCard.jsx and OrderCard.scss update card hierarchy and interaction; OrderDashboardScaleFix.css drops the manager card minimum height.
- orderIdentity.js provides consistent customer and order type labels to both views.
- OrderModal.jsx and OrderModal.scss group facts and promote the item list, with a compact total and print footer.
- OrderCard.test.jsx and OrderModal.test.jsx cover preserved actions and new detail paths.
- Verify through targeted component tests, GraphQL plus production build, and Chromium with mocked orders.

- OrderManagementCore.jsx and useOrderManagementLegacy.js request the modifier labels used by the detail dialog. The single order query also requests the order type and customer identity used in the list. The OrderItem field resolver returns an empty modifier list for historical orders without that array, matching the existing non-null contract.

## Verification

- 45 order tests passed. The known discount metadata source assertions were excluded as in phase 2, and the full repository suite was not run.
- Conflict scan, GraphQL schema/resolver and 740 static operation checks, and a legacy modifier resolver check passed.
- Chromium with mocked GraphQL passed at 375, 390, 768, 1024 and 1440 px plus dark mode at 390 px. Verified long codes, shortened previews, complete details and modifier labels, keyboard focus trapping and restoration, deep links, and the remote confirmation mutation inputs. Checked the final compact detail sizing again in both modes at 390 px.
- Live mutations were not run.
- Production build passed for the final patch.
