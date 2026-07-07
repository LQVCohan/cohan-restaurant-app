# Implementation

1. Keep the existing restaurant-scoped active-promotion query and table mutation unchanged.
2. Reuse the repository's installed runtime-enhancement pattern to add a labelled search field beside the rendered promotion list.
3. Normalize case and Vietnamese diacritics locally; do not add a dependency or server query.
4. Hide only non-matching labels so selected checkbox state remains intact.
5. Add one focused unit test, then run that test and the frontend build.
