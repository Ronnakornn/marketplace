# Platform configuration

Only the closed keys `maintenance_mode`, `checkout`, `chat`, `reviews` and `promotions` are admitted through FeatureToggle administration. GLOBAL has no scope ID. SHOP and USER require an existing scope ID. User switches override shop and global switches for ordinary features. Every shop in checkout must be admitted. Any matching enabled maintenance switch activates maintenance.

The global request guard consumes configuration on actual requests. It derives shop identity from stored product, purchased order item, review and chat records. Checkout also calls `requireFeature('checkout', { userId, shopIds })` after authoritative cart selection in its owning service. Maintenance exemptions preserve health, auth, admin, verified payment webhooks and existing settlement operations. Configuration read errors fail closed for new admission.

Typed SystemSetting keys are `catalog.approvalRequired`, `payment.channels`, `notifications.delivery` and `platform.defaults`. Direct publication is the default. Bank transfer admission and SMS delivery remain disabled until verified adapters exist. Values contain configuration only, without credentials. Generic legacy setting writes must reject reserved keys without version information. `validateManagedSetting` allows the legacy service to recognize and validate reserved keys.

Settings, toggles and templates compare `expectedVersion` to the previous `updatedAt` ISO instant. A missing record uses null. Writes use PostgreSQL transaction advisory lock `719362805` and create audit records in the same transaction. Team mutations retain their own shared advisory lock.

The catalog consumes `publicationApprovalRequired()`. Checkout consumes `requirePaymentChannel()`. Notification delivery consumes `deliveryConfig()` and `renderNotification()`. The renderer uses active channel/locale templates, validates placeholders and resolves the configured default language. Supported variables are name, orderNumber, shopName, trackingNumber and supportTicketNumber. Template persistence does not enable an unconfigured provider.
