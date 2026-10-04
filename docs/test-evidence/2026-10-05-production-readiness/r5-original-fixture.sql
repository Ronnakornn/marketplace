-- Synthetic pre-v2 records, not actual historical sale/provider evidence.
-- Run only in the explicitly created marketplace_test_readiness_upgrade_20261005 database.
BEGIN;
INSERT INTO "User" (id,name,email,"updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000001','Readiness buyer','readiness-upgrade-buyer@example.test',now()),
 ('d5100000-0000-4000-8000-000000000002','Readiness seller','readiness-upgrade-seller@example.test',now());
INSERT INTO "SellerProfile" (id,"userId","updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000003','d5100000-0000-4000-8000-000000000002',now());
INSERT INTO "Shop" (id,"ownerId","sellerProfileId",name,slug,"contactEmail","contactPhone",status,"updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000004','d5100000-0000-4000-8000-000000000002','d5100000-0000-4000-8000-000000000003','Readiness shop','readiness-upgrade','readiness-upgrade-seller@example.test','+66800000000','ACTIVE',now());
INSERT INTO "Product" (id,"shopId","sellerProfileId",title,slug,status,"updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000005','d5100000-0000-4000-8000-000000000004','d5100000-0000-4000-8000-000000000003','Exact historical value','readiness-upgrade-product','ACTIVE',now());
INSERT INTO "ProductVariant" (id,"productId",sku,title,price,"updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000006','d5100000-0000-4000-8000-000000000005','READINESS-UPGRADE','Original',9007199254740993,now());
INSERT INTO "Cart" (id,"userId","updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000007','d5100000-0000-4000-8000-000000000001',now());
INSERT INTO "Checkout" (id,"cartId","userId",subtotal,"grandTotal","expiresAt","updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000008','d5100000-0000-4000-8000-000000000007','d5100000-0000-4000-8000-000000000001',9007199254740993,9007199254740993,now() + interval '30 minutes',now());
INSERT INTO "Order" (id,"checkoutId","userId","orderNumber",status,"paymentStatus",subtotal,"grandTotal","shippingName","shippingLine1","shippingCity","shippingPostalCode","shippingCountry","updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000009','d5100000-0000-4000-8000-000000000008','d5100000-0000-4000-8000-000000000001','READINESS-UPGRADE-20261005','PAID','SUCCEEDED',9007199254740993,9007199254740993,'Synthetic buyer','Test fixture','Bangkok','10110','TH',now());
INSERT INTO "ShopOrder" (id,"orderId","shopId",status,subtotal,"grandTotal","updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000010','d5100000-0000-4000-8000-000000000009','d5100000-0000-4000-8000-000000000004','PAID',9007199254740993,9007199254740993,now());
INSERT INTO "OrderItem" (id,"orderId","shopId","variantId","productTitle","productSlug","variantTitle","variantSku","shopName","shopSlug",quantity,"unitPrice","lineTotal") VALUES
 ('d5100000-0000-4000-8000-000000000011','d5100000-0000-4000-8000-000000000009','d5100000-0000-4000-8000-000000000004','d5100000-0000-4000-8000-000000000006','Exact historical value','readiness-upgrade-product','Original','READINESS-UPGRADE','Readiness shop','readiness-upgrade',1,9007199254740993,9007199254740993);
INSERT INTO "Payment" (id,"orderId",provider,"providerIntentId",status,amount,currency,"updatedAt") VALUES
 ('d5100000-0000-4000-8000-000000000012','d5100000-0000-4000-8000-000000000009','fixture','readiness-upgrade-intent','SUCCEEDED',9007199254740993,'THB',now());
INSERT INTO "ShopSaleSnapshot" ("shopOrderId","policyVersion",currency,"commissionBase","commissionBps","originalCommission","originalShipping","buyerShipping","sellerShippingWaiver","platformShippingSubsidy") VALUES
 ('d5100000-0000-4000-8000-000000000010',1,'THB',9007199254740993,1000,900719925474099,0,0,0,0);
INSERT INTO "ItemSaleSnapshot" ("orderItemId","shopOrderId","originalQuantity","grossMerchandise","sellerCouponDiscount","platformCouponDiscount","coinDiscount","buyerMerchandise") VALUES
 ('d5100000-0000-4000-8000-000000000011','d5100000-0000-4000-8000-000000000010',1,9007199254740993,0,0,0,9007199254740993);
COMMIT;
