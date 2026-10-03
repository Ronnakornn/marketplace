# รายงานตรวจ flow ตัวเลข marketplace

ฐานก่อนตรวจคือ commit `ed2093b` บน `develop` ซึ่งบันทึกตามคำสั่ง `commit แล้วทำต่อ` วันที่ทดสอบ 4 ตุลาคม 2026 ตามเวลาไทย ผลด้านล่างครอบคลุมโค้ดและกรณีที่ระบุ ไม่ใช่คำรับรองว่าทุกค่าที่เป็นไปได้หรือทุก environment ผ่านแล้ว

## ขอบเขตหลักฐาน

สูตรและกฎจากโค้ดถูกแยกจากค่าคาดหวังใน [commerce](numeric-audit-commerce-notes.md), [finance](numeric-audit-finance-notes.md) และ [analytics/search](numeric-audit-other-notes.md) ตารางแรกในเอกสารเหล่านั้นเป็นสภาพ baseline ส่วน addendum ระบุการแก้ภายหลัง รายงานฉบับนี้เป็นสถานะล่าสุด

เงินใช้หน่วยสตางค์ ราคา baht คูณ 100 ในความหมายเลขฐานสิบ เปอร์เซ็นต์ใช้ basis points 10,000 เท่ากับ 100% ส่วน conversion API เป็น fraction 0.1 เท่ากับ UI 10% Prisma เก็บเงินเป็น BigInt แต่ API จำนวนมากยังใช้ JavaScript number

สถานะ `ผ่าน` ใช้เฉพาะ assertion ที่รันแล้ว โดยบอกชั้นหลักฐานแยกกัน `ไม่ผ่านเดิม → ผ่าน` คือมีการ reproduce ก่อนแก้ `ยังไม่ได้ทดสอบ` หมายถึงขาดหลักฐานในชั้นหรือกรณีที่ระบุ การผ่าน unit tests ที่ mock repository ไม่ได้พิสูจน์ transaction PostgreSQL

ใช้ PostgreSQL 17 ใหม่บน localhost:55439 แยกฐาน `marketplace_test_numeric`, `marketplace_e2e_numeric` และฐาน browser รอบสุดท้าย `marketplace_e2e_numeric_final` ใช้ Redis 5.0.14.1 ใหม่บน localhost:56379 แยก DB 14/15 Browser ใช้ Chromium และ Next development บน 3100/API 3101 โดยไม่ reuse server เดิม การชำระเงินใช้ mock provider และ signed webhook

## ผลรวมการรัน

| การตรวจ | สถานะ | หลักฐาน |
| --- | --- | --- |
| Baseline Vitest | ผ่าน 1,053, ข้าม 24 เพราะ infrastructure ยังไม่เปิด | [baseline JSON](test-evidence/2026-10-04-numeric/baseline-vitest.json) |
| Browser หลังแก้คำขอทดสอบ | ผ่าน 21, ไม่ผ่าน 0, ข้าม 0 รวม auth setup 1 | [browser JSON](test-evidence/2026-10-04-numeric/browser-final.json), [log](test-evidence/2026-10-04-numeric/browser-final.log) |
| Redis queue expiry และ catalog cache จริง | ผ่าน 2, ข้าม 0 บน Redis 5 | [Redis JSON](test-evidence/2026-10-04-numeric/redis-integration.json) |
| DB invariants หลัง browser | ผ่าน 8 กฎ ไม่มี violation ใน 35 orders, 35 payments, 58 items, 49 shop orders รวม snapshot completeness, currency, tax และ subtotal ต่อร้าน | [DB JSON](test-evidence/2026-10-04-numeric/browser-database-invariants.json), [script](../scripts/verify-numeric-snapshots.ts) |
| Final Vitest เปิด integration ทุก gate | ผ่าน 1,252, ไม่ผ่าน 0, ข้าม 0 | [final JSON](test-evidence/2026-10-04-numeric/final-vitest.json), [log](test-evidence/2026-10-04-numeric/final-vitest.log) |
| Prisma generate | ผ่าน | [generate log](test-evidence/2026-10-04-numeric/final-generate.log) |
| i18n | ผ่าน key 2,243 เท่ากันและ placeholder ตรงกัน | [i18n log](test-evidence/2026-10-04-numeric/final-i18n.log) |
| Final typecheck | ผ่าน exit 0 | [result](test-evidence/2026-10-04-numeric/final-typecheck-result.json), [log](test-evidence/2026-10-04-numeric/final-typecheck.log) |
| Production build | ผ่าน exit 0 | [result](test-evidence/2026-10-04-numeric/final-build-result.json), [log](test-evidence/2026-10-04-numeric/final-build.log) |
| Demo seed snapshot / idempotency | ไม่ผ่านเดิม → seed สองรอบยังมี 9 ShopOrders ของ 5 orders และ scan ผ่าน | [negative scan](test-evidence/2026-10-04-numeric/snapshot-completeness-red.json), [seed first](test-evidence/2026-10-04-numeric/seed-snapshots-first.log), [seed second](test-evidence/2026-10-04-numeric/seed-snapshots-second.log), [count](test-evidence/2026-10-04-numeric/seed-snapshots-count.log) |

Browser รอบแรกผ่าน 17/18 รอบถัดไปผ่าน 6/11 โดยคำขอทดสอบขาด `cartItemIds` และคาด error envelope คนละแบบกับ composed API แก้คำขอและ assertion ตามสัญญาจริงแล้วรันครบ 21/21 เก็บ [รอบแรก](test-evidence/2026-10-04-numeric/browser-numeric.json) และ [รอบที่พบข้อผิดพลาดในชุดทดสอบ](test-evidence/2026-10-04-numeric/browser-followup-red.json) ไว้ด้วย

## ค่าคาดหวังอิสระและ UI/API/DB

ค่าด้านล่างเป็น literal fixtures ไม่มีการเรียกสูตรของ implementation มาสร้าง expected

| Basket | Unit price A × 2 / B × 2 | Subtotal | Coupon + coins | Shipping | Grand total | Shop A / B total |
| --- | --- | --- | --- | --- | --- | --- |
| ราคาเปลี่ยนจาก cart snapshot | 1,299 / 999 | 4,596 | 0 | 800 | 5,396 | 2,948 / 2,448 |
| Coupon 640 และ 8 coins | 1,299 / 999 | 4,596 | 1,440 | 800 | 3,956 | 2,135 / 1,821 |
| Flash price และ coupon 640 กับ 7 coins | 900 / 999 | 3,798 | 1,340 | 800 | 3,258 | 1,515 / 1,743 |

ทั้งสามเคสตรวจข้อความ checkout, quote API, buyer order, seller API แยกแต่ละร้าน, OrderItem, ShopOrder และ Payment.amount หลัง checkout on-hand ยังเป็น 10/reserved 2 ทั้งสองร้าน Webhook ที่ยอดน้อยกว่า expected 1 สตางค์ถูกปฏิเสธและไม่เปลี่ยน stock เมื่อส่งยอดถูกต้องและ replay body เดิม Payment เป็น SUCCEEDED เพียงครั้งเดียว แต่ละร้าน on-hand 8/reserved 0, shipments 2, coupon REDEEMED, coin spend USED และ pending coins 0

ภาพหลักฐาน [ราคาใหม่](test-evidence/2026-10-04-numeric/checkout-repriced.png), [coupon/coins](test-evidence/2026-10-04-numeric/checkout-coupon-coins.png), [flash](test-evidence/2026-10-04-numeric/checkout-flash.png) มาจาก screenshot หลัง assertion ตัวเลขผ่าน

Analytics fixture ใช้ paid order เดียว มี 3 lines มูลค่า 100/200/900 และ views 10 คาด summary orders 1, units 3, revenue 1,200, API conversion 0.1, UI 10% สองจุด Product ranking page 1 ต้องเป็น 900/200 และ page 2 เป็น 100 โดย creation order ตรงกันข้าม ตรวจ UI/API/DB แล้วผ่าน [ภาพ analytics](test-evidence/2026-10-04-numeric/numeric-analytics.png) ชุดนี้ seed paid history เพื่อทดสอบ analytics จึงไม่ได้พิสูจน์ payment lifecycle ของ fixture เดียวกัน

## สถานะ flow ตามสูตร

หลักฐาน unit ในตารางนี้อ้างถึง final Vitest ส่วน PostgreSQL และ browser อ้างถึง suites ที่ระบุ ชื่อ test files ช่วยระบุ assertion ที่รันซ้ำได้

| Flow / สูตรหรือกฎ | ผลและขอบเขตหลักฐาน |
| --- | --- |
| Cart quantity = existing + addition | ไม่ผ่านเดิม → ผ่าน PostgreSQL เพิ่มพร้อมกัน 0→2 และ 1→3, มี item เดียว |
| Cart stock = max(0, on-hand − reserved) | ผ่าน unit และ PostgreSQL stock 1 ไม่ยอมให้สอง additions สำเร็จ |
| Cart mutation รอ checkout lock แล้วอ่านใหม่ | ผ่าน PostgreSQL update/delete/clear และ rejected checked-out cart, [cart green](test-evidence/2026-10-04-numeric/cart-followup-green.log) |
| Cart money ใช้ captured unit price × quantity | ผ่าน unit จำนวนและ grouped totals; cart เป็นราคาประมาณ จน checkout อ่านราคาใหม่ |
| Checkout เลือกเฉพาะ valid selected IDs | ผ่าน service/route และ PostgreSQL checkout selections |
| Checkout ใช้ราคา server และ flash ที่ถูกกว่า | ไม่ผ่าน UI เดิม → ผ่าน browser ทั้งสาม basket |
| Subtotal = sum(unit price × quantity) | ผ่าน unit safe-integer guards และ UI/API/DB basket |
| Shipping คิดครั้งเดียวต่อ selected shop | ผ่าน unit, PostgreSQL และ browser สองร้าน 350+450=800 |
| Shipping baht มีสองตำแหน่งและเพดาน 100,000 | ผ่าน seller-shop unit; decimal persistence ผ่าน mock repository ยังไม่มี browser กรณี 49.95 |
| Tax = 0 | ผ่าน checkout assertions; ระบบนี้ยังไม่มีสูตรภาษี nonzero |
| Discount clamp ไม่เกิน subtotal | ผ่าน checkout/promotion unit และ basket discounted |
| Coin cap = min(floor(subtotal/500), floor(post-coupon subtotal/100)) | ผ่าน unit กรณีต่ำกว่า cap/เกิน cap และ exact division; browser ใช้ 8/7 coins |
| Grand total = subtotal − discount + shipping + tax | ผ่าน UI/API/DB และ DB invariant |
| Shop coupon จำกัดเฉพาะร้าน | ผ่าน unit และ PostgreSQL checkout หลายร้าน |
| Platform discount และ coins กระจายตามสัดส่วน floor | ไม่ผ่านเลขใหญ่เดิม → ผ่าน literal near-safe test และ persisted per-shop basket |
| Order/payment/address/item snapshots | ผ่าน PostgreSQL และ browser; buyer totals กับ Payment.amount เท่ากัน |
| Seller order totals จำกัด authorized ShopOrder | ไม่ผ่านเดิม → ผ่าน owner/staff unit และ browser seller API สองร้าน |
| Reserve เพิ่ม reserved ไม่หัก on-hand | ผ่าน PostgreSQL และ browser before-payment assertions |
| Checkout เดียวกันพร้อมกัน | ผ่าน PostgreSQL หนึ่ง order/payment/reservation และ browser double click/lost response |
| Checkout คนละ selected lines ใน cart เดียว | ผ่าน PostgreSQL สร้างสอง orders และคง unselected mutation ถูกต้อง |
| Buyers สองคนแย่ง stock สุดท้าย | ผ่าน PostgreSQL คนละ cart, stock 1 ได้หนึ่ง winner/หนึ่ง 409 และหนึ่ง order/payment/hold, [DB gap checks](test-evidence/2026-10-04-numeric/checkout-db-gaps.log) |
| Checkout rollback หลัง writes | ผ่าน PostgreSQL inject payment.create failure หลัง actual order/2 reservations/coupon/coins writes; ตรวจทุก row กลับศูนย์, stock10/0, wallet100/0, cart2lines เดิม |
| Inventory close ACTIVE เพียงครั้งเดียว | ไม่ผ่านเดิม → ผ่าน PostgreSQL overlapping commit/release/expire, ไม่กิน hold อื่น |
| Seller stock ห้ามต่ำกว่า reserved | ผ่าน composed API/DB browser reserved 3, update 2 ปฏิเสธ, update 3 ยอมรับ |
| Inventory ledger delta/version | ผ่าน repository/service unit; conservation ใน reservation DB tests |
| Shipments แยกร้านและ qty จาก order items | ผ่าน browser สองร้าน และ PostgreSQL sibling dispatch/delivery |
| Fixed coupon clamp/minimum/scope/limits | ผ่าน promotion unit; real fixed-coupon checkout browser |
| Percentage = floor(eligible subtotal × bps/10,000) | ไม่ผ่าน large intermediate เดิม → ผ่าน exact unit; seller form 12.50%→1,250 bps, 1,999→discount 249 ผ่าน HTTP/DB |
| Free shipping คืน scoped shop IDs | ผ่าน unit และ checkout unit; ไม่มี dedicated browser free-shipping checkout |
| Coupon input integer minor units/bps/counts | ไม่ผ่านเดิม → ผ่าน HTTP schema และ service rejection ของ fraction/negative/unsafe |
| Flash baht → exact satang | ไม่ผ่านเดิม → 0.29/1.15/19.99 ผ่าน unit, 29/115 ผ่าน HTTP/DB; near-ceiling 90,071,992,547,409.9→9,007,199,254,740,990 ผ่าน exact canonical decimal/BigInt regression |
| Flash quota = limit − sold − active holds | ผ่าน promotion/repository unit; ไม่มี browser simultaneous last-flash-slot proof |
| Payment ต้อง signed trusted amount | ผ่าน signature/amount unit, PostgreSQL และ signed browser underpayment rejection |
| Webhook idempotency/replay | ผ่าน PostgreSQL concurrent same event และ browser identical body replay |
| Failed/expired/canceled payment คืน stock/coupon/coins | ผ่าน PostgreSQL และ browser ทั้งสาม state |
| Paid racing cancel / paid หลัง expiry | ผ่าน PostgreSQL แย่ง transition; late paid ไม่ consume released stock |
| Cashback = floor(net merchandise/10,000) | ผ่าน unit 9,999→0, 10,000→1, 10,001→1 และ debt settlement; ยังไม่มี browser threshold parity |
| Coin refund reversal ใช้ cumulative proportion | ผ่าน unit 333/667/1,000 รักษาครบ 3 coins, debt/duplicate; PostgreSQL refund lifecycle ผ่าน แต่หลาย separate refunds shared-wallet race ยังไม่ได้ทดสอบ |
| Item refund allocate net merchandise ไม่รวม shipping | ผ่าน unit share 3,200/4,800 และ rounding 99/100; refund 3,200 กับ seller debit/UI 68.00 ผ่าน browser |
| Refund cumulative ≤ Payment.amount, debit ครั้งเดียว | ผ่าน PostgreSQL duplicate/rollback และ browser replay completion |
| Order-wide refund split shop totals | ผ่าน refund repository unit; ไม่มี dedicated multi-shop cumulative refund DB example |
| Commission = floor(gross × bps/10,000), net=gross−fee | ไม่ผ่าน intermediate เดิม → ผ่าน exact literal near-safe unit |
| Completed-order earnings credit ครั้งเดียวต่อร้าน | ไม่ผ่านเดิม → ผ่าน PostgreSQL overlapping callback/replay สองร้าน balance 9,001/18,002 |
| Wallet balance = sum(currency ledger) | ผ่าน wallet unit, PostgreSQL และ browser refund/payout balances |
| Payout reserve/debit/rejection/two-admin paid | ผ่าน PostgreSQL competing withdraw และ browser 10,000−6,000=4,000; service/HTTP ปฏิเสธ fraction/unsafe ก่อน reserve |
| Catalog/coupon/payout form decimal → minor units | ไม่ผ่านเดิม → ผ่าน actual component payload assertions ทั้งสามฟอร์ม raw .90→9,007,199,254,740,990, .91→9,007,199,254,740,991; MAX_SAFE catalog ราคาเดิมบันทึกกลับได้ตรง, [UI green](test-evidence/2026-10-04-numeric/seller-decimal-green.log) |
| Affiliate = floor(net eligible merchandise × bps/10,000) | ไม่ผ่าน intermediate เดิม → ผ่าน unit, 1,999×500 bps→99; ไม่มี settlement browser/DB |
| Analytics views/event count/quantity/orders/revenue | ผ่าน unit, real PostgreSQL และ browser unique order across 3 lines/views10/revenue1,200 |
| Analytics conversion fraction → UI percent | ไม่ผ่านเดิม → ผ่าน unit และ browser 0.1→10% |
| Product/SKU metrics sort ก่อน pagination | ไม่ผ่านเดิม → ผ่าน unit/PG product และ SKU; browser product pages 900/200/100 |
| Low-performing threshold views≥10/conversion<1% | ผ่าน existing deterministic summary tests; exact equality boundaries ยังไม่ได้ทดสอบ |
| Recommendation sold นับ paid only | ไม่ผ่านเดิม → ผ่าน PostgreSQL sold9 ไม่รวม pending5/canceled4, search parity |
| Seller dashboard sales/recent totals/low stock | ผ่าน unit seller scopeและ exact values; ไม่มี midnight timezone browser/DB parity |
| Product/shop reviews distribution/average rounded 2dp | ผ่าน unit published-only/count/weighted average; browser review submit ผ่าน แต่ numeric distribution UI/API/DB ยังไม่ได้เทียบ |
| Search min/max price, stock, rating/pagination | ผ่าน unit และ real PG paid sold parity; price/rating boundary browser ยังไม่ได้เทียบ |
| Search badge 100 units และ 7-day new | ผ่าน existing contract-filter unit; 99/100 และ exact day7 boundary ยังไม่ได้ทดสอบ |
| Recommendation pagination/similar-price padding | ผ่าน existing unit; ไม่มี exact numeric similar-price DB/browser proof |
| Flash discovery availability min(campaign, physical) | ผ่าน merchandising unit; reservation clamp boundary DB/browser ยังไม่ได้ทดสอบ |
| AI search score round 4dp | ผ่าน existing AI tests; exact UI/API/DB numeric score parity ยังไม่ได้ทดสอบ |
| Fraud refund ratio/weights/cap/rapid-checkout seconds | ผ่าน existing unit selected signals; complete threshold equality และ browser parity ยังไม่ได้ทดสอบ |
| Queue expiry/repeat ไม่ release stock สองครั้ง | ผ่าน worker+scheduler+Redis5+PostgreSQL จริง; Redis7 ยังไม่ได้ทดสอบ |
| Price cache invalidation หลัง seller edit | ผ่าน Redis5+PostgreSQL warmed price10,000→12,500; stale visibility ปฏิเสธ |

## ช่องว่างที่ต้องเห็นก่อนใช้งานผล

1. รายได้ร้านยังคิดจาก gross item line totals หัก commission และไม่รวม shipping ส่วน refund debit ใช้ net merchandise หรือ shop grand total ตัวอย่าง gross 10,000, discount 2,000, shipping 500 และ commission 10% ทำให้ earnings 9,000 แต่ buyer cash 8,500 ถ้า full cash refund หัก 8,500 จะเหลือ 500 ต้องกำหนด coupon funding, shipping recipient และ commission reversal ก่อนเปลี่ยนสูตร คำถามธุรกิจยังไม่มีคำตอบ จึงไม่รับรอง reconciliation นี้
2. `server/lib/prisma.ts` ยังแปลง BigInt ทั้งหมดเป็น number โดยไม่มี global safe bound Checkout/catalog/commission/payout guards และ exact intermediate tests ไม่ได้พิสูจน์ว่าการอ่าน/aggregate เงินทุก domain เกิน 9,007,199,254,740,991 จะรักษาเศษสตางค์ได้ การใช้ API number ทำให้ค่าฐานสิบบางค่าถูกปัดตั้งแต่ JSON parse ฟอร์มที่แก้ใช้ raw string แต่ monetary displays ที่หาร number ด้วย 100 ทั่วทั้งระบบยังไม่มี near-ceiling parity proof
3. Affiliate commission หลัง late refund ยังไม่มี settlement adjustment และ production readiness ระบุปิด settlement อยู่ Partial-unit returns ไม่ถูกเปิดผ่าน public return API จึงไม่รับรอง cumulative per-unit rounding
4. Payment/refund provider ภายนอก, currency reconciliation, provider retry/out-of-order จริง และ external refund หลัง late payment ยังไม่ได้ทดสอบ Mock signed webhook พิสูจน์เฉพาะ contract ที่มีใน repository
5. Seller dashboard ใช้ host-local midnight แต่ analytics ใช้ UTC day ยังไม่มี product rule สำหรับ timezone ยอดประจำวัน Custom date range และ huge pagination offset ยังไม่มี boundary/performance run
6. Analytics ranking ใช้ memory ตามจำนวน candidate และ metrics ทั้งหมด แม้ query เป็น batch 500 ยังไม่ได้ load test เพดาน catalog หรือ concurrent traffic
7. Catalog มี legacy direct inventory service ที่ upsert โดยไม่ตรวจ reserved และไม่ลง movement เส้นทาง composed API ใช้ InventoryService ที่ผ่าน browser guard แล้ว Direct service path นี้ยังไม่ได้แก้หรือรับรอง concurrency
8. Production build ผ่าน แต่ production servers/browser, Redis7, Firefox/WebKit/mobile และ external services ยังไม่ได้ทดสอบ Production runtime ห้าม mock payments จึงไม่มีการลดข้อกำหนดนี้เพื่อรันชุด mock browser
9. Demo seed ตอนนี้สร้าง ShopOrder snapshots ครบ แต่ historical orders จริงที่เคยไม่มี snapshots ต้องมี backfill ที่กำหนด discount/shipping allocation ชัดเจน Seller totals ใหม่อาศัย snapshots จึงยังไม่รับรองการแสดงยอดของ historical data ที่ไม่ครบ

## การตรวจอิสระและ trail

[แผน](numeric-audit-plan.md), [decision log](numeric-audit-decisions.tsv) และ [independent review](numeric-audit-review.md) ใช้อ้างกลับถึงแต่ละการตัดสินใจ Prove It Works ทำให้ใช้ API/DB/browser จริง Test Behavior, Not Implementation ทำให้ใช้ค่าคาดหวัง literal Model the Domain ทำให้ quote มี authoritative item/shop amounts และ shared metric maps

รีวิวอิสระใช้ agent อีกตัวในตระกูลโมเดลเดียวกัน เนื่องจาก session ไม่มีโมเดลต่างตระกูล ไม่ใช่ cross-family verification ผู้รีวิวพบ near-ceiling baht conversion คลาด 1 สตางค์ จึงเพิ่ม regression ก่อนแก้ต่อ

Comment review แยกตรวจเฉพาะ comment ที่เพิ่มใน production diff พบหนึ่งบรรทัดบรรยาย lock/read ที่ซ้ำกับ SQL จึงลบ ไม่มี behavior changes หรือ suppression ใหม่ Deslop tool ของ Cursor ไม่พร้อมใน Codex ใช้ Unslop และตรวจ diff ก่อน commit แทน

การเปลี่ยน skills ใต้ `.agents/`, `.claude/` และ `skills-lock.json` ที่เกิดร่วมใน workspace ไม่ใช่ส่วนของ numeric audit และไม่ถูกนำไปรวม commit โดยอัตโนมัติ

คำสั่งและ environment สำหรับรันซ้ำอยู่ใน [evidence README](test-evidence/2026-10-04-numeric/README.md) ไม่มี push/deploy หรือ schema change ในงานนี้

## รอบเพิ่มเติมหลัง domain modeling

ผู้ใช้เลือกให้ร้านรับค่าส่งและจ่าย carrier แล้วใน [ADR-0004](adr/0004-shops-receive-shipping-charges.md)
การรับภาระส่วนลดและฐาน/การคืน commission ยังรอการตัดสินใจ
สูตรรายได้ร้านยังไม่ได้เปลี่ยนตามนโยบายใหม่

พบและแก้บั๊ก refund ย่อยหลายครั้งที่อาจหักร้านเดิมเกิน cash allocation
เคส PostgreSQL สองร้านจ่ายร้านละ 1 สตางค์ คืนครั้งละ 1 สตางค์สองครั้ง
ก่อนแก้ได้ ledger 0/-2 หลังแก้ได้ -1/-1 ทั้ง sequential/replay และ concurrent completion
ใช้ยอดหักจริงสะสมและตรวจประวัติก่อนเขียนเงินเพิ่ม

รอบนี้ผ่าน 1,279 Vitest ไม่ผ่านศูนย์ ข้ามสอง Redis integration cases และ Typecheck ผ่าน
Commerce PostgreSQL ผ่านครบ 20 เคส Amount/repository/commerce suites รวม 52 เคสผ่าน
ไม่มี browser หรือ provider ภายนอกรันใหม่ ข้อจำกัด BigInt serialization เดิมยังอยู่
ประวัติ refund ที่ขาดหรือถูกหักเกินแล้วต้อง reconciliation แยก ไม่ซ่อมเงินเก่าโดยอัตโนมัติ

[หลักฐานรอบเพิ่มเติม](test-evidence/2026-10-04-refund-allocation/README.md)
และ [แบบคำนวณ](refund-allocation-design.md) แยกผลรอบนี้จากหลักฐาน audit เดิม
