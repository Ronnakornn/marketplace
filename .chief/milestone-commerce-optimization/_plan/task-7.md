# Task 7: translation payload

Owner: translation implementation agent. Files: app/i18n, locale/role layouts and directly relevant tests. Coordinate changes to product files owned by catalog agent.

Reduce public-route translation serialization by omitting admin/seller namespaces, while retaining required shared strings, missing-key English fallback, both languages, dynamic keys and client navigation between public/seller/admin. Prefer structural layout providers over selecting dictionary in a persistent parent from request pathname. Measure public serialized message bytes against the captured full dictionaries. No hardcoded UI strings or runtime JSON fetch drift.
