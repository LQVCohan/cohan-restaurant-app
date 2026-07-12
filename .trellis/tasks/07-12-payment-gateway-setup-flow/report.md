# Payment gateway setup flow report

## Result

The manager payment gateway page now contains a complete VNPAY onboarding flow instead of only a credential form.

- Displays the exact VNPAY IPN URL and Return URL with copy actions.
- Warns when the backend origin is localhost or private and cannot receive callbacks.
- Explains the four steps from merchant registration to sandbox verification and activation.
- Uses the same public-origin resolver for setup instructions, customer orders, reservation deposits and wallet top-ups.
- Saving a credential now synchronizes the restaurant provider mode/active state on the backend; the frontend no longer chains a second settings mutation.
- If provider-setting synchronization fails, the new credential version is disabled and the previous active credential is restored.
- Wallet top-up sessions without a restaurant bind to the declared platform credential mode.

## Flow after the change

`Manager selects restaurant -> copies Return/IPN URLs -> registers them with provider -> enters credential/mode -> save credential + enable provider -> public config exposes provider -> customer selects VNPAY -> PaymentSession binds credential -> VNPAY return/IPN -> verified settlement`

## Validation

Focused tests were added/updated for callback-origin resolution, setup URL generation, frontend setup rendering, one-mutation credential save and wallet platform-mode binding.

The tests and builds were not executed in the available environment because the repository could not be cloned locally due DNS resolution failure. No live VNPAY sandbox transaction was performed.
