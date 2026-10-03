# Settlement domain model

สถานะของนโยบายใหม่คือ **ตกลงผู้รับค่าส่งแล้ว ส่วนอื่นรอการตัดสินใจ** เอกสารนี้แยกพฤติกรรมที่อ่านพบในโค้ด
ออกจากข้อเสนอสำหรับธุรกิจ ตรวจจาก commit `8ac5a04` ในวันที่ 2026-10-04
ยังไม่ได้เปลี่ยนสูตร ระบบบัญชี หรือ schema

คำศัพท์อยู่ใน [CONTEXT.md](../CONTEXT.md) แผนงานอยู่ใน
[settlement-domain-plan.md](settlement-domain-plan.md)

## กฎปัจจุบันที่มีหลักฐาน

| เรื่อง | พฤติกรรมปัจจุบัน | หลักฐาน |
|---|---|---|
| ราคาสินค้า | ใช้ราคาที่ checkout เลือกแล้ว คูณจำนวน ก่อนหัก coupon และ coins | `CheckoutQuoteEvaluator.evaluate`, `server/modules/checkout/checkout-quote.evaluator.ts` |
| ยอดผู้ซื้อ | subtotal ลบ discountTotal บวก shippingTotal บวก taxTotal ปัจจุบัน tax เป็นศูนย์ | `CheckoutQuoteEvaluator.calculateTotals`, ไฟล์เดียวกัน |
| ขอบเขตคูปอง | shopId ระบุสินค้าที่มีสิทธิ์รับส่วนลด ไม่ได้ระบุผู้รับภาระต้นทุน | `PromotionService.resolveCouponEligibleSubtotal`, `server/modules/promotion/promotion.service.ts` |
| เหรียญ | 1 coin ลด 100 สตางค์ มีเพดานตามยอดสินค้าและยอดเหรียญที่ใช้ได้ | `CheckoutQuoteEvaluator.resolveCoinRedemption`, `server/modules/checkout/checkout-quote.evaluator.ts:220` |
| ยอดแยกร้าน | หักคูปองร้านก่อน แล้วแบ่งส่วนลด platform และ coins ตามยอดสินค้าที่เหลือ | `PrismaCheckoutRepository.commitCheckout`, `server/modules/checkout/checkout.repository.ts` |
| ส่งฟรี | ลด shippingTotal โดยตรง ไม่เพิ่ม discountTotal | `CheckoutQuoteEvaluator.calculateTotals`, ไฟล์ evaluator |
| เงินที่เรียกเก็บ | Payment.amount เท่ากับ Order.grandTotal | `PrismaCheckoutRepository.commitCheckout`, ไฟล์ repository |
| รายได้ร้าน | เครดิตยอด OrderItem.lineTotal และหัก commission จากยอดนั้น เมื่อ Order ทั้งหมดส่งสำเร็จหรือ fulfilled และ payment สำเร็จ | `WalletService.createEarningsForCompletedOrder`, `server/modules/wallet/wallet.service.ts:67`; `server/modules/wallet/wallet.repository.ts:129` |
| Commission | ปัดลงจาก gross คูณ basis points หาร 10,000 ค่าเริ่มต้น 1,000 bps | `CommissionService.calculate`, `server/modules/commission/commission.service.ts` |
| Refund สินค้า | แบ่ง subtotal ลบ discountTotal ของ ShopOrder ตามรายการสินค้า ไม่รวมค่าส่ง | `calculateReturnRefund`, `server/modules/refund/refund-amount.service.ts` |
| Refund เงินสด | หัก wallet ร้านตามยอด refund เงินสด ไม่มีรายการคืน commission แยก | `PrismaRefundRepository.completeRefundSuccess`, `server/modules/refund/refund.repository.ts:60` |
| คืนเหรียญ | ใช้สัดส่วน cash refund สะสมต่อ grandTotal คืนเหรียญที่ใช้และเรียกคืน cashback ตามเป้าหมายสะสม | `reverseBuyerCoinsForRefund`, `server/modules/promotion/buyer-coin.transitions.ts:33` |

หลักฐานชุดก่อนอยู่ใน [numeric-audit-report.md](numeric-audit-report.md)
ผลทดสอบเดิมไม่ได้รับรองนโยบาย settlement ที่ยังไม่ได้เลือก

## ขอบเขตความรับผิดชอบ

Checkout และ Promotion กำหนดว่าผู้ซื้อจ่ายเท่าไรและเก็บยอดเมื่อสั่งซื้อ
Order เก็บรายการและยอดรายร้าน Payment ยืนยันการรับเงิน Shipping กำหนดสถานะส่งสินค้า
Wallet และ Commission คำนวณสิทธิ์เงินของร้าน Payout โอนเงินออก
Return ระบุสินค้าที่คืน Refund ระบุเงินสดที่คืนและรายการปรับยอดที่เกี่ยวข้อง
Affiliate มี commission คนละประเภทกับค่าธรรมเนียมของ marketplace

ยอดผู้ซื้อ ยอดร้าน และยอด refund จึงไม่ใช่จำนวนเดียวกันเสมอไป
ยอดเหล่านี้จะตรวจว่าถูกต้องได้ก็ต่อเมื่อทราบผู้รับภาระส่วนลดและสิทธิ์ค่าส่ง

## ตัวอย่างพฤติกรรมปัจจุบัน

ทุกจำนวนในตัวอย่างนี้เป็นบาท ใช้สินค้า 100 ส่วนลด 20 ค่าส่ง 5 และ commission 10%
ไม่มี tax, cashback, payout เดิม หรือรายการ wallet อื่น

| ขั้นตอน | ลูกค้า | Wallet ร้าน | Commission ที่หัก |
|---|---:|---:|---:|
| ชำระเงิน | จ่าย 85 | ยังไม่เครดิตรายได้ | ยังไม่หัก |
| ส่งสำเร็จและเครดิตรายได้ | จ่ายสะสม 85 | 90 | 10 |
| คืนเฉพาะสินค้า 80 หลังเครดิตรายได้ | เงินที่ยังจ่ายอยู่ 5 | 10 | ยังเป็น 10 |
| คืนเต็มยอดเงินสด 85 หลังเครดิตรายได้ แทนการคืนสินค้าแถวก่อน | เงินที่ยังจ่ายอยู่ 0 | 5 | ยังเป็น 10 |

สองแถว refund เป็นกรณีแยกกัน ไม่ใช่คืน 80 แล้วคืนเพิ่ม 85
ยอดร้านที่เหลือ 5 หรือ 10 เป็นผลของสูตรปัจจุบัน ยังตัดสินว่าเป็นยอดที่ถูกต้องทางธุรกิจไม่ได้
โค้ดยังไม่ได้บันทึกว่าใครชดเชยส่วนลด 20 หรือเครดิตสิทธิ์ค่าส่ง 5 และไม่ได้คืน commission
ผู้ใช้ตกลงให้ร้านมีสิทธิ์รับค่าส่งแล้ว ส่วน funding และ commission reversal ยังรอตัดสินใจ

## ผลของการเลือกผู้รับภาระส่วนลด

ตารางนี้เป็น **ทางเลือกที่ยังไม่ใช้จริง** คง commission ไว้ที่ 10 จากฐานสินค้า 100
และสมมติให้ร้านมีสิทธิ์รับค่าส่ง 5 เพื่อแยกผลของ funding ออกจากการเลือกฐาน commission
เงินชดเชยจาก marketplace เป็นจำนวนที่นโยบายต้องจัดหา ไม่ใช่เงินที่พบว่าระบบบันทึกแล้ว

| ผู้รับภาระส่วนลด 20 | เงินลูกค้า | เงินชดเชย marketplace | สิทธิ์เงินร้านรวมค่าส่ง | Commission |
|---|---:|---:|---:|---:|
| ร้านรับภาระทั้งหมด | 85 | 0 | 75 | 10 |
| Marketplace รับภาระทั้งหมด | 85 | 20 | 95 | 10 |
| ร้าน 10 และ marketplace 10 | 85 | 10 | 85 | 10 |

แต่ละแถวต้องมีเงินลูกค้าบวกเงินชดเชย เท่ากับสิทธิ์เงินร้านบวก commission
ตัวอย่างนี้ไม่มี carrier cost หรือ payment provider fee จึงต้องแยกต้นทุนเหล่านั้นเมื่อกำหนดนโยบายจริง

ถ้าร้านรับภาระส่วนลดทั้งหมดและคิด commission จากสินค้าเหลือ 80
commission จะเป็น 8 และสิทธิ์เงินร้านรวมค่าส่งจะเป็น 77
ตัวเลขนี้แสดงว่าการเลือก funding กับการเลือกฐาน commission เป็นคนละการตัดสินใจ

## ข้อจำกัด lifecycle ที่พบจาก source

| เรื่อง | พฤติกรรมและผลที่ตามมา | หลักฐาน |
|---|---|---|
| เวลาที่ร้านได้เงิน | รอ Order ทั้งหมดส่งสำเร็จ ร้านที่ส่งแล้วอาจต้องรออีกร้าน | `server/modules/shipment/shipment.service.ts:249`; `server/modules/wallet/wallet.repository.ts:129` |
| อัตรา commission | ใช้อัตราของ service ตอนเครดิตรายได้ ไม่ได้ snapshot ตอน checkout ถ้าเปลี่ยนเป็น 20% ก่อน delivery ตัวอย่างเดิมร้านจะได้ 80 | `server/modules/commission/commission.service.ts:18`; `server/modules/wallet/wallet.service.ts:103` |
| ยอดใช้ได้ใน wallet | อ่านผลรวม ledger ตาม currency เส้นทางนี้ไม่ได้ใช้ ShopWallet.balance เป็นยอดหลัก | `server/modules/wallet/wallet.repository.ts:99`; `server/modules/wallet/wallet.service.ts:51` |
| Refund สำเร็จ | เปลี่ยน Refund เป็น SUCCESS ไม่ได้เปลี่ยน Order, Payment หรือ ReturnRequest เป็น refunded | `server/modules/refund/refund.repository.ts:60` |
| Approval กับ receipt | Seller Return Approval สร้าง pending refund ทันที ไม่ได้รอรับสินค้าคืน | `server/modules/return/return.service.ts:147` |
| Payout กับหนี้ | ถ้าจอง payout 90 แล้ว refund 85 ยอด ledger เหลือ -85 การ approve หรือ mark paid ตรวจสถานะ payout แต่ไม่ได้ตรวจยอด wallet อีกครั้ง | `server/modules/payout/payout.service.ts:59`; `:130`; `:185` |
| เศษ refund รายร้าน | Order-wide refund แต่ละครั้งแบ่งตามน้ำหนักเดิม ไม่มีเป้าหมายสะสมรายร้าน น้ำหนัก 1/1 สตางค์ คืนครั้งละ 1 สตางค์สองครั้ง อาจหักร้านที่สองรวม 2 สตางค์ | `server/modules/refund/refund.repository.ts:81`; `server/modules/refund/refund-amount.service.ts:4` |
| Affiliate หลัง refund | การคืนเงินไม่ได้ปรับ commission ที่มีอยู่ การใช้งาน affiliate ใน production ยังถูกปิด | `server/modules/refund/refund.repository.ts:60`; `server/config/production-env.ts:149` |

ตารางนี้มาจากการอ่าน source ไม่ใช่ผลรันทดสอบใหม่สำหรับทุกกรณี
โดยเฉพาะการแบ่ง refund สะสมรายร้านต้องมี regression test ก่อนแก้
การยืนยัน Refund.SUCCESS ไม่ได้พิสูจน์ว่าผู้ให้บริการโอนเงินจริงกลับแล้ว

[fulfillment-flow.md](fulfillment-flow.md) ยังวาด refund-provider webhook และสถานะ
Return REFUNDED แต่เส้นทางปัจจุบันใช้ผู้ดูแลสองคนกับ external reference
และ ReturnStatus ไม่มี REFUNDED ต้องปรับเอกสาร flow ให้ตรงกับ lifecycle ที่เลือก
ก่อนประกาศว่าระบบรองรับ flow ดังกล่าว

## ข้อเสนอที่รอการตัดสินใจ

| ประเด็น | ข้อเสนอ | สิ่งที่ต้องตัดสินใจ |
|---|---|---|
| Funding | คูปองร้านให้ร้านรับภาระ คูปอง platform และ coins ให้ marketplace รับภาระ | ตกลงรูปแบบนี้หรือระบุผู้จ่ายและสัดส่วนแบบอื่น |
| ฐาน commission | ใช้สิทธิ์ยอดสินค้าของร้านหลังส่วนลดที่ร้านรับภาระ ไม่รวมค่าส่งและ tax | ตกลงฐานนี้หรือคิดจากราคาสินค้าก่อนส่วนลด |
| Commission เมื่อ refund | คืน fee ที่เกี่ยวข้อง โดยอิง fee เดิมและสัดส่วนสินค้าที่คืนสะสม | ตกลงคืน fee หรือเก็บบางส่วนตามนโยบาย |
| ค่าส่ง | ร้านมีสิทธิ์รับค่าส่งและรับผิดชอบจ่าย carrier | ผู้ใช้เลือกข้อ 1 เมื่อ 2026-10-04 ตกลงแล้ว ยังไม่เปลี่ยนระบบ |
| Refund ค่าส่ง | ก่อนจัดส่งคืนค่าส่งเต็ม หลังจัดส่งแยกตามเหตุคืนสินค้าและต้นทุนที่เกิดจริง | กำหนดกรณีร้านผิด ลูกค้าเปลี่ยนใจ และส่งไม่สำเร็จ |
| เงินที่จ่ายออกแล้ว | ใช้ seller debt และกฎระงับหรือหัก payout ในอนาคต | ระบุผู้รับภาระชั่วคราวและวิธีชำระหนี้ |
| เวลาที่ร้านได้เงิน | ระบุว่าจะรอทั้ง Order หรือเปิดสิทธิ์ราย Shop Order | กำหนดผลของอีกหนึ่งร้านที่ยังไม่ส่งและสินค้าที่ refund ก่อนเครดิต |
| ขั้นตอน return | แยกการอนุมัติ การรับสินค้าคืน และสิทธิ์จ่าย refund | ระบุกรณี refund ได้ทันทีหรือจำเป็นต้องตรวจรับก่อน |
| เหรียญและ affiliate | แยกการคืน coins การเรียกคืน cashback และ affiliate commission ออกจาก cash refund | ระบุคืนสินค้าเต็มแต่เก็บค่าส่งแล้วต้องคืน reward เท่าไร |

ข้อเสนอเลือก funding แยกตามชนิด promotion เพราะคูปองร้านกับการส่งเสริมยอดขายของ
marketplace มีเจ้าของต้นทุนต่างกันได้ ขอบเขตคูปองอย่างเดียวไม่ใช่ข้อตกลงนี้
ผู้ใช้ตกลงเฉพาะผู้รับค่าส่งแล้ว ส่วน funding และ commission ยังไม่มีคำตอบ
บันทึกใน [ADR-0004](adr/0004-shops-receive-shipping-charges.md)
ยังไม่แก้สูตรตามข้อเสนอ และยังไม่สร้าง ADR รวม settlement ที่มีสถานะ Accepted

## ข้อมูลที่ต้องเก็บเพื่อคำนวณย้อนหลัง

ข้อมูลปัจจุบันเก็บ ShopOrder.discountTotal รวม coupon และ coins
CouponRedemption อ้างถึงคูปองที่แก้ไขหรือลบได้ จึงยังพิสูจน์ funding ตอนซื้อจากข้อมูลนี้ไม่ได้
ส่งฟรีเก็บเฉพาะค่าส่งที่เรียกเก็บแล้ว ไม่มีค่าก่อนยกเว้นหรือผู้ชดเชย

ก่อนลงมือแก้ระบบ ต้องกำหนดข้อมูลที่คงเดิมของแต่ละ sale ดังนี้

- ส่วนลดแต่ละแหล่ง ผู้รับภาระ และจำนวนที่แต่ละฝ่ายจ่าย
- การแบ่งส่วนลดและสิทธิ์ยอดสินค้ารายร้านและรายการสินค้า
- ค่าส่งก่อนและหลังส่วนลด ผู้มีสิทธิ์รับเงิน และ carrier cost ถ้ามี
- ฐาน commission อัตรา fee ที่คิดจริง และเวอร์ชันนโยบาย
- Cash refund, coin restoration, subsidy reversal, commission reversal และ seller reversal แยกกัน
- จำนวนคืนสะสมและผู้ได้รับเศษสตางค์ เพื่อให้คืนหลายครั้งเท่ากับคืนครั้งเดียว

สิ่งเหล่านี้เป็นความต้องการของแบบจำลอง ยังไม่ใช่ชื่อ column หรือ migration ที่อนุมัติแล้ว
ข้อมูลย้อนหลังที่ไม่ครบต้องมีแผน backfill และหลักฐาน ห้ามใช้คูปองปัจจุบันเดานโยบายเดิม

## กรณีที่สัญญา settlement ต้องตอบได้

| กรณี | ผลคาดหวังที่ต้องระบุหลังเลือกนโยบาย | สถานะ |
|---|---|---|
| ไม่มีส่วนลด | เงินลูกค้าเท่ากับสิทธิ์เงินร้านรวมค่าส่งบวก fee และสิทธิ์เงินฝ่ายอื่น | ตกลงผู้รับค่าส่งแล้ว รอการ implementation และฐาน fee |
| คูปองร้านและ platform พร้อม coins | แยก funding แต่ละส่วนจากส่วนลดผู้ซื้อ | รอเลือกนโยบาย |
| Free shipping | ระบุผู้จ่ายค่าส่งแม้ charged shipping เป็นศูนย์ | รอเลือกนโยบาย |
| สองร้านและเศษสตางค์ | ผลรวมครบ ผู้ได้รับเศษเป็นไปตามลำดับที่คงเดิม | รอเลือกนโยบายเศษ |
| คืนสินค้า 80 แต่เก็บค่าส่ง 5 | คืนเงินสดและ reward ตามสิทธิ์สินค้า ไม่ถือ cash ratio เป็นข้อตกลงโดยอัตโนมัติ | รอเลือกนโยบาย |
| Refund ก่อนเครดิตรายได้ | ห้ามสร้างสิทธิ์จากยอดขายที่ถูกย้อนกลับไปแล้ว | ต้องตรวจสัญญา lifecycle |
| Refund หลัง payout | แยกหนี้ร้าน เงินคืนลูกค้า และสิทธิ์ payout ที่ค้างอยู่ | รอเลือกนโยบายหนี้ |
| Refund ซ้ำหรือพร้อมกัน | ย้อนเงินแต่ละองค์ประกอบครั้งเดียวและไม่เกินสิทธิ์เดิม | กฎ idempotency เดิม ใช้กับองค์ประกอบใหม่ด้วย |
| เปลี่ยนอัตรา commission หลังขาย | Refund อิง fee เดิม ไม่ใช่อัตราใหม่ | ข้อเสนอรอการตัดสินใจ |
| คืนทีละหน่วยหลายครั้ง | Refund รวมตรงสิทธิ์เต็มโดยไม่สูญเสียเศษสตางค์ | Partial-unit return ยังไม่รองรับใน API ปัจจุบัน |

## ขอบเขตการตรวจรอบนี้

การอ่านโค้ดและตัวอย่างนี้ยืนยันพฤติกรรมปัจจุบันกับข้อจำกัดข้อมูล
ยังไม่ได้ทดสอบ provider จริงหรือดำเนินธุรกรรม settlement ตามข้อเสนอ
ผลการตรวจเอกสารและคำสั่งตรวจ repository รอบนี้อยู่ด้านล่าง

ตรวจรอบนี้แล้ว Typecheck ผ่าน Vitest ผ่าน 1,213 รายการ ไม่ผ่านศูนย์รายการ
และข้าม 39 รายการที่ต้องเปิด infrastructure gates แยก
ไม่ได้เปิด PostgreSQL หรือ Redis และไม่ได้รัน browser หรือ provider ใหม่
หลักฐานอยู่ใน [ชุดตรวจเอกสาร settlement](test-evidence/2026-10-04-settlement-model/README.md)

ผู้ตรวจแยกใน GPT family ตรวจ source และเลขอีกครั้ง พบชื่อ method refund ผิดหนึ่งจุด
และสถานะค่าส่งที่ยังไม่อัปเดต แก้แล้วและตรวจซ้ำไม่พบประเด็นเพิ่มเติมในเอกสารที่ตรวจ
การตรวจนี้ไม่ใช่การ review ข้าม model family

Sequence Work into Verifiable Units กำหนดให้แยกร่างศัพท์และนโยบายก่อนเปลี่ยนสูตร
Prove It Works กำหนดให้ตรวจ source ตัวอย่างตัวเลข และผลคำสั่งจริงก่อนรายงานผ่าน

## เพิ่มเติมหลังแก้การจัดสรร refund สะสม

ข้อจำกัดเรื่องคืนเงินย่อยแล้วหักร้านเดิมเกินยอดในตาราง lifecycle ของ baseline `8ac5a04`
แก้แล้วในรอบถัดมา การ complete refund อ่านยอดหักที่บันทึกจริงของทั้ง Order
แล้วคำนวณเป้าหมายสะสมที่ไม่สร้าง debit ติดลบและไม่เกิน cash allocation รายร้าน
ประวัติที่ขาด ผิด currency ผิดร้าน หรือถูกหักเกินแล้ว จะได้ conflict 409 ก่อนเขียนรายการใหม่

ตัวอย่าง 1/1 สตางค์ คืนครั้งละ 1 สตางค์สองครั้ง ตอนนี้หักรวมร้านละ 1 สตางค์
ทดสอบทั้ง sequential/replay และ complete คนละ refund พร้อมกันใน PostgreSQL จริง
พร้อมเทียบ wallet service response กับ ledger ส่วน commission, funding และสิทธิ์ค่าส่ง
ยังไม่ได้เปลี่ยนสูตรตามนโยบายใหม่

ดู [แบบคำนวณ](refund-allocation-design.md) และ
[หลักฐานรอบนี้](test-evidence/2026-10-04-refund-allocation/README.md)
การแบ่ง refund บางส่วนเป็นจำนวนครั้งต่างกันยังไม่รับรองว่าทุกกรณีจะได้ยอดรายร้านระหว่างทางเหมือนกัน
เมื่อคืนเต็มยอด cash allocation แต่ละร้านต้องถูกหักรวมเท่ากับ cap เดิมของร้าน
