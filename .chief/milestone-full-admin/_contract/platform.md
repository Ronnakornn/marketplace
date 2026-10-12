# Administrative contracts

- Existing unrelated work is the baseline. Root owns Prisma/migrations, shared authorization contract, container/index, locale merging and final integration.
- Permissions use the closed registry in admin-access.contract.ts. Every legacy admin endpoint must pass the same server permission decision. Missing or inactive membership denies access after the migration bootstraps existing administrators as owners.
- New domain services accept AdminAuthorizer and check their operation permission. UI uses Eden inferred response types and TanStack Query.
- Existing domain services retain inventory, payment, refund, payout and wallet writes. Payment evidence never marks a payment successful. Refund/payout completion retains distinct administrators, original amounts and references.
- Shop commission is resolved at checkout commitment and frozen into existing sale snapshots. Default publication remains direct unless an admin enables preapproval.
- All money remains bigint internally and canonical minor-unit strings over HTTP. Reports define their time grain and funding/commission figures; contribution is not mislabeled as complete business profit.
- CSV/XLSX inputs are bounded and formulas rejected. Exports preserve exact monetary digits and protect formula-like text. Use fflate and fast-xml-parser for bounded standard OOXML; ExcelJS installation was unavailable.
- All writes audit in the transaction. Versioned settings/membership updates reject stale saves. Scheduled exports and payout cycles have database retry identities.
- Root schema includes AdminTeamMember, AdminAccessRule, ShopOperationPolicy, ShippingRateRule, FinanceReconciliation, ReportSchedule, ContentPage, CatalogImportJob and OrderDocument. Existing FeatureToggle, NotificationTemplate, ShippingProvider, MarketingBanner and ReportExportJob are reused.
