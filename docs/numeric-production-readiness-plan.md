# แผนปิดช่องว่างตัวเลขก่อน production

วันที่ 5 ตุลาคม 2026, Asia/Bangkok ผู้ใช้ให้วางแผนทั้งหมดก่อนแล้วทำต่อให้ครบในรอบเดียว
ฐานงานคือ `aabb535`: tests 1,745 ผ่านและ browser 130 configurations ในเครื่อง
ผลเดิมเป็น baseline ไม่ใช่ผล CI/Linux/provider/production ใหม่

## งานที่เสร็จแล้วและใช้หลักฐานเดิม

ผู้ใช้ถามว่างานในรายการเคยทำแล้วหรือไม่ จึงแยก baseline ออกจากงานใหม่ก่อน implementation

| เสร็จแล้ว | หลักฐาน | ทำซ้ำเมื่อใด |
| --- | --- | --- |
| exact money, ภาษี inclusive/exclusive, coupon stacking, partial quantities/affiliate, Bangkok calendar | [completion report](numeric-audit-completion-report.md) และ 1,745 tests | source ที่เกี่ยวข้องเปลี่ยนหรือ regression ใหม่ |
| UI/API/DB บนห้า profiles รวม buyer/seller/admin และ production-mode finance | [130 configurations](test-evidence/2026-10-04-audit-completion/verification-summary.json) | เปลี่ยน UI/API/settlement หรือพบ flow ใหม่ที่ยังไม่มี proof |
| inventory concurrency/rollback, duplicate webhook และ shared buyer coins | actual PostgreSQL/Redis proof ใน completion report | writer/transaction/protocol เปลี่ยน |
| local historical และ external comparison tooling | 26 และ 33 tests ใน report | input/database boundary ใหม่ ไม่ใช่สร้าง tool เดิมซ้ำ |
| analytics bounded load | [234 requests](test-evidence/2026-10-04-audit-completion/analytics-load/integrated-report.json) | เปลี่ยน ranking/infra หรือมี capacity budget ที่ต้องพิสูจน์ |
| backup/restore mechanics และ CI YAML รุ่นเดิม | [production checklist](production-acceptance-checklist.md) | ทดสอบเฉพาะ upgrade/mixed-version/current schema ที่หลักฐานเก่าไม่ครอบคลุม |

สิ่งที่เพิ่มจริงในแผนนี้คือ CI TAX gate, flag-off/mixed-version proof, boundary ของ
production read-only audit, current-schema release rehearsal และข้อมูลภายนอกจริง
R6 ใช้ browser baseline เดิมก่อน R7 ไม่รัน load เดิมซ้ำเพื่อเพิ่มจำนวนผลผ่าน

## เป้าหมายและภาพการใช้งาน

มณีฝ่ายบัญชีเปิด order ของลูกค้าที่ใช้คูปองร้านและ platform เห็นยอดจ่าย NET/TAX
ตรงกับ payment และต้นฉบับ provider เมื่อคืนสินค้าบางชิ้น เธอตรวจยอดจากสิทธิ์เดิม
แล้วพบว่าเงินคืน wallet/coins/affiliate ตรงกัน แม้ราคาหรือนโยบายภาษีเปลี่ยนไป
รายงานบอกชัดว่าชั้นใดผ่าน ชั้นใดยังไม่ยืนยัน พร้อมหลักฐานที่เปิดอ่านได้

ตัวอย่างมาตรฐานจากการรันเดิม: inclusive 7%, สินค้า 10,700 สตางค์ หักร้าน 1,070
และ platform 1,070 ผู้ซื้อจ่าย 8,560 = NET 8,000 + TAX 560 ส่วน platform NET 1,000
+ TAX 70; reported VAT 630, added VAT 0 อัตรา 7% เป็น fixture ไม่ใช่อัตราที่ตั้งให้ร้านจริง
partial original cash 101, NET 94, TAX 7, Q3 คืน cash 33/33/35 และ NET/TAX แยกสะสม
ใช้ตัวเลขเหล่านี้เป็น expected อิสระ ไม่ import สูตรที่กำลังทดสอบมาคำนวณ expected

## Skills และหน้าที่

| Skill | ใช้กับงาน |
| --- | --- |
| Poteto Mode / unslop | แบ่งงานเป็นหน่วยตรวจได้ รายงานตรงหลักฐาน และข้อความอ่านรู้เรื่อง |
| last-20-percent | walk จาก buyer/seller/admin รวม first-run, failure และการกลับมาอ่าน order เก่า |
| how / architect | ไล่เส้นทาง quote → order → payment → refund และออกแบบขอบเขต audit ที่อ่านอย่างเดียว |
| blast-radius | พิสูจน์ผลของ v1/v2, flag, mixed deployment และการถอย release |
| deployment-pipeline-design | ใช้ workflow เดิม สร้าง gates/rehearsal/runbook และเงื่อนไขหยุด rollout |
| typescript-best-practices | operational TypeScript, exact money, generated types และ input boundary |
| prisma-cli | migrations/generate/schema checks บนฐาน disposable/staging ที่ได้รับสิทธิ์ |
| e2e-testing-patterns / webapp-testing | UI/API/DB walk และแนบหลักฐานจาก browser จริง |
| diagnosing-bugs | ใช้เมื่อ reproduce defect ได้ เพิ่ม regression และแก้ต้นเหตุ |
| code-review | ตรวจ source/หลักฐานรอบสุดท้ายโดยแยกจากผู้แก้ |

## งานทั้งหมดและเกณฑ์ผ่าน

| ID | งานและ deliverable | เกณฑ์ผ่าน | การพึ่งพา / สถานะเริ่มต้น |
| --- | --- | --- | --- |
| R1 | ทำ CI ให้ครอบคลุม numeric gates จริงและอัปเดตเอกสารที่ยังอธิบายเงินเป็น number/ภาษี0/คืนเต็มจำนวน | quality มีฐาน TAX แยก, mock unit ไม่ชน global Redis, integration ไม่ถูกข้าม, browser มี v2 cases และ production safeguards; docs ตรง source | ทำได้ทันที / ยังไม่เริ่ม |
| R2 | blast-radius และ regression ของ flag/rollback | v1 อ่านต่อได้; v2 ที่ขายแล้วคืน NET/TAX เดิมหลังปิด flag; policy/quote เปลี่ยนต้องยืนยันใหม่โดยไม่มี partial writes; การ replay ไม่ลง ledger ซ้ำ; ระบุ instance restart และ code rollback ที่ปลอดภัย | ทำได้ทันที / ยังไม่เริ่ม |
| R3 | ช่องทาง audit production แบบอ่านอย่างเดียว แยกจากเครื่องมือ fixture | ต้องใช้ read-only DB role + READ ONLY transaction; runner ไม่มี apply; ตรวจยอด/ขอบ stock/refund/ledger/currency พร้อม exact strings; ปฏิเสธ writer role; proof จริงบน PostgreSQL ว่าเขียนไม่ได้และข้อมูลไม่เปลี่ยน | tooling ทำทันที; production scan รอสิทธิ์อ่าน |
| R4 | provider/bank sandbox และ reconciliation จริง | ได้ original records/refs/signature/status/currency gross-fee-net; ชำระ/คืน/จ่าย sandbox ตาม capabilities จริง; duplicate/out-of-order/retry ไม่เกิดรายการเงินซ้ำ; UI/API/DB ตรง records; synthetic manifest ไม่นับเป็น external pass | รอชื่อ provider/bank, sandbox และ test accounts |
| R5 | rehearsal deployment/migrations/backup/rollback และ Linux gates | รัน artifact revision เดียวบน disposable infrastructure; migrations ไม่มี drift; restore ตรวจยอด/จำนวน; code/flag rollback ยังประมวลผล v2 เดิม; CI/Linux ที่ยังไม่รันระบุ NOT_EXECUTED; production เปิดใช้หลัง review release packet เท่านั้น | R1–R3; staging/prod topology ยังไม่ทราบ |
| R6 | สังเคราะห์ cold-walk evidence เดิม และ final readiness packet | buyer/seller/admin proof เดิมยังตรง source; ตรวจใหม่เฉพาะช่องว่าง flag-off/failure ที่พบ; report อ่านพบ verdict ก่อนรายละเอียดและทุก claim มี proof | baseline ผ่านแล้ว; ไม่รัน 130 configurations เดิมซ้ำถ้า source ไม่เปลี่ยน |
| R7 | ขอบเขต capacity และ provider-dependent features | นำผล 234 requests เดิมระบุข้อจำกัด; ไม่ประกาศผ่าน production SLO หากไม่มี capacity budget; mounted-home refresh และ AI embedding จริงระบุการพึ่งพา | measurement เดิมเสร็จแล้ว; ยังไม่ต้อง rerun ถ้า ranking/infra ไม่เปลี่ยน |

การทำงาน: บันทึกแผน → R1/R2/R3 เป็น batch แรก → R4 ตามข้อมูลที่ได้รับ → R5/R6/R7
→ source review → required checks → รายงานและ local commits
งานอิสระแยก ownership เมื่อใช้ agents ไม่ให้แก้ไฟล์เดียวกัน ไม่สร้างระบบใหม่ที่อยู่นอก core money flow

## ขอบเขตที่จะเปลี่ยน

- CI/config/docs, Checkout/Tax rollout, operational audit scripts และ tests
- อ่าน Order/OrderItem/ShopOrder/sale snapshots, Payment, Refund/allocations,
  Inventory/reservations, ShopWallet/ledger, coins, affiliate และ payout ตาม scope ของ checker
- เริ่มจาก schema ที่มีอยู่ ไม่เปลี่ยน model จนมีเหตุจำเป็น ถ้าเปลี่ยนต้องทำผ่าน Prisma
  และ generate ก่อน tests/typecheck/build
- ไม่ลด assertions เดิมเพื่อให้ผ่าน ไม่เดาราคา/อัตราภาษี/fees หรือเติมประวัติจาก settings ปัจจุบัน

## ข้อมูลที่ยังต้องมี

1. Provider/bank ที่ใช้จริง, sandbox endpoints, วิธีส่ง secrets ผ่าน environment/secret store,
   test account/recipient และ acquisition ของ original records ไม่ใส่ credentials ในรายงาน
2. Staging/production URLs หรือ sanitized snapshot/read-only access, วิธี deploy,
   จำนวน instances, backup/restore target และช่องทางอ่าน metrics
3. Tax policy จริงและ capacity budget จากเจ้าของระบบก่อนเปิดใช้ ไม่ตั้ง 7% ให้อัตโนมัติ

หากยังไม่มีข้อมูล ให้ทำ tooling/fixtures/rehearsal ทั้งหมดที่ทำได้ต่อไป แต่ R4 และ
production scan/deploy ยังเป็น NOT_VERIFIED/NOT_EXECUTED เวลาที่ผ่านไปไม่ใช่สิทธิ์หรือหลักฐาน
เตรียม release packet ให้ตรวจได้ก่อนขอการตัดสินใจเปิด production ไม่มีธุรกรรมเงินจริงใน audit

## ความเสี่ยงและเงื่อนไขหยุด

- ค่า flag ถูกอ่านเมื่อสร้าง evaluator จึงต้องพิสูจน์ผลหลัง restart ทุก instance
  ไม่เสนอ canary เป็นเปอร์เซ็นต์ เพราะ flag ปัจจุบันเป็น boolean ไม่มี cohort routing
- อย่าถอยไป binary ก่อนรองรับ v2 หลังมี v2 orders; ปิดการสร้าง v2 ใหม่และเก็บ code ที่อ่าน
  snapshots/คืนเงินเดิมได้ การลบ snapshot/ledger เพื่อ rollback ใช้ไม่ได้
- พบ discrepancy แม้หนึ่งหน่วยเงิน, duplicate financial posting, stock bounds ผิด,
  incomplete original facts หรือ read-only audit เขียนได้ ต้องหยุด promotion
- ตรวจ health ของ DB/cache/queue และ production safeguards ก่อน promotion;
  green unit tests หรือ synthetic external refs อย่างเดียวไม่พอ
- Analytics แบบ all-candidates เป็น capacity risk เดิม ยังไม่มี agreed SLO สำหรับ ranking;
  ไม่แก้ด้วยการตัด candidates ซึ่งทำให้ลำดับ/ยอดนับผิด

## Finish list

- [x] R1 CI/เอกสารตรง source พร้อม proof; actual Actions execution ยังไม่รัน
- [x] R2 flag/rollback พร้อม6 literal PostgreSQL regressions และ local OS restart
- [x] R3 read-only audit tooling +26 tests และ actual PostgreSQL boundary proof
- [ ] R3 production data scan จากแหล่งจริง: รอ read-only access
- [ ] R4 external sandbox proof: รอ provider/bank และ original records
- [x] R5 local20→22 migration,8,978-row recovery และ release runbook
- [ ] R5 actual staging/Linux/production promotion: รอ environment และ authorization
- [x] R6 ใช้130-configuration cold walk เดิม และรายงานชั้นที่ยังขาด
- [x] R7 ใช้234-request measurement เดิมและระบุ capacity/provider/refresh limitations
- [x] final source review, tests1,813/0skips, typecheck/build/i18n และ evidence links
- [x] local source commits `d96154d`, `832274a`, `256e244`; เอกสารและ proof packet บันทึกต่อท้าย

ผลและความคืบหน้าจะบันทึกใน `numeric-production-readiness-report.md` และ
`test-evidence/2026-10-05-production-readiness/` โดยไม่แก้สถานะ historical evidence ให้กลายเป็นผลใหม่

ผลล่าสุดอยู่ใน [readiness report](numeric-production-readiness-report.md)
งาน local ที่ทำได้เสร็จแล้ว รายการ production/external ที่ยังไม่มี inputs ยังเปิดไว้
browser discovery ใหม่เป็นการตรวจ selection ของ CI ไม่ใช่ browser execution ใหม่
