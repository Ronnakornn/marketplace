# Settlement domain model

นโยบาย funding, commission, shipping refund และ seller debt **ตกลงแล้ว** ตาม
[ADR-0005](adr/0005-discount-funding-and-refundable-commission.md) เมื่อ 2026-10-04
เอกสารนี้อธิบายข้อมูลและ flow ที่ใช้กับ sale snapshots `policyVersion = 1`
พร้อมแยก legacy Orders ที่ไม่มี snapshot ออกจากกฎใหม่

คำศัพท์อยู่ใน [CONTEXT.md](../CONTEXT.md) รายละเอียด implementation และสถานะการตรวจอยู่ใน
[settlement-implementation-design.md](settlement-implementation-design.md) และ
[settlement-implementation-plan.md](settlement-implementation-plan.md)

## กฎที่ยอมรับและใช้ในโค้ด

| เรื่อง | กฎสำหรับ policy 1 | Source |
|---|---|---|
| คูปองร้าน | ร้านรับภาระส่วนลดสินค้าและ shipping waiver ของร้าน | `server/modules/checkout/checkout.repository.ts` |
| คูปอง marketplace / coins | Marketplace รับภาระ ส่วนลดเงินสดผู้ซื้อไม่ลดสิทธิ์สินค้าร้าน | ไฟล์เดียวกัน |
| API คูปอง | เลือกหนึ่งคูปองพร้อม coins ไม่ได้เพิ่มการใช้คูปองร้านและ platform พร้อมกัน | `server/modules/checkout/checkout-quote.evaluator.ts` |
| Commission | ฐานสินค้าเมื่อหักส่วนลดที่ร้านรับภาระ ไม่รวมค่าส่งและ tax; เก็บ bps และ fee เดิมตอนซื้อ | `ShopSaleSnapshot`; checkout repository |
| ค่าส่ง | ร้านมีสิทธิ์รับ buyer shipping และ marketplace shipping subsidy ส่วน carrier cost เป็นภาระอีกส่วนของร้าน | checkout repository; `server/modules/wallet/wallet.service.ts` |
| เครดิตรายได้ | รอ Order ทั้งหมด DELIVERED หรือ FULFILLED และ payment สำเร็จ; ใช้สิทธิ์คงเหลือหลัง successful refunds | wallet service |
| Refund สินค้า | ใช้ original funding ของรายการที่อนุมัติ แยก buyer cash, platform coupon reversal และ coin funding reversal | `server/modules/refund/settlement-refund.service.ts` |
| คืน fee | ใช้ original fee คูณสิทธิ์สินค้าที่ reverse สำเร็จสะสม หาร original base แล้วปัดลง; คืนสินค้าทั้งหมดคืน fee ทั้งหมด | ไฟล์เดียวกัน |
| ก่อนเครดิตรายได้ | Successful refund ลดสิทธิ์ที่จะเครดิต ไม่สร้าง debit จากรายได้ที่ยังไม่ได้รับ | wallet service; `server/modules/refund/refund.repository.ts` |
| หลังเครดิต / payout | หักสิทธิ์ร้านและเครดิตคืน fee ครั้งเดียว หนี้ร้านถูกหักด้วยรายได้ใหม่ก่อนถอน | refund repository; wallet service |
| Payout ค้างอยู่ | Lock wallet ตรวจ currency และ available ledger ใหม่ก่อน approve / mark paid; ยอดติดลบถูกปฏิเสธ การ reject ยังคืน hold ได้ | `server/modules/payout/payout.service.ts` |
| Legacy | ไม่มี snapshots ใช้กฎเดิมที่ตรวจประวัติแล้ว ไม่เดา funding หรือ rate ย้อนหลัง | wallet / refund repositories |

Tax ปัจจุบันเป็นศูนย์ และ snapshot policy 1 ปฏิเสธ nonzero tax ที่ยังไม่มีสัญญา
เงินทั้งหมดเป็น integer minor units; snapshot และ reversal arithmetic ใช้ BigInt
ขอบเขตตัวเลขที่ส่งผ่าน API ยังต้องอยู่ใน safe-integer bounds ของ sale ปัจจุบัน
ไม่ได้รับรองการ serialize legacy BigInt ที่ใหญ่เกินขอบเขตนี้

## ข้อมูลที่เก็บ

เพิ่ม Prisma models สี่ตัวด้วย additive migration
`prisma/migrations/20261004040000_add_settlement_snapshots/migration.sql`
ไม่มี backfill ที่ใช้นโยบายปัจจุบันเติมประวัติเดิม

| Model | ข้อมูลหลัก | ความสัมพันธ์ / marker |
|---|---|---|
| ShopSaleSnapshot | policyVersion, currency, commissionBase, commissionBps, originalCommission, originalShipping, buyerShipping, sellerShippingWaiver, platformShippingSubsidy | หนึ่งต่อ ShopOrder; recognizedAt บอกว่าเครดิตสิทธิ์แล้ว |
| ItemSaleSnapshot | originalQuantity, grossMerchandise, sellerCouponDiscount, platformCouponDiscount, coinDiscount, buyerMerchandise, couponId / couponCode | หนึ่งต่อ OrderItem และอ้าง ShopSaleSnapshot; coupon identity ไม่ใช่ mutable Coupon relation |
| RefundItemAllocation | quantity, cashMerchandise, platformCouponReversal, coinFundingReversal | unique refundId / orderItemId; อ้าง original item snapshot |
| RefundShopAllocation | buyerShippingRefund, platformShippingReversal, commissionReversal, shippingCause | unique refundId / shopOrderId; walletPostedAt บอกว่า wallet effect ถูกใช้แล้ว |

Checkout commitment เก็บ original facts ใน transaction เดียวกับ Order และ inventory
reservation ข้อมูลราคาและ funding ไม่เปลี่ยนเมื่อแก้คูปองหรือ commission ภายหลัง
recognition และ posting markers เปลี่ยนได้ตาม lifecycle ของ transaction
ข้อมูลบางส่วนหายหรือประวัติผิดจะได้ conflict 409 แทนการสลับไป legacy policy

สมการของ snapshot:

```text
seller merchandise = gross merchandise - seller coupon discount
buyer merchandise = seller merchandise - platform coupon discount - coin discount
original shipping = buyer shipping + seller shipping waiver + platform shipping subsidy
seller shipping = buyer shipping + platform shipping subsidy
original fee = floor(commission base × original bps / 10,000)
```

Wallet ใช้ ledger types เดิม: order_earning เป็นเครดิตสิทธิ์ที่เหลือ,
commission_fee เป็นค่าธรรมเนียมติดลบหรือคืนค่าธรรมเนียมเป็นบวก,
refund_adjustment เป็น debit สิทธิ์ที่ย้อนกลับ ไม่มีตาราง seller debt แยก

## ตัวอย่างผลตามนโยบาย

ตัวอย่าง ADR ใช้หน่วยสตางค์: gross 100,000, ส่วนลดร้าน 10,000,
ส่วนลด platform 5,000, coins 2,000, ค่าส่ง 4,000 และ commission 1,000 bps
buyer cash = 87,000, original commission = 9,000 และสิทธิ์ร้านหลัง fee = 85,000
ก่อน carrier cost; marketplace margin = 2,000 ก่อน payment fees และต้นทุนอื่น
นี่เป็น fixture ของ policy ไม่ใช่ตัวอย่างการใช้สองคูปองใน checkout API ปัจจุบัน

ตัวอย่างที่ checkout API เลือกได้ ใช้ gross 100,000, คูปองร้าน 10,000,
coins 2,000, buyer shipping 4,000 และ commission 1,000 bps:

| ขั้นตอน | Buyer cash refund | Coin funding reversed | Fee reversed | สิทธิ์ wallet ร้านสุทธิ |
|---|---:|---:|---:|---:|
| ก่อน refund และเครดิตรายได้ | 0 | 0 | 0 | 85,000 |
| คืนสินค้าทั้งหมด แต่เก็บค่าส่ง | 88,000 | 2,000 | 9,000 | 4,000 |
| ยกเลิกก่อนส่ง คืนสินค้าและค่าส่ง | 92,000 | 2,000 | 9,000 | 0 |

คอลัมน์ wallet เป็นผลสิทธิ์สุดท้าย หาก refund มาก่อน recognition ระบบจะเครดิตเฉพาะ
ส่วนที่เหลือ หากเครดิตไปแล้วระบบจะโพสต์ debit และ fee credit ให้ได้ผลเดียวกัน
refund เงินสดกับ seller entitlement reversal จึงมีจำนวนต่างกันได้

## Explicit refund plan และ shipping

New-policy refund ต้องมี item / shipping plan ที่บันทึกไว้ ยอด cash อย่างเดียวระบุ
สิทธิ์สินค้าหรือแหล่ง funding ไม่ได้ Plan รับ full original quantity ของแต่ละรายการ
partial-unit returns ยังไม่เพิ่มใน API
PENDING, PROCESSING และ SUCCESS allocations จองสิทธิ์ที่เหลือ; FAILED ไม่จอง
การแก้ plan ทำได้ขณะ PENDING โดยไม่นับ plan เดิมซ้ำ

Return APPROVED สร้าง PENDING merchandise refund ทันที ไม่ได้พิสูจน์ว่าร้านรับ
สินค้าคืนแล้วและไม่ทำให้ refund SUCCESS โดยอัตโนมัติ Plan ที่ผูก Return ต้องตรง
กับรายการ จำนวน และร้านที่อนุมัติไว้

| Shipping cause | Cash shipping | Platform subsidy | เงื่อนไข |
|---|---|---|---|
| NONE / CHANGE_OF_MIND | ไม่คืน | ไม่ reverse | ไม่สร้าง shipping adjustment |
| PRE_SHIPMENT_CANCEL | คืน buyer shipping เดิมที่เหลือ | Reverse subsidy ที่ยังไม่เกิดต้นทุนส่ง | ครบทุก item ใน ShopOrder และไม่มี shipment ส่งแล้ว |
| SELLER_FAULT | คืน buyer shipping เดิมที่เหลือครั้งเดียวต่อร้าน | เก็บไว้ชดเชย carrier obligation ที่เกิดแล้ว | ผู้ดูแลอนุมัติ cause และมีหลักฐาน shipment ส่งแล้ว |

ข้อความที่ผู้ซื้อเขียนเองไม่ใช่หลักฐาน seller fault ผู้ดูแลเตรียม plan และเห็นยอด server
ที่ refresh แล้วก่อน mark PROCESSING ผ่าน UI Completion ตรวจ shipment evidence ใหม่
successful pre-shipment cancellation คืน paid committed stock และ cancel items,
ShopOrders และ shipments ของร้าน เมื่อ cancel ทุกร้าน Order และ Payment จะเป็น REFUNDED

ผู้ดูแลคนแรก mark PROCESSING ผู้ดูแลคนที่สองบันทึก SUCCESS พร้อม nonempty reference
ยอด cash เป็นศูนย์ใช้ internal settlement reference ผ่าน field externalReference เดิม
ไม่แสร้งว่ามี provider transfer ระบบยังไม่เรียก refund provider หรือรับ refund webhook
reference เพียงอย่างเดียวไม่ยืนยันว่าโอนเงินจริงแล้ว

## Idempotency, coins และ debt

Completion ตรวจ successful payment, cash remaining, association / currency,
original capacity และ successful cumulative fee ก่อนเขียนยอดใหม่
lock Order แล้ว ShopWallets ตาม Shop ID แล้ว BuyerCoinWallet
รายการ refund, inventory cancellation, fee / wallet posting และ coin adjustments
อยู่ใน transaction เดียวกัน failure rollback และ replay SUCCESS ไม่ย้อนเงินซ้ำ
Payout ใช้ lock SellerPayout แล้ว ShopWallet โดยไม่ acquire Order ต่อ

Policy 1 คืน original redeemed coins ตาม coin funding ที่ allocate ไว้ ไม่ใช้ cash
ratio ซึ่งรวมค่าส่ง Cashback reversal ใช้ returned merchandise cash เทียบ original
merchandise cash ไม่รวมค่าส่งที่เก็บไว้ Affiliate commission เป็นอีก domain
และไม่ได้เพิ่ม refund clawback policy ใน increment นี้

sellerDebtCents คำนวณจาก economic ledger โดยบวก reversible requested / approved
payout holds กลับก่อนหาหนี้ signed availableBalanceCents ยังแสดงตามเดิม
ยอด available ติดลบเพราะ hold อย่างเดียวไม่ถูกเรียกว่าหนี้ รายได้ใหม่ offset หนี้ก่อนถอน
approve / mark paid ตรวจ available ledger ไม่ติดลบ หลัง lock แล้ว
การตรวจนี้ไม่ย้อน bank transfer ที่ทำไปก่อนหน้าและไม่แทน external reconciliation

## Legacy และขอบเขตที่ยังแยกอยู่

Baseline `8ac5a04` เคยเครดิต gross merchandise หัก commission จาก gross โดยไม่
แยก funding หรือ shipping entitlement และ cash refund ไม่คืน fee ต่างหาก
ตัวอย่างเดิมสินค้า 100 บาท ส่วนลด 20 ค่าส่ง 5 fee 10% เคยเครดิต 90 บาท
คืน cash merchandise 80 บาทแล้วเหลือ 10 บาท นี่คือพฤติกรรม legacy ไม่ใช่ expected
ของ policy 1 และไม่ควรเอาคูปองหรือ rate ปัจจุบันคำนวณย้อนหลัง

Legacy cumulative cash allocation แก้การหักร้านเกิน cap แล้วใน
[refund-allocation-design.md](refund-allocation-design.md) และมีหลักฐานแยกใน
[refund allocation evidence](test-evidence/2026-10-04-refund-allocation/README.md)
ไม่กำหนด arbitrary partial split เท่ากับ lump ระหว่างทางสำหรับทุกกรณี

ขอบเขตที่ยังต้องมีสัญญาแยก: carrier claims / goodwill, nonzero tax,
coupon reissuance, affiliate refund clawback, partial-unit returns และการผูก refund
กับ physical return receipt ไม่ได้เปลี่ยน whole-Order earnings eligibility
Zero-cash checkout ยังผ่าน trusted payment lifecycle เดิม ไม่เพิ่ม provider bypass

เอกสารนี้เป็น source / contract synchronization ไม่ใช่ผลรัน tests ใหม่
ผลทดสอบจริงและข้อจำกัด UI / DB / provider ให้ใช้
[settlement policy evidence](test-evidence/2026-10-04-settlement-policy/README.md)
ไม่อนุมาน cross-family review หรือ provider execution จาก local tests
