# Report traceability

`PR` means this branch changes the root-cause boundary. `Current main` means the reported behavior is already implemented on the audited base commit and this PR deliberately does not duplicate it.

| # | Report outcome | Resolution | Primary evidence |
|---:|---|---|---|
| 1 | KDS/order detail, immediate item cancellation and reason | PR | `OrderManagement.jsx`, `OrderModal.jsx` |
| 2 | Correct dish-detail title and plain wording | PR | `ItemModal.jsx` |
| 3 | Compact order history/detail | Current main | `HistoryModal.jsx`, `OrderBillModal.jsx` |
| 4 | New-order table lookup and compact chooser | Current main | `NewOrderModal.jsx` table search/filter |
| 5 | Named menus no longer overwrite sibling menus in one slot | PR | `ManagerMenuCatalogModal.jsx` |
| 6 | Menu-management entry points are discoverable | Current main | manager menu command/header actions |
| 7 | Quick stock accepts a subset of displayed rows | PR | `QuickStockModal.jsx` |
| 8 | Linked customers appear in overview and a dedicated tab only | PR | `installTableDetailModalTabs.js` |
| 9 | Table detail uses focused tabs instead of one long surface | Current main + PR | table-detail tab installer and styles |
| 10 | Floor designer preserves generated table identity/names | Current main | `FloorPlanDesigner.jsx` persistence path |
| 11 | Restaurant page reuses cached identity/detail data to avoid blank remounts | PR | `RestaurantInfoManagement.jsx`, `ManagerLayout.jsx` |
| 12 | Current-location action sits beside a smaller map | PR | restaurant map enhancement and premium layout |
| 13 | Restaurant save failures use friendly shared notifications | PR | `RestaurantInfoManagement.jsx` |
| 14 | Staff detail is separated into focused sections/tabs | Current main | staff management detail components |
| 15 | Staff actions use contained modal flows | Current main | employee action/edit modals |
| 16 | Attendance actions use compact operational panels | Current main | attendance page and compact policy styles |
| 17 | Leave creation uses the shared modal and a three-step compact flow | Current main | `StaffLeavePage.jsx`, `LeaveRequestForm.jsx` |
| 18 | Leave dates satisfy the GraphQL `DateTime` contract and hide scalar errors | PR | `useLeaveManagement.js`, `LeaveRequestForm.jsx` |
| 19 | Schedule distinguishes staff type and working availability | Current main | schedule management/staff schedule pages |
| 20 | Staff shell exposes Home and authorized Manager destinations | PR | `StaffLayout.jsx`; logout storage clearing already in `authStorage.ts` |
| 21 | Staff workspace renders scoped content instead of the broken fallback | Current main | `StaffLayout.jsx` and staff route tests |
| 22 | Payroll shows saved configuration summary and loads values into controls | Current main | `PayrollSettingsControl.jsx` |
| 23 | Collapsed sidebar scrolls and expansion reveals the active item | PR | `Sidebar.jsx`, `SidebarShellFix.scss` |
| 24 | Recent customer orders open the selected bill/order detail | Current main | `CustomerModal.jsx`, `CustomerManagement.jsx` |
| 25 | Add-customer submit remains in the modal footer and visible | Current main | `AddCustomerModal.jsx` |
| 26 | Password-free customer capture uses the safe guest flow; registered users retain verification/password hashing, history and rank filters | Current main | `AddCustomerModal.jsx`, user resolver/model, customer query/filter flow |
| 27 | Customer analytics actions target the selected cohort/data | Current main | `CustomerAnalyticsPage.jsx`, manager navigation event |
| 28 | Promotion modal is portalled, viewport-safe and scroll-contained | PR | `PromotionModal.jsx/.scss` |
| 29 | Promotion labels and priority explanation are Vietnamese | PR | `PromotionModal.jsx` |
| 30 | Promotion date preview uses Vietnamese locale formatting | PR | `PromotionModal.jsx` |
| 31 | Displayed promotion conditions are derived from enforceable fields | PR | `PromotionModal.jsx` |
| 32 | Promotion non-null/GraphQL failures become a stable user-facing error | PR | `usePromotions.js` |
| 33 | Customer restaurant/dish surfaces use queried image/review data | Current main | restaurant detail, homepage dish and review queries |
| 34 | Review actions avoid browser alerts and show in-product feedback | Current main | customer review flow and manager review notification state |
| 35 | Review submission uses a contained, validated flow | Current main | `ReviewsSection.jsx` and flow tests |
| 36 | Review management uses responsive list/filter/detail surfaces | Current main | `ReviewManagement.jsx` and component tests |
| 37 | AI handoff appears only after a completed fallback/suggestion or a slow response | PR | `AiChatbotWidget.jsx` |
| 38 | Customer availability text replaces `FCFS` with plain Vietnamese | PR | `FoodAvailabilityWatchPanel.jsx` |
| 39 | Multi-restaurant/customer choice strips support horizontal containment | Current main | customer list/home/table-booking responsive styles |
| 40 | Customer menu header remains compact/responsive | Current main | `MenuDetailView.jsx` and polish styles |
| 41 | Single-choice items resolve automatically; multi-choice items stay explicit before cart add | Current main | `MenuItemCard.jsx`, `CartProvider.jsx`, table-order experience |
| 42 | Customer menu/cart surfaces use compact cards and rows | Current main | restaurant menu and booking-dishes modal styles |
| 43 | Reservation overlap, table labels, QR check-in and occupied transition are enforced | Current main | reservation service/resolvers and customer history |
| 44 | Zero deposit is treated/displayed as no charge | Current main | booking/payment summary and reservation tests |
| 45 | Reservation invoice is compact and data-driven | Current main | customer order/reservation invoice surface |
| 46 | Change-time dialog uses the compact review flow | Current main | reservation change review components |
| 47 | Change-table dialog uses the compact review flow | Current main | reservation change review components |
| 48 | A future/pre-service table remains non-occupied until POS accepts the first QR batch | PR | session bootstrap, public submit, `confirmedOrderPrintMutation.js` |
| 49 | Manager table view supports floor/status filtering | Current main | table management/floor selector flow |
| 50 | An unopened valid QR always offers “Gọi nhân viên” | PR | `TableCurrentSessionPage.jsx`, public table access guard |
| 51 | Single-table cards retain their grid/container contract | Current main | table-management final QC styles/tests |
| 52 | Payment/support errors are actionable and requests appear in the POS queue | Current main + PR | table session feedback and `CustomerRequestQueuePanel.jsx` |
| 53 | Preparation/serving mode is explicit and a single option is auto-selected | Current main | menu item/cart/table order normalization |
| 54 | Dish/cart cards use the compact customer layout | Current main | menu item and order summary styles |
| 55 | Public QR can call staff/request ordering pre-service; POS acceptance starts occupancy and events refresh only operational queues | PR | public session/access/payment resolvers, POS queue, table session UI |

## Regression coverage added or updated

- Manager menu sibling slots, quick-stock subset submission, table customer tab visibility, restaurant location/save feedback, sidebar history and staff portal links.
- Immediate item cancellation reason/payload, promotion derived conditions/portal accessibility, leave `DateTime` serialization and AI handoff timing.
- Pre-service QR bootstrap, public access capability, call-staff guard, transaction occupancy timing and POS acceptance transition.
