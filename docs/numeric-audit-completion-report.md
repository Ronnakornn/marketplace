# ผลปิดรายการตรวจตัวเลข marketplace

รายงานนี้อัปเดตสถานะจาก `numeric-audit-report.md` และรายงาน settlement เดิม วันที่ตรวจ 4 ตุลาคม 2026 ใช้ฐานข้อมูลและ server ทดสอบในเครื่อง ชุด expected ใช้ตัวเลขที่กำหนดแยกจากสูตรที่ทดสอบ

Implementation ภาษี/partial returns อยู่ใน commit `30687ef` และการแก้ฟอร์ม/วันรายงาน/หน้าแรกจาก browser รอบสุดท้ายอยู่ใน `f90f3cd` ผลรวมและหลักฐานรอบส่งงานบันทึกแยกจาก source changes

## สิ่งที่เปลี่ยน

เงินจากฐานข้อมูลและยอดสะสมใช้ bigint ส่วน API ส่งจำนวนสตางค์เป็น decimal string หน้าจอแสดงยอดใหญ่และยอดติดลบได้ตรงกัน ฟอร์มและ payment protocol ตรวจ safe integer ก่อนเปลี่ยนสถานะ ไม่แปลงยอดสะสมกลับเป็น number

ภาษีตั้งค่าได้ใน admin/settings รองรับ inclusive และ exclusive อัตราเริ่มต้นเป็นศูนย์ นโยบายและ revision ถูกบันทึกตอนขาย ต้องเปิด `CHECKOUT_V2_SETTLEMENT_ENABLED` เพื่อใช้การคำนวณใหม่ กฎเดิมยังใช้กับ checkout ที่ไม่มีภาษีและไม่มีคูปองสองช่อง ผู้ซื้อยืนยัน quote fingerprint และ revision ที่เห็นก่อนสร้าง order

คูปองร้านหักก่อนคูปอง platform แล้วจึงหัก coins การคืนบางจำนวนใช้สิทธิ์ดั้งเดิมสะสม รวม NET/TAX แยกกัน ค่าธรรมเนียมและ affiliate คืนจากฐานสินค้าเดิม คืนครบต้องใช้สิทธิ์เดิมครบ ไม่มี replacement coupon หรือ goodwill อัตโนมัติ คำขอคืนสินค้าที่อนุมัติแล้วตรึงจำนวนไว้ ส่วน admin ยังปรับเหตุคืนค่าส่งได้ก่อน processing

ยอดรายวันใช้ Asia/Bangkok แก้ช่องทางเขียน stock ที่ข้าม reservation และแก้ search/analytics ที่นับประวัติ canceled paid order พบ UUID slug ของร้านเปิดหน้าไม่ได้ระหว่างตรวจคะแนนร้าน จึงเพิ่ม fallback จาก ID ไป slug โดยคงตัวกรองร้าน active และ public projection

การตรวจ browser เพิ่มเติมพบ schema ค่าส่งปฏิเสธ field `shippingFeeBaht` ที่ฟอร์มส่งมา จึงรวม generated fields และ extension เป็น schema เดียว ป้ายวันรายงานและวันสิ้นสุด flash sale ใช้วันและ locale คงที่ แก้ทั้ง label เวลาเกินมาและ SSR/hydration mismatch

## สูตรและ expected

สูตรจากโค้ดและกฎธุรกิจอยู่ใน [commerce](numeric-audit-commerce-notes.md), [finance](numeric-audit-finance-notes.md), [analytics/search](numeric-audit-other-notes.md), [exact money](numeric-money-design.md) และ [tax/partial refunds](numeric-tax-design.md)

| ตัวอย่างอิสระ | ผลคาดหวังหน่วยสตางค์ |
| --- | --- |
| Inclusive 7%, สินค้า 10,700 หักร้าน 1,070 และ platform 1,070 | ผู้ซื้อ 8,560 = NET 8,000 + TAX 560; platform NET 1,000 + TAX 70; reported VAT 630; added VAT 0 |
| Exclusive 7%, สินค้า 10,000 หักร้าน 1,000 และ platform 1,000 | ผู้ซื้อ NET 8,000 + VAT 630 = 8,630; platform NET 1,000; reported/added VAT 630 |
| คืนสินค้า 3 ชิ้นจาก original cash 101, NET 94, TAX 7 และ fee 9 | cash 33/33/35; NET 31/31/32; TAX 2/2/3; fee credit 2/3/4 |
| NET cashback 9,999 / 10,000 / 10,001 ไม่รวม shipping | coins 0 / 1 / 1 |
| ยอดสะสมเกิน Number.MAX_SAFE_INTEGER | แสดง 9,007,199,254,740,993 และค่าติดลบโดยไม่เสียหนึ่งสตางค์ |
| สินค้า 2,598/1,998, platform coupon 640 แล้ว coins 800 | ส่วนลดร้าน 813/627; ยอดร้านรวมค่าส่ง 2,135/1,821; order 3,956 |
| Flash 1,800/1,998, platform coupon 640 แล้ว coins 700 | ส่วนลดร้าน 634/706; ยอดร้านรวมค่าส่ง 1,516/1,742; order 3,258 |

7% เป็นอัตราทดสอบ ผู้ใช้ต้องเลือกอัตราและ taxable basis ที่ใช้จริง เอกสารสูตรอ้าง [Stripe inclusive/exclusive arithmetic](https://docs.stripe.com/tax/tax-rates) และ [ตัวอย่างกรมสรรพากร](https://vrtweb2.rd.go.th/15.html) โดยไม่ได้กำหนดอัตราทางกฎหมายให้ร้าน

## ผลและหลักฐาน

| รายการ | สถานะ | หลักฐานและขอบเขต |
| --- | --- | --- |
| ชุดรวมก่อนแก้ UUID slug/readonly quantity เพิ่มเติม | ผ่าน 1,710/1,710 ไม่ข้าม | [JSON](test-evidence/2026-10-04-audit-completion/full-tests-final.json) |
| ชุดรวมหลังแก้รอบสุดท้าย | ผ่าน 1,745/1,745 ไม่ข้าม | [JSON](test-evidence/2026-10-04-audit-completion/full-tests-delivery.json); เปิด PostgreSQL และ Redis integration gates ครบ |
| Production finance บน Chrome/Firefox/Safari/Pixel 7/iPhone 13 | ผ่าน 30/30 | [JSON](test-evidence/2026-10-04-audit-completion/browser-production.json); ตรวจ return/refund/payout, original partial tax และเงินขนาดใหญ่ผ่าน UI/API/DB |
| Production source ล่าสุดบนห้า profiles | ผ่าน 10/10 | [JSON](test-evidence/2026-10-04-audit-completion/browser-production-final.json); linked-return จำนวนอ่านอย่างเดียวและคืนค่าส่ง, fresh SSR campaign/ราคา90→80/stock1→0 ไม่มี hydration error; production provider disabled และไม่ปิด rate limits |
| ภาษี inclusive/exclusive และคูปองสองช่องผ่าน browser | ผ่าน 2/2 Chrome | [JSON](test-evidence/2026-10-04-audit-completion/browser-tax-chromium.json); UI/admin API/DB, signed mock webhook, coupon redeemed และ stock หลังชำระเงิน |
| ตัวเลขและ projections บนห้า browser profiles | ผ่าน 95 configurations หลังแก้ | [ชุดหลัก 90 ผ่าน/5 shipping ไม่ผ่านก่อนแก้ cache](test-evidence/2026-10-04-audit-completion/browser-numeric-cross-profiles.json) และ [shipping รันซ้ำผ่าน 5/5](test-evidence/2026-10-04-audit-completion/browser-shipping-verified.json); คะแนน/รีวิว, search99/100, ราคา500/1500, conversion10%, fraud75/100, checkout, ภาษี, shipping49.95/held-stock และ midnight Bangkok |
| Inventory และ concurrent reservation | ผ่าน | [README](test-evidence/2026-10-04-audit-completion/inventory/README.md); PostgreSQL และ Redis 7 จริง รวม rollback/ownership |
| Refund สอง order ใช้ coin wallet เดียวกัน | ผ่าน 3 PostgreSQL cases | [หลักฐาน](test-evidence/2026-10-04-audit-completion/shared-buyer-coins.md); concurrency, rollback, retry/replay |
| Tax/partial/affiliate review อิสระ | ผ่าน 100 รวม PostgreSQL 29 | [review](test-evidence/2026-10-04-audit-completion/w7-independent-review.md); แก้ gross fallback และ policy provenance หลัง reproduce |
| กฎฐานข้อมูลหลัง browser รอบสุดท้าย | ผ่าน 12 กฎใน 369 orders / 369 payments / 471 items / 396 shop orders | [JSON](test-evidence/2026-10-04-audit-completion/snapshot-invariants-final.json); ไม่มี violation รวม original NET/TAX และ refund capacity |
| Analytics bounded load | ผ่านการตรวจผล 234 requests ไม่มี error | [JSON](test-evidence/2026-10-04-audit-completion/analytics-load/integrated-report.json); 501/5,000/20,000 candidates และ concurrency1/5/20 |
| Historical reconciliation | ผ่าน 26 tests | [คู่มือ](historical-order-reconciliation.md); dry-run, supplied original facts และ audit replay ไม่มีการเติมข้อมูลการเงินจริงย้อนหลัง |
| External reconciliation CLI | ผ่าน 33 tests รวม CLI/PostgreSQL 7 | [คู่มือ](external-finance-reconciliation.md); read-only ตรวจ exact references/currencies/amounts, manifest hash และ duplicate/out-of-order |
| Production build source ล่าสุด | ผ่าน exit0 | [log](test-evidence/2026-10-04-audit-completion/production-build-final.log) |
| Typecheck/i18n รอบส่งงาน | ผ่าน exit0 ทั้งสองรายการ | [typecheck](test-evidence/2026-10-04-audit-completion/delivery-typecheck.log), [i18n](test-evidence/2026-10-04-audit-completion/delivery-i18n.log); 2,288 keys ต่อภาษาและ placeholders ตรงกัน |
| Browser configurations ที่ไม่ซ้ำ ใช้ผลล่าสุดของแต่ละ case/profile | ผ่าน 130/130 ไม่ข้าม | [ผลรวมจากรายงานจริง](test-evidence/2026-10-04-audit-completion/verification-summary.json); numeric 95 และ production 35 รวม 19 และ 7 cases บนห้า profiles |

เก็บรอบที่ไม่ผ่านไว้ด้วย ได้แก่ payment amount boundaries, incomplete v2 affiliate NET, UUID storefront, browser selectors และ Next dev cache เสีย การแก้ selectors ไม่ลด assertions ตัวเลข ข้อคาดหวัง coupon/coins แก้ตามสูตรหักเรียงขั้นที่ตรวจแยกด้วย literal arithmetic ใน [allocation proof](test-evidence/2026-10-04-audit-completion/checkout-allocation-browser.md)

[Shipping schema proof](test-evidence/2026-10-04-audit-completion/shipping-route-boundary.md) มี red/green tests และแยก schema validation ออกจากพฤติกรรม normalization ของ Elysia กรณี 49.951 ถูกปฏิเสธก่อนเปลี่ยนข้อมูล ส่วน fields ที่ไม่รองรับถูกตัดก่อนเข้า service

รอบรวม 1,737 tests พบ last-unit fixture ให้ผู้ซื้อเลือกคนละ variant เพราะ cart rows มีเวลาเท่ากัน จึงไม่ใช่การแย่งสินค้าตัวเดียวกัน หลักฐาน [DB variants](test-evidence/2026-10-04-audit-completion/checkout-last-unit-db-variants.json) ยืนยัน stock/reservation แยกกัน แก้ fixture ให้ใช้ variant ของ selected cart item จริง โดยคง assertion สำเร็จหนึ่งคน อีกคน409 และมี order/payment/reservation อย่างละหนึ่ง

อีกรอบใช้ browser environment ที่ตั้ง global Redis URL กับ security unit mock ซึ่งคืน counter1 ตลอด ทำให้หก rate-limit assertions ล้ม แก้เฉพาะ test environment ให้ security unit ใช้ memory counter ส่วน cache/queue integration ยังใช้ Redis DB14/13 จริง ไม่มีการปิด rate limit หรือแก้ security logic เพื่อให้ชุดรวมผ่าน

หน้าแรกใช้ SSR fetch cache 60 วินาที จึงแสดง campaign ที่จบแล้วจาก request ก่อนหน้า แก้ให้การเปิดหน้าใหม่อ่าน discovery ปัจจุบัน หลักฐาน [SSR cache](test-evidence/2026-10-04-audit-completion/homepage-stock-cache.md), shipping รันซ้ำครบห้า profiles และ production freshness ผ่านห้า profiles ยืนยัน UI/API/DB ตรงกัน

Production freshness case ตั้งสถานะ stock เป็น precondition เพื่อทดสอบการอ่าน projection ไม่ได้อ้างว่าเคสเดียวกันสร้าง checkout หรือรับ webhook การจองจริงจาก checkout ครอบคลุมใน shipping และ commerce suites แยกกัน

เก็บผลดิบที่ไม่ผ่านและผลรันซ้ำแยกกัน ผลรวม 130 นับ case/profile เดิมเพียงครั้งเดียวตามผลล่าสุด ไม่บวกจำนวนการรันซ้ำเป็น coverage ใหม่ [ดัชนีหลักฐาน](test-evidence/2026-10-04-audit-completion/README.md) ระบุชุดสุดท้ายและวิธีเก็บ attachments

ปิด PostgreSQL/Redis ที่งานนี้เปิดไว้สำเร็จ ลบเฉพาะ Next caches สามโฟลเดอร์ของงานนี้ และ archive worktrees ทั้งสามแบบกู้คืนได้ เก็บข้อมูล PostgreSQL กับ traces/videos ในเครื่องไว้ ไม่มี task ports 3100/3101/55439/56379 เปิดค้าง ดู [cleanup](test-evidence/2026-10-04-audit-completion/cleanup.json)

## ยังไม่ได้ทดสอบและข้อจำกัด

ยังไม่ได้ตรวจ provider/bank sandbox จริง เพราะไม่มีชื่อ provider, sandbox และหลักฐานจากภายนอก CLI จึงรายงาน `externalVerification: NOT_VERIFIED` เสมอ ไม่ถือว่า manifest ทดสอบเป็นหลักฐานธนาคาร รองรับชุดตรวจก่อนใช้งานจริงแล้ว และไม่มีธุรกรรมเงินจริงในงานนี้

ยังไม่ได้รัน migration หรือ historical repair บน production ต้องมี original facts ที่ตรวจสอบได้ก่อน เครื่องมือปฏิเสธการเดาราคา ค่าธรรมเนียม หรือแหล่งทุนย้อนหลัง

Analytics ที่ 20,000 candidates/concurrency20 วัด p95 7,406.71ms, peak heap ประมาณ 1,461.6MiB และ RSS ประมาณ 1,862.1MiB มี browser รันบางช่วงร่วมกัน จึงใช้เป็นหลักฐานขอบเขตเครื่องนี้ ไม่ใช่การเทียบ performance ก่อน/หลัง ระบบ ranking ยังโหลด candidates ทั้งชุด และยังไม่มี production latency budget ที่ตกลงไว้

AI score ผ่านการตรวจค่าขอบใน service/API แต่ไม่มี UI ที่แสดง score และไม่มี embedding provider จริงใน environment การตรวจนี้ไม่ได้ยืนยันคุณภาพ retrieval ของ provider ภายนอก

Redis 7.2.14 เป็น Windows build จาก community ใช้ PostgreSQL 17 และ browser profiles ในเครื่อง ไม่ได้ยืนยัน Linux deployment หรือเครื่องผู้ใช้ทุกแบบ

หน้าแรกที่เปิดค้างยังใช้ client query cache 60 วินาทีและไม่มี polling งานนี้ยืนยันการอ่านข้อมูลใหม่เมื่อเปิดหน้าใหม่ ส่วน checkout ตรวจราคาและ inventory ปัจจุบันใน transaction เสมอ

## การตัดสินใจ

Model the Domain ทำให้ตรึง original NET/TAX และ interval ของจำนวนที่คืน แทนการคำนวณจากราคาหรือนโยบายปัจจุบัน Type System Discipline ทำให้ UI รับชนิดจาก Eden และคืนเงินเป็น decimal string Prove It Works ทำให้ผลผ่านต้องมีการรันจริงบน PostgreSQL, Redis และ browser ตามชั้นที่ระบุ ดู [decision trail](numeric-audit-decisions.tsv) และ [completion plan](numeric-audit-completion-plan.md)
