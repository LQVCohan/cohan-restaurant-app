# Hide fake customer reservation delete action

## Problem
After the reservation contract fix, `deleteReservation` is deprecated and means `markReservationNoShow`; it does not delete a customer history item. The customer orders page can still pass a reservation action labelled `Xóa` into `OrderItem`, exposing a misleading action to customers.

## Flow traced
Reservation SDL exposes `markReservationNoShow` and deprecates `deleteReservation` -> reservation resolver aliases no-show behavior -> customer orders builds reservation actions -> `OrderItem` renders action buttons.

## Scope
- Do not change backend no-show behavior.
- Do not add a fake customer hide-history feature.
- Hide reservation delete/no-show action from customer order cards.

## Acceptance criteria
- Reservation cards in customer orders no longer render an action labelled `Xóa`.
- Existing customer actions such as `Hủy`, `Đổi giờ`, `Đổi bàn`, `Đặt lại bàn`, and receipts remain unaffected.
