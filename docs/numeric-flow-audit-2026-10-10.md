# ผลตรวจ flow ตัวเลข marketplace วันที่ 10 ตุลาคม 2026

ผลด้านล่างเป็นหลักฐานก่อนแก้ไข ดูผลดำเนินการต่อใน [รายงานแก้ไข](numeric-flow-fixes-2026-10-10.md)

ตรวจ source ที่ commit `1f339f1866b758bdc7f97c005dd7962ba285b785` บน Windows โดยใช้ PostgreSQL 17 และ Redis 7.2.14 แยกจากข้อมูลใช้งานจริง การตรวจพบข้อผิดพลาดที่ต้องแก้ จึงยังสรุปว่าทุก flow ผ่านไม่ได้ งานนี้ตรวจและทดสอบ ไม่ได้แก้โค้ดแอป Browser ใช้ Next/Elysia development servers เปิด checkout V2 และ mock payment ไม่มี production build หรือ external payment ในรอบนี้

## ประเด็นที่ยืนยันได้

| ระดับ | Flow และผลกระทบ | หลักฐาน |
| --- | --- | --- |
| P1 | Flash sale ไม่คิด ACTIVE hold ที่หมดเวลาในการรับจองใหม่ แต่ยังยอมให้ payment commit hold เดิม ตั้ง stockLimit=1 และ perUserLimit=1 แล้วขายให้ผู้ซื้อคนเดิมได้ 2 ชิ้น หาก worker ยังไม่ปล่อย hold สต็อกกายภาพยังไม่ติดลบในเคสนี้ | [ผล PostgreSQL](../.audit/numeric-2026-10-10/commerce-probe-results.json), [ตำแหน่งและวิธีรัน](../.audit/numeric-2026-10-10/commerce-review.md) |
| P1 | หน้า tracking ส่ง DTO ที่มีเฉพาะสถานะและพัสดุเข้า `normalizeOrder` ซึ่งต้องการยอดเงิน จึงเกิด `RangeError` และแสดง Unable to load data หลังผู้ขายส่งสินค้า | [stack จากฟังก์ชันจริง](../.audit/numeric-2026-10-10/projection-probes.log), [รายละเอียด source](../.audit/numeric-2026-10-10/projections-review.md) |
| P2 | ช่วงราคาใน search facets แสดงสตางค์เป็นบาท เช่น 100 ถึง 900 สตางค์แสดง THB 100 ถึง 900 แทน THB 1.00 ถึง 9.00 ตัว render test เดิมยังยืนยันข้อความหน่วยผิด | [projection review](../.audit/numeric-2026-10-10/projections-review.md) |
| P2 | Search รับราคาที่เกิน safe integer แล้วแปลงเป็น Number ก่อน BigInt จึงเสียความแม่นยำ ค่าสูงสุด Int64 และ `1e100` ทำให้ route ที่ใช้ PostgreSQL จริงตอบ 500 | [ราคาและ HTTP status](../.audit/numeric-2026-10-10/projection-probes.log) |
| P2 | Recommendation และ Review pagination รับ `page=1e100` จน Prisma ใช้ skip ที่เกิน Int64 และตอบ 500 Recommendation ยังตอบ page ที่ปัดผิดเมื่อส่ง 9007199254740993 | [pagination probes](../.audit/numeric-2026-10-10/projection-probes.log) |
| P2 | Flash stockLimit/perUserLimit และน้ำหนักหรือขนาด variant รับ 2147483648 ซึ่งเกิน Int32 แล้วเกิด Prisma P2020 แทนการปฏิเสธที่ validation | [ขอบเขต 6 fields](../.audit/numeric-2026-10-10/commerce-probe-results.json) |
| P2 | CI ใส่ `?schema=public` ใน URL แต่ finance reconciliation และ read-only numeric audit ปฏิเสธ query นี้ ทำให้ 7 tests ล้มและ 14 tests ไม่ได้รัน ใช้ URL ที่ไม่มี query แล้วทั้ง 21 tests ผ่าน | [CI boundary proof](../.audit/numeric-2026-10-10/finance-ci-boundary-probe.json), [ผลก่อนแก้ค่า](../.audit/numeric-2026-10-10/quality-initial.json), [ผล 21 tests](../.audit/numeric-2026-10-10/quality-failures-corrected.json) |
| P2 เมื่อเปิด AI | Assistant fallback แสดงราคา 10000 สตางค์เป็น 10000 THB แทน 100.00 THB และ lexical fallback เปลี่ยน THB เป็น USD ใน production ที่ปิด AI ตามเอกสารยังไม่เข้าทางนี้ | [assistant probes](../.audit/numeric-2026-10-10/projection-probes.log) |

## ขอบเขตที่ตรวจ

| Flow | การตรวจและกรณีสำคัญ | ผล |
| --- | --- | --- |
| เงินและ API | BigInt, canonical integer strings, ยอดเกิน 2^53, ยอดติดลบ, ฟอร์มทศนิยม, เงินหนึ่งสตางค์ | formatter และ DTO tests ผ่าน พบการใช้ DTO ผิดที่ tracking |
| Catalog และ Cart | ราคา variant ปัจจุบัน, จำนวนเต็ม, ราคา cart ที่ลูกค้าปลอม, รวมหลายร้าน, การแก้ราคาและ snapshot | core tests ผ่าน พบ dimension bounds และ E2E ราคาเดิมที่ล้าสมัย |
| Checkout | quote และ commit ฝั่ง server, ส่วนลดตามร้าน, ค่าส่งครั้งเดียวต่อร้าน, fingerprint, ภาษี inclusive/exclusive, rollback | integration ผ่าน |
| Coupon และ Flash sale | คูปองร้านก่อน platform ก่อน coins, bps, cap, minimum, usage limit, duplicate submission, flash satang | core tests ผ่าน พบ expired flash hold และ Int32 bounds |
| Inventory | reserve ก่อนชำระ, commit หลัง trusted payment, release เมื่อ failed/expired/cancel, seller ลดต่ำกว่า hold ไม่ได้, last unit และ concurrent writes | integration ผ่าน |
| Payment | signature, amount, duplicate events, event/payment locks, failed recovery และ expiry worker | integration ผ่าน แต่ไม่มี webhook currency field ตามที่เอกสารกล่าว |
| Shipment และ Order | แยกตามร้าน, จำนวน item, aggregate status, original item/address snapshot | transaction tests ผ่าน พบ buyer tracking DTO |
| Return และ Refund | quantity interval, คืน NET/TAX แยกกัน, คืนครบใช้ original pools ครบ, fee reversal, shipping cause, active-plan capacity, replay และ rollback | finance tests และ property sweep ผ่าน |
| Wallet และ Payout | gross seller rights, NET commission, earning หลังส่งครบ, debt, hold, สองผู้อนุมัติ, concurrent payouts, shared buyer coins | finance tests ผ่าน |
| Coins และ Affiliate | original NET reward base, คืน coins จาก funding เดิม, award/reversal, wallet ร่วม, debt และ cumulative fee | finance tests และ property sweep ผ่าน |
| Search และ Recommendation | price edges, stock/reserved stock, ratings, sold99/100, related500/1500 และ pagination | normal threshold tests ผ่าน พบ price units และ oversized inputs |
| Review และ Shop rating | เฉพาะ published, average4.33/4.67, counts และ buckets | integration ผ่าน |
| Analytics และ Fraud | paid revenue, ranking, conversion10%, Bangkok midnight, fraud75/100 และ duplicate case | integration ผ่าน |
| Reconciliation และ Audit | exact references/amounts/currency, duplicate/out-of-order records, read-only role, stable snapshot และ stored invariants | tools ผ่านเมื่อใช้ URL ที่รองรับ |

## ผลรันและวิธีอ่าน

ชุดปกติผ่าน 1,586 tests และข้าม integration 227 tests จึงไม่ใช้ผลนั้นอ้างว่าฐานข้อมูลผ่าน เปิด opt-ins ครบแล้วชุดที่สองผ่าน 1,810 จาก 1,813 tests ไม่มี skips อีกสาม failures อยู่ใน component suites ภายใต้การรัน browser พร้อมกัน เมื่อนำสองไฟล์นั้นไปรันแยก ทั้ง 73 tests ผ่าน ไม่เพิ่ม timeout หรือแก้ assertion ดู [baseline](../.audit/numeric-2026-10-10/unit-baseline.json), [รอบสอง](../.audit/numeric-2026-10-10/quality-second.json) และ [component rerun](../.audit/numeric-2026-10-10/component-rerun.json)

Browser matrix รันจบ 207 configurations: ผ่าน 182 ล้ม 25 ไม่มี skips หรือ flaky ครอบคลุม Chromium, Firefox, WebKit, Pixel 7 และ iPhone 13 โดย 207 รวม auth setup 1 เคส ใน 25 failures มี 8 เคสที่ถึง tracking แล้วแสดง error, 2 เคส buyer-lifecycle บน WebKit/iPhone หยุดก่อน shipping และ tracking เพราะ strict locator จับชื่อ order ได้ทั้ง heading และ Next route-announcer และอีก 15 เคสหยุดที่ expectations เดิม Commerce-edge journey ยืนยัน tracking error บนทั้งห้าโปรไฟล์ จากนั้นชุดเสริมที่ใช้ contract ปัจจุบันผ่าน 15/15 ไม่มี skips ผลเดิมยังเก็บครบและไม่เปลี่ยนเป็นผ่าน ดู [browser JSON](../.audit/numeric-2026-10-10/browser.json), [สรุปตามโปรไฟล์และ flow](../.audit/numeric-2026-10-10/browser-summary.json) และ [supplemental JSON](../.audit/numeric-2026-10-10/supplemental.json) ทั้งสองชุดตรวจ flow ซ้ำกัน จึงไม่บวกเป็นจำนวน flow ใหม่ และไม่ได้รันสอง strict-locator cases ใหม่

ชุดรวม Vitest สุดท้ายหลังปิด browser ผ่าน 1,813/1,813 ไม่มี failures หรือ skips และ integration report gate ผ่านครบ 31 integration files ผล test process และ gate exit 0 ดู [ผลสุดท้าย](../.audit/numeric-2026-10-10/quality.json) และ [gate](../.audit/numeric-2026-10-10/quality-gate.log) ผลรอบก่อนยังเก็บไว้ สาเหตุของ component failures สามเคสในรอบก่อนยังไม่ยืนยัน และการผ่าน suite ไม่ได้ลบข้อบกพร่องที่ probes และ browser ทำซ้ำได้

หลัง browser และชุดเสริม ตรวจ invariant 12 ข้อในข้อมูลที่เหลือ 276 orders, 276 payments, 352 items และ 306 shop orders พบ violations 0 ทุกข้อ ดู [ผล SQL](../.audit/numeric-2026-10-10/invariants-final.json) ครอบคลุมสมการยอด, snapshots, จำนวน, payment amount, inventory bounds และ duplicate seller earnings ชุดนี้ไม่ได้ตรวจ flash campaign quota; ข้อผิดพลาด expired hold ทำซ้ำในฐานข้อมูล probe อีกชุดหนึ่ง

ขอบเขต predicates อยู่ใน [numeric-snapshot-invariants.ts](../scripts/numeric-snapshot-invariants.ts): snapshot completeness ตรวจ ShopOrder; atomic tax เริ่มจาก sale snapshots ที่มีอยู่จึงไม่จับ snapshot ที่หายไป; planned refund cash ไม่รวม shipping-only plans การอ่าน counts กับ violations เป็นคนละ query หลังหยุด browser จึงเป็นการตรวจขณะไม่มี flow ทดสอบทำงาน ไม่ใช่หลักฐาน concurrent repeatable snapshot

เพิ่ม probe PostgreSQL สำหรับ coins เกิน Int32 โดยใช้ CheckoutService, PaymentService, RefundRepository และ cancellation จริงใน legacy/v1 settlement ผ่าน 13 checks และ exit 0: reserve/refund 2,147,483,651 coins, cashback/reversal 2,147,483,659 coins รวม rollback, retry และ replay หลังจบ balance/lifetimeEarned เท่ากับ 4,316,442,146 โดย pending/debt/lifetimeSpent เป็นศูนย์ ดู [ผล coins](../.audit/numeric-2026-10-10/finance-coins-probe-results.json) Opening balance และ catalog เป็น fixtures; ใช้ mock callback ไม่มี external transfer หรือ delivery journey ชุดนี้ปิด coverage gap ของ persisted coin values เกิน Int32 ใน path ที่ทดสอบ แต่ยังไม่ทดสอบยอดระดับนี้ใน V2, version Int32 exhaustion หรือ cumulative Int64 exhaustion

Property sweep ใช้ฟังก์ชัน production กับ seed 10102026 ผ่าน 2,000 tax cases, 4,871 partial refund plans, 1,976 affiliate awards, 4,847 affiliate reversals และ 10,000 legacy allocations ตรวจ payable identity, original pool exhaustion และ commission caps รวมเงินเกิน 2^53 ดู [ผลจริง](../.audit/numeric-2026-10-10/finance-property-sweep.json) จำนวนนี้แยกจาก Vitest และไม่บวกเป็นจำนวน test ทั้งระบบ

ผู้ตรวจหลักฐานอิสระพบว่า random generator ของ sweep เดิมทำให้นโยบายสัมพันธ์กันและครอบคลุมเพียง 6 tuples จึงเพิ่ม matrix แบบระบุทุกชุด: 2 price modes × 2 funding bases × 2 shipping tax policies × 6 sample rates = 48 tuples แต่ละ tuple ผ่าน 18 cases รวม 864 cases ซึ่งเป็น 288 sale input shapes ที่เปลี่ยน commission 3 อัตรา และ 7,776 partial refund plans ตรวจสูตรกับ oracle แยกและตัวอย่าง literal half-up รวม refund 33, 33, 35 ที่ใช้ NET 94/TAX 7 หมดพอดี ผล Bun exit 0 ดู [matrix](../.audit/numeric-2026-10-10/tax-policy-matrix-results.json) การตรวจนี้เป็น pure functions ใช้หนึ่งร้านและ quantities ที่เลือก ไม่ครอบคลุมทุกอัตรา ทุกจำนวน หรือ SQL concurrency การลอง shipping หลังใช้สิทธิ์หมดเป็นแผนยอดศูนย์ใหม่ ไม่ใช่ persisted refund replay

หลักฐานทั้งหมดอยู่ใน [โฟลเดอร์การรัน](../.audit/numeric-2026-10-10/) และ [decision trail](../.audit/numeric-2026-10-10.tsv) ใช้ Prove It Works เพื่อยืนยันกับฟังก์ชันจริง PostgreSQL Redis และ browser แทนการสรุปจาก typecheck หรือ mock เพียงอย่างเดียว

## Test ที่ล้าสมัยและส่วนที่ยังไม่ยืนยัน

`catalog-checkout-guards.spec.ts` คาดหวัง price/unitPrice/lineTotal เป็น number ทั้งที่ contract ปัจจุบันเป็น canonical string จึงหยุดก่อนตรวจ cache และ UI ครบ `checkout-resilience.spec.ts` คาดหวังให้ retry หลัง cart ถูก commit และ consume แล้ว แต่เอกสารกำหนดให้กู้คืนผ่าน order history และไม่รับประกัน replay ปุ่มถูกปิดหลัง quote refetch ล้มเหลวจึงไม่ใช่หลักฐานว่า order ซ้ำ ชุดเสริมตรวจ expected ตาม contract ปัจจุบันและยืนยัน Order/Checkout/Payment ว่ามีอย่างละหนึ่ง กับ inventory.quantityReserved=2 โดยไม่ได้นับ cardinality ของ InventoryReservation rows และไม่แก้ tests เดิม ดู [canonical contract](../.audit/numeric-2026-10-10/canonical-contract.pw.ts) และ [history recovery](../.audit/numeric-2026-10-10/history-recovery.pw.ts)

Webhook ไม่มี currency field จึงยังยืนยัน currency จาก callback ตามข้อความใน checkout docs ไม่ได้ Admin affiliate summary ใช้ original awards แต่ beneficiary stats หัก reversals แล้ว ต้องกำหนดให้ชัดว่าหน้า admin ต้องแสดง original หรือ net ก่อนเปลี่ยนสูตร ดู [finance review](../.audit/numeric-2026-10-10/finance-review.md)

การทดสอบใช้ signed mock provider events และ manual refund/payout fixtures ไม่มีหลักฐาน provider หรือ bank sandbox จริง ไม่ได้ตรวจ production data หรือ migration บน production ไม่มี embedding provider จริงสำหรับ optional AI และไม่ได้วัด production capacity ในรอบนี้

## ปิดการรัน

`bunx tsc --noEmit` รอบสุดท้ายผ่าน exit 0 หลังคืน `tsconfig.json` และ historical finance CLI evidence กลับเป็นต้นฉบับ เก็บผล CLI ที่เพิ่งสร้างในโฟลเดอร์ audit พร้อม patch ของ side effects ก่อนคืนไฟล์ Git HEAD คงเดิมและไม่มี tracked source diff PostgreSQL/Redis ของงานนี้หยุดด้วย exit 0 และ ports 3410/3411/55439/56379 ไม่มี listener ข้อมูลทดสอบและหลักฐานยังเก็บไว้ ดู [typecheck](../.audit/numeric-2026-10-10/typecheck-final.exitcode) และ [cleanup](../.audit/numeric-2026-10-10/cleanup.json)

ระบบอนุมัติอัตโนมัติปฏิเสธการลบ `.next-numeric-audit-20261010` ทั้งคำสั่งที่ตรวจ path และคำสั่ง literal path โดยแจ้ง “blocked by policy” จึงเก็บ cache ไว้ ไม่มีการพยายามข้ามการปฏิเสธ

ตรวจหลักฐานซ้ำโดย reviewer อิสระ รวม counts, source hashes, arithmetic, coin probe, browser failures และ predicates ดู [evidence review](../.audit/numeric-2026-10-10/evidence-review.md) ข้อจำกัดที่พบจาก review รวมอยู่ในรายงานนี้แล้ว ผล audit พร้อมใช้พิจารณาแก้ไข แต่ข้อบกพร่องของแอปยังไม่ได้แก้
