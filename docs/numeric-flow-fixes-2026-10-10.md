# ผลแก้ไข flow ตัวเลข marketplace วันที่ 10 ตุลาคม 2026

แก้ข้อบกพร่องที่ยืนยันใน [ผล audit เดิม](numeric-flow-audit-2026-10-10.md) แล้ว พร้อม regression tests และผลตรวจรวมรอบแก้ไข โดยเก็บหลักฐานที่เคยล้มไว้ครบ ไม่มีการเปลี่ยน schema หรือแก้ข้อมูล production

| ข้อบกพร่อง | การแก้ไขและ regression |
| --- | --- |
| Flash quota กับ expired ACTIVE holds | การรับ checkout นับ ACTIVE ทั้งหมดจนเปลี่ยนสถานะจริง ใช้ lock เดิมของ FlashSaleItem; PostgreSQL ตรวจ global/per-user quota, late PAID, webhook replay และ worker release |
| แก้โควตาระหว่าง checkout | การนับ hold ของ promotion ใช้กติกาเดียวกัน การลด stockLimit และลบ item ล็อกแล้วตรวจ sold/ACTIVE ซ้ำใน transaction; PostgreSQL ตรวจ stale read และ checkout ที่ยังไม่ commit รวมถึง campaign ที่ย้ายกลับไป scheduled |
| Tracking DTO | ใช้ชนิดที่ infer จาก endpoint tracking โดยตรง หน้าอ่าน shipmentId/trackingNo/timeline จริง จึงไม่ต้องสร้างยอดเงินหรือ timestamp ที่ไม่มีใน response |
| หน่วยราคาใน search | facets และ chips แสดงบาท ช่องราคาแปลงข้อความทศนิยมเป็นสตางค์ด้วย parser เดิม ปฏิเสธเศษสตางค์ ค่าติดลบ ค่าที่ไม่แม่นยำ และช่วงกลับด้าน เมื่อ bounds ใน URL เปลี่ยนจะรีเซ็ตช่องกับข้อความผิดพลาด |
| Unsafe price filters | HTTP และ service ปฏิเสธราคาที่เกิน safe integer ก่อนแปลงเป็น BigInt ค่าที่เคยตอบ 500 รวม Int64 maximum และ 1e100 ตอบ validation 422 |
| Pagination overflow | search/catalog/recommendation/review ตรวจ page และ computed skip ให้อยู่ใน Int32; catalog ที่มี cursor ใช้ skip 1 ตามเดิม และ limit contracts คงเดิม |
| Persisted Int32 fields | weightGrams/lengthMm/widthMm/heightMm และ flash stockLimit/perUserLimit ตรวจช่วงทั้ง HTTP และ service; dimensions รองรับ zero/null, quota update ของ item ที่ยังว่างรองรับ zero |
| CI database URLs | เอา schema query ออกจาก 6 URLs ของ quality job โดยไม่ลดข้อจำกัด finance reconciliation/read-only audit; ชุดรวมอ่าน URLs จาก workflow ที่แก้จริง |
| Optional AI money/currency | fallback ใช้ BigInt แสดง 10000 สตางค์เป็น 100.00 THB และเก็บค่าเกิน 2^53 ครบ lexical fallback ใช้ currency ของ variant |
| Browser expectations | ราคาใน JSON ต้องเป็น canonical strings, order locator ใช้ heading ที่ตรงชื่อ, lost checkout response กู้คืนผ่าน history และตรวจหนึ่ง Order/Checkout/Payment/InventoryReservation พร้อม reserved quantity |

Browser search journey เพิ่มการกรอก 10.01/20.00 บาทแล้วตรวจ request จริงเป็น 1001/2000 สตางค์และผลสินค้าที่ถูกต้อง การแก้ expectations ยังตรวจ cache invalidation, snapshots, shipping/tracking และ recovery ตาม contract เดิม

ผล focused ของแต่ละส่วนมีการรันซ้ำและทับซ้อนกัน จึงไม่บวกเป็นจำนวน tests ใหม่ ดู [flash red/green](../.audit/numeric-fixes-2026-10-10/flash-results.md), [boundary evidence](../.audit/numeric-fixes-2026-10-10/boundaries-report.md), [UI evidence](../.audit/numeric-fixes-2026-10-10/ui-summary.md) และ [projection probes ที่รันซ้ำ](../.audit/numeric-fixes-2026-10-10/projection-probes.log)

ชุดรวม Vitest ผ่าน 1,895/1,895 ไม่มี failures หรือ skips และ integration gate ผ่านครบ 32 integration files โดยอ่านค่า database URLs จาก CI workflow ที่แก้จริง Typecheck และ production build ผ่าน exit 0 ดู [quality JSON](../.audit/numeric-fixes-2026-10-10/quality.json), [gate](../.audit/numeric-fixes-2026-10-10/quality-gate.log), [typecheck](../.audit/numeric-fixes-2026-10-10/typecheck-final.exitcode) และ [build log](../.audit/numeric-fixes-2026-10-10/build.log)

Browser matrix ผ่าน 207/207 configurations ไม่มี failures/skips/flaky: Chromium 42, Firefox 41, WebKit 41, Pixel 7 41, iPhone 13 41 และ auth setup 1 ทั้ง 207 มี expectedStatus และผลจริงเป็น passed ตัวตรวจรายงานยืนยันจำนวนแต่ละโปรไฟล์และไม่พบ runner errors ดู [browser JSON](../.audit/numeric-fixes-2026-10-10/browser.json) และ [summary](../.audit/numeric-fixes-2026-10-10/browser-summary.json) จำนวนนี้รวมการทดสอบ flow ซ้ำบนโปรไฟล์ต่างกัน ไม่ใช่ 207 flow ที่ไม่ซ้ำกัน Browser ใช้ development servers และ mock payment; production build เป็นการตรวจแยก ไม่มี production-server browser run

หลัง browser หยุด ตรวจ 12 invariants เดิมใน 266 orders, 266 payments, 342 items และ 296 shop orders พบ violations 0 ทุกข้อ ดู [ผล SQL](../.audit/numeric-fixes-2026-10-10/invariants-final.json) เพิ่ม flash quota checks ใน statement เดียว: global soldCount + ACTIVE ไม่เกิน stockLimit ครบ 30 items และต่อผู้ซื้อ ACTIVE + COMMITTED ไม่เกิน perUserLimit ครบ 5 กลุ่ม ทั้งสองมี violations 0 ดู [flash state](../.audit/numeric-fixes-2026-10-10/flash-state-final.json) และ [SQL predicates](../.audit/numeric-fixes-2026-10-10/verify-flash-state.ts) การตรวจ flash นี้ไม่ reconcile soldCount กับจำนวน COMMITTED และไม่ตรวจข้อมูล production

การนับ ACTIVE จน cleanup ทำให้ worker ที่ล่าช้าคงโควตาไว้ ซึ่งสอดคล้องกับ hold ที่ยังรับชำระได้ การแก้ไขไม่ปรับยอดที่ oversubscribe ไปแล้วในอดีต และไม่เปลี่ยนนโยบาย settlement ของ payment เดิม

Webhook ปัจจุบันไม่มี currency field จึงแก้เอกสารให้ตรงกับ contract แทนการอ้างว่า verified currency จาก provider แล้ว ยังต้องกำหนด signed currency contract เมื่อเชื่อม provider จริง Admin affiliate summary ยังต้องกำหนดความหมาย original awards หรือ net หลัง reversals ก่อนเปลี่ยนสูตร ไม่มีการเดาสัญญาธุรกิจสองส่วนนี้

การทดสอบใช้ PostgreSQL/Redis แยกและ mock payment ไม่มี external provider/bank transfer หรือ production data ใน 12 invariants เดิม snapshot completeness ตรวจเฉพาะ ShopOrder; atomic tax เริ่มจาก sale snapshots ที่มีอยู่จึงไม่จับ snapshot ที่หายไป; planned refund cash ไม่รวม shipping-only plans Counts กับ violations เป็นคนละ query หลังหยุด flow ทดสอบ จึงไม่ใช่หลักฐาน concurrent repeatable snapshot การทดสอบยอด coins ระดับเกิน Int32 ใน audit เดิมเป็น legacy/v1; ไม่เพิ่มคำกล่าวอ้างถึง V2 ระดับนั้นหรือ Int64 exhaustion

คืน tsconfig ที่ Next สร้างและ historical finance CLI evidence กลับต้นฉบับ โดยเก็บผลใหม่กับ patch ไว้ในรอบแก้ไข Typecheck หลังคืนไฟล์ผ่าน exit 0 ปิด PostgreSQL/Redis ที่ตรวจสอบ ownership แล้วด้วย exit 0 และ ports 3410/3411/55439/56379 ไม่มี listener ดู [cleanup](../.audit/numeric-fixes-2026-10-10/cleanup.json) เก็บข้อมูลทดสอบและ caches ไว้ ไม่ลองลบ cache ซ้ำหลังระบบอนุมัติปฏิเสธใน audit เดิม

ผู้ตรวจอิสระตรวจ diff และ SHA-256 ของ source/test/config 39 ไฟล์ว่าตรงกับไฟล์ที่ทดสอบ ดู [source manifest](../.audit/numeric-fixes-2026-10-10/source-manifest.json) ผลไม่อ้างว่า browser development logs ไม่มี warnings; raw log เก็บข้อความ pg deprecation, image และ hydration/caret ที่เกิดระหว่าง screenshot ไว้ครบ

หลักฐานรอบแก้ไขอยู่ใน [.audit/numeric-fixes-2026-10-10](../.audit/numeric-fixes-2026-10-10/) พร้อม [decision trail](../.audit/numeric-fixes-2026-10-10.tsv) และ [independent review](../.audit/numeric-fixes-2026-10-10/independent-review.md)
