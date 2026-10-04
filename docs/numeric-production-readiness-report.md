# ผลปิดช่องว่างตัวเลขก่อน production

วันที่ 5 ตุลาคม 2026, Asia/Bangkok ฐานงาน `aabb535`
Source commits รอบนี้คือ `d96154d` สำหรับ CI, `832274a` สำหรับ startup capability
และ `256e244` สำหรับ read-only audit พร้อม regression tests

**งานเดิมหลายรายการเสร็จแล้ว รอบนี้เพิ่มเฉพาะช่องว่างที่หลักฐานเดิมยังไม่ครอบคลุม**
Local verification ผ่าน แต่ยังยืนยันตัวเลขทั้งระบบ production ไม่ได้
เพราะยังไม่มี provider, bank, staging และ production access
แผนที่แยกงานซ้ำอยู่ใน [readiness plan](numeric-production-readiness-plan.md)

## งานเดิมที่ใช้ผลต่อ

| งานที่ทำแล้ว | ผลเดิมและหลักฐาน |
| --- | --- |
| exact money, tax, coupons, cumulative partial refunds, affiliate, Bangkok calendar | [completion report](numeric-audit-completion-report.md), tests1,745 ผ่าน ไม่มี skips |
| buyer, seller, admin และ UI, API, DB | [130 browser configurations](test-evidence/2026-10-04-audit-completion/verification-summary.json) ผ่านบนห้า profiles |
| rollback, inventory concurrency, duplicate webhook, shared coins | actual PostgreSQL และ Redis ใน completion report |
| analytics capacity | [234 requests](test-evidence/2026-10-04-audit-completion/analytics-load/integrated-report.json), ใช้ measurement เดิม |

ไม่มี UI source เปลี่ยนในรอบนี้ จึงไม่รัน browser130 configurations เดิมซ้ำ
Playwright `--list` รอบใหม่เป็น discovery สำหรับ CI เท่านั้น

## งานเพิ่มและสถานะ

| ID | ผล | หลักฐานและขอบเขต |
| --- | --- | --- |
| R1 | PASS local | [CI gates](test-evidence/2026-10-05-production-readiness/r1-ci.md): isolated tax, rollout, audit DBs; unit Redis isolation; integration completeness gate; Prisma generation ต่อ checkout |
| R2 | PASS local | [6 PostgreSQL regressions](test-evidence/2026-10-05-production-readiness/r2-report.md): old v1, existing v2, flag-off, original NET/TAX, replay และ stale quote ไม่มี partial writes |
| R3 | PASS tooling/local | [26 tests](test-evidence/2026-10-05-production-readiness/r3-read-only-audit.md): read-only role, privileged roles rejected, exact amounts, stable snapshot, malformed fixtures rejected |
| R3 | PASS restored fixtures | [369 orders ผ่าน14 checks](test-evidence/2026-10-05-production-readiness/r3-restored-read-only-audit.json), reader มี SELECT เท่านั้น; [106 tables/8,978 rows unchanged](test-evidence/2026-10-05-production-readiness/r3-after-read-only-comparison.log) |
| R3 | NOT_EXECUTED production | ไม่มีข้อมูลหรือสิทธิ์อ่าน production; remote TLS handshake ยังไม่ได้ทดสอบจริง |
| R4 | NOT_VERIFIED external | ไม่มี provider, bank, sandbox หรือ original records; synthetic references ไม่นับเป็น external proof |
| R5 | PASS local upgrade | [20→22 migrations](test-evidence/2026-10-05-production-readiness/r5-upgrade-comparison.log), old-schema revision `a4dd98a`; original104 tables/14 fixture rows unchanged รวมเงิน9007199254740993; current schema drift exit0 |
| R5 | PASS local recovery | [backup/restore](test-evidence/2026-10-05-production-readiness/r5-recovery-summary.json): 106 tables/8,978 rows และ22 migrations ตรงทุก hash; backup530ms, restore1,843ms บนฐาน disposable |
| R5 | PASS local OS restart | [สอง API processes](test-evidence/2026-10-05-production-readiness/r5-process-restart.json) ใน production mode: readiness200, authenticated tax capability true แล้ว false, default tax0; ทั้งสองหยุดแล้ว |
| R5 | NOT_EXECUTED deployment | ยังไม่ได้รัน GitHub Actions/Linux, staging routing, mixed binary revisions หรือ promote production; local recovery ไม่พิสูจน์ production RPO/RTO |
| R6 | PASS available evidence | ใช้ cold-walk baseline และเพิ่ม failure/flag-off proof ตาม R2; [release runbook](numeric-release-runbook.md) พร้อม review |
| R7 | PARTIAL | measurement เดิมยังใช้ได้ แต่ไม่มี agreed production SLO; mounted-home refresh60s และ AI embedding provider จริงยังไม่ยืนยัน |

ค่า flag ถูกจับเมื่อสร้าง instance แก้ `TaxPolicyService` ให้รายงาน capability
ตรงกับ evaluator ที่กำลังทำงาน หลักฐานก่อนแก้อยู่ใน [R2 red run](test-evidence/2026-10-05-production-readiness/r2-red.log)
stored policy ยังอ่านจาก DB ตามปกติ การปิด flag ต้อง restart ทุก API instance
และเก็บ code ที่คืนเงินจาก snapshots v2 เดิมได้

Review พบ checker เดิมมองข้าม missing v2 item snapshot และยอด shipping-only refund
เพิ่มสอง checks ใน runner ใหม่โดยเก็บ SQL เดิม12 checks
[red actual PostgreSQL](test-evidence/2026-10-05-production-readiness/r3-completeness-red.json)
พบสองกรณีผิดที่ยัง PASS ก่อนแก้
[green](test-evidence/2026-10-05-production-readiness/r3-completeness-green.json)
ผ่าน26 tests หลังแก้ รวม positive cases และ CLI exit1 เมื่อคลาดหนึ่งสตางค์
นี่เป็นบั๊กใน audit checker ไม่ใช่หลักฐานว่ามี orders production ผิด

## ผลตรวจรวมรอบนี้

- [Tests1,813 ผ่าน](test-evidence/2026-10-05-production-readiness/full-tests-final.json), 201 files, failed0, skipped0
  เพิ่ม68 tests จาก baseline ได้แก่ CI gate36, audit26 และ rollout6
- [CI result gate](test-evidence/2026-10-05-production-readiness/final-ci-report.log) ยืนยัน integration31 files ถูก execute ครบ
- [Typecheck และ i18n exit0](test-evidence/2026-10-05-production-readiness/final-check-exits.json)
  i18n มี keys2,288 ต่อภาษา ไม่มี placeholder mismatch
- [Production build exit0](test-evidence/2026-10-05-production-readiness/final-build.log)
- [Standards review](test-evidence/2026-10-05-production-readiness/review-standards-final.md)
  และ [Spec review](test-evidence/2026-10-05-production-readiness/review-spec-final.md)
  ปิด findings เดิมทั้งสาม ไม่มี material finding ค้างใน source R1–R3
- [Comments review](test-evidence/2026-10-05-production-readiness/comments-final.md)
  ไม่พบ comments หรือ suppressions ใหม่ที่ต้องแก้

ผลแดงระหว่างตรวจยังเก็บไว้ [full-tests.json](test-evidence/2026-10-05-production-readiness/full-tests.json)
พบชื่อ commerce test DB ไม่ตรง guard เฉพาะของ W7 จึงแก้ config และเพิ่ม regression
อีกครั้ง [wrong runner](test-evidence/2026-10-05-production-readiness/full-tests-wrong-runner.json)
เกิดจากเรียก Vitest ตรงโดยไม่ได้ exclude Playwright specs เป็นความผิดพลาดของคำสั่งตรวจ
ผลสุดท้ายใช้ `bun run test` ซึ่งแยก runner ถูกต้อง ไม่มี assertion ของผลิตภัณฑ์ถูกลดลง

Probe script ใช้ Node child-process API ที่มี types ในโครงการแทน Bun globals
หลัง typecheck พบ missing Bun types หลักฐานก่อนแก้เก็บใน `process-probe-typecheck-red.log`
ผล probe และ typecheck หลังแก้ผ่าน ไม่เพิ่ม runtime dependencies

## สิ่งที่ยังต้องยืนยันก่อนเปิดจริง

Provider และ bank ต้องมีต้นฉบับ status, signature, currency, gross, fee, net
สำหรับ payment, refund และ payout พร้อม retry/duplicate proof
Staging และ production ต้องมี topology, read-only audit access และ recovery target
เจ้าของธุรกิจต้องกำหนด tax policy จริงและ capacity budget
ค่า7% ใช้ใน fixtures ค่า production default ยัง0 และ flag default false

Capacity เดิมมี ranking p95ประมาณ7,406.71ms และ peak heapประมาณ1,461.6MiB
ภายใต้ fixture load ของรายงานเดิม ตัวเลขนี้ไม่ยืนยันว่าเข้า production SLO
ไม่มีการรัน load เดิมซ้ำเมื่อ source ranking และ infra ไม่เปลี่ยน

ใช้ Boundary Discipline แยก audit credentials และปฏิเสธ writer roles
ใช้ Prove It Works ตรวจฐาน PostgreSQL, Redis, API restart และ recovery จริงในเครื่อง
เก็บ provider และ production verdict ตามหลักฐานที่ยังขาด

[Cleanup](test-evidence/2026-10-05-production-readiness/cleanup.json) ยืนยัน task ports ปิดแล้ว
เก็บ DB data และ dump นอก repository ไว้ ระบบตรวจอนุมัติอัตโนมัติปฏิเสธ
การลบ `.next-audit-readiness` ด้วยเหตุผล `blocked by policy` จึงเก็บ ignored cache ไว้
