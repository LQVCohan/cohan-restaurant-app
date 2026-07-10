# Table detail modal tabs

## Current behavior

`TableActionsLiteModal` renders summary, editable configuration, immediate operational actions, booking settings, 360 content, AI suggestions, and destructive actions in one long scrolling form. Users cannot quickly distinguish actions that apply immediately from fields that require the footer save button.

## Flow

`Table` model -> GraphQL table contract -> `useTableManagement` -> `TableManagement` resolves the latest table by ID -> `TableActionsLiteModal` renders existing fields and actions -> frontend enhancement groups the rendered sections without changing mutations.

## Scope

- Add five navigation tabs: Tổng quan, Cấu hình, Vận hành, Đặt bàn, Gợi ý AI.
- Keep the table summary visible as context.
- Show the status section in Tổng quan and Vận hành.
- Show `Lưu cấu hình` only for tabs containing persisted form fields.
- Explain whether the current tab saves immediately or requires the footer action.
- Preserve all current permissions, guards, loading states, draft behavior, mutation handlers, and nested 360/3D flows.
- Make the modal full-screen and horizontally scrollable at the tab bar on narrow phones.

## Acceptance criteria

- Opening the modal defaults to Tổng quan.
- Each tab exposes only its relevant direct sections.
- Operational actions continue to call the existing handlers immediately.
- Configuration and booking changes continue to use the existing save handler.
- Keyboard users can switch tabs with arrow, Home, and End keys.
- No new dependency is added.

## Out of scope

- Backend, schema, resolver, or Apollo changes.
- Redesigning the nested camera/3D modal.
- Changing table status transition rules.
