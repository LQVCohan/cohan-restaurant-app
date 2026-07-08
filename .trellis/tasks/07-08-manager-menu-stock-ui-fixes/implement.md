# Implement — Manager menu stock UI fixes

## Thay đổi đã thực hiện

1. `MenuItemCard.jsx`: chuẩn hóa inventory status, hiển thị số suất và class khi dropdown mở.
2. `MenuItemCard.test.jsx`: kiểm tra số suất, trạng thái hết nguyên liệu và handler trạng thái.
3. `MenuManagementPolish.scss`: bỏ clipping ở card, nâng z-index menu và đồng bộ search control.
4. `CategoryModal.jsx`: chuyển sang `Modal.Header`/`Modal.Body`, bỏ shell lồng, thêm search semantics và nút xóa.
5. `CategoryModalStructureFix.scss`: sở hữu layout modal thật và compound search control.
6. `main.jsx`: chuẩn hóa legacy hash `#storage` sang `#inventory`.

## Validation nhỏ nhất

- Targeted Vitest cho `MenuItemCard.test.jsx`.
- `npm run check:conflicts`.
- `npm run check:graphql` vì luồng đã được trace nhưng contract không đổi.
- `npm run build`.
- Browser smoke: card dropdown, group modal list/form, search focus/clear, nút định lượng; desktop và 390×844/430×932.
