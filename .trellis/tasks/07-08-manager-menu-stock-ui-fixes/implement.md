# Implement — Manager menu stock UI fixes

## Thay đổi dự kiến

1. `MenuItemCard.jsx`: chuẩn hóa inventory status, hiển thị số suất và class khi dropdown mở.
2. `MenuItemCard.test.jsx`: kiểm tra số suất được render và handler trạng thái vẫn hoạt động.
3. `MenuManagementCardCompactFix.scss`: bỏ clipping ở card, giữ clipping ở vùng con và nâng z-index khi menu mở.
4. `CategoryModal.jsx`: chuyển sang `Modal.Header`/`Modal.Body`, thêm search semantics và nút xóa.
5. `CategoryModalPolish.scss`: style outer modal/body thật, category content và search compound control.
6. `Toolbar.jsx`/`Toolbar.scss`: thống nhất search control.
7. `MenuItemModal.jsx`: dispatch điều hướng đến `inventory`.

## Validation nhỏ nhất

- Targeted Vitest cho `MenuItemCard.test.jsx`.
- `npm run check:conflicts`.
- `npm run check:graphql` vì luồng đã được trace nhưng contract không đổi.
- `npm run build`.
- Browser smoke: card dropdown, group modal list/form, search focus/clear, nút định lượng; desktop và 390×844/430×932.
