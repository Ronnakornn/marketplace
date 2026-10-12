-- Match JavaScript localeCompare, including Unicode-equivalent title/SKU ties.
-- Nondeterministic ICU comparison preserves ties for the explicit ID/date keys.
CREATE COLLATION "marketplace_locale_compare" (
    provider = icu,
    locale = 'en-US',
    deterministic = false
);
