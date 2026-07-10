# Table 3D responsive UI upgrade

## Current behavior

The manager table page opens the existing `Table3DSimulatorModal` wrapper, which hydrates any saved visual model and delegates rendering to `Table3DSimulatorModalV2`. The modal already contains the catalog, 3D viewer, model controls, AR readiness details, quick guide, camera/AR actions, and the existing apply/save callback.

On desktop, the effective presentation is produced by several global responsive files with overlapping `!important` rules. The viewer receives a fixed/clamped height while the surrounding panel also owns scrolling and sticky controls, which creates compressed vertical rhythm and makes the footer and supporting information feel crowded. On phones, multiple breakpoints disagree about content order, toolbar columns, footer positioning, and viewer sizing, so the workflow is longer and less predictable than necessary.

A screenshot follow-up after the first responsive pass exposed three remaining presentation defects: placeholder license strings such as `N/A - no external model` were treated as compact badges and escaped card bounds; the loading panel used percentage insets that covered most of the viewer; and the final repair stylesheet was imported before later table workflow/mobile styles.

## Root cause

The functional component flow is correct. The original root cause was CSS contract drift between `Table3DModalResponsive.css`, `Table3DModalHeaderCompact.css`, `Table3DModalWorkflow.css`, `Table3DToolbarMobileFix.css`, and the existing final repair pass. These files independently redefine the same modal grid, viewer height, mobile ordering, and action footer.

The follow-up overflow had two narrower causes: `getCompactBadges` accepted raw license labels returned by `getModelAssetBadges`, and the loading card inherited a large percentage-based inset. The stylesheet import order also meant `Table3DMainModalRepair.css` was not actually the final table-modal layer.

## End-to-end flow checked

1. `TableManagement` selects the current restaurant, floor, and optional concrete table.
2. `Table3DSimulatorModal` hydrates an already saved visual model and keeps the current `onApply` / `onSaveArPosition` behavior.
3. `Table3DSimulatorModalV2` loads the model catalog, selects a model, renders `model-viewer`, and composes catalog, toolbar, readiness, guide, and action bar components.
4. `Table3DCatalogPanel` only changes local model/filter selection state and renders compact display badges.
5. `Table3DActionBarV2` calls the existing camera, native AR, table-position, and apply callbacks.
6. No schema, resolver, service, Apollo operation, permission, audit log, or realtime side effect needs to change for this UI task.

## Files changed

- `src/components/Dashboard_Manager/Table/Table3DCatalogPanel.jsx`: restrict compact cards to short semantic status badges; license details remain in the expandable information section.
- `src/styles/Table3DMainModalRepair.css`: existing main desktop/mobile layout source of truth from the first pass.
- `src/styles/Table3DModalContentSafety.css`: final narrow overflow/loading safeguards without duplicating the full layout contract.
- `src/main.jsx`: load the main repair and content-safety styles after later table workflow/mobile styles.
- `.trellis/tasks/table-3d-responsive-ui-upgrade/task.json`: task status and implementation record.
- `.trellis/tasks/table-3d-responsive-ui-upgrade/prd.md`: scope, root cause, acceptance criteria, and validation record.

## Acceptance criteria

- Desktop uses a stable two-column workspace with a readable catalog, a viewer that consumes available height, and an action area that does not overlap or get clipped.
- Compact model cards never display raw license strings and their badges stay inside card bounds.
- The 3D loading state remains centered and compact instead of covering most of the viewer.
- The final table 3D styles load after other table workflow/mobile presentation layers.
- The viewer, toolbar, readiness section, quick guide, and action row have clear visual hierarchy and consistent spacing.
- Mobile uses a full-screen, single-scroll workflow with safe-area padding and no horizontal page overflow.
- Mobile presents model selection before the viewer, uses a horizontal model carousel, keeps touch targets at least 44px, and does not let sticky controls cover content.
- At 390x844 and 430x932, filters, model cards, viewer, controls, readiness, and actions remain usable without CSS zoom.
- Existing camera, AR, apply, close, loading, error, keyboard, and saved-model behavior remains unchanged.
- No dependency, GraphQL, backend, or data-contract change is introduced.

## Out of scope

- Replacing GLB/GLTF assets or the public model catalog.
- Changing model loading logic, AR capability detection, geofencing, or persistence.
- Redesigning nested camera, custom model builder, or AR placement modals.
- Adding new dependencies or a new design-system abstraction.

## Validation

- Reviewed the screenshot against the current component markup and the effective CSS import order.
- Re-fetched the latest caller and target files before each write.
- Confirmed the compact badge path now filters out license labels while the full license remains available in `Thông tin mô hình`.
- Confirmed the content-safety stylesheet is imported after `Table3DMainModalRepair.css` and all later table styles.
- Focused component tests, production build, 390x844/430x932 browser checks, and physical phone camera/WebXR validation were not run because the GitHub connector does not provide a runnable checkout or device session.
