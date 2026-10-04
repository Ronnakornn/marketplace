# เปิดใช้และหยุดรับ checkout v2

ใช้คู่มือนี้หลังตรวจ [readiness report](numeric-production-readiness-report.md)
และ [production acceptance checklist](production-acceptance-checklist.md)
แล้ว สถานะ local PASS ไม่อนุมัติให้ deploy หรือทำธุรกรรมเงินจริง

## เตรียม release

1. ระบุ commit และ artifact digest เดียวสำหรับ API, web และ worker
   บันทึกจำนวน instances, routing, staging URL และผู้ตัดสินใจเปิดใช้
2. รัน workflow `production-gates.yml` บน revision นั้น เก็บ quality JSON,
   production browser และ development mock browser artifacts
   ต้องผ่าน gate ที่ตรวจ integration ครบและไม่มี skipped tests
3. สำรองฐานก่อน migration ด้วย `bun run db:backup <absolute-backup-path>`
   ส่ง `DATABASE_URL` ผ่าน secret store ตรวจไฟล์สำรองบน storage ที่จะใช้กู้คืน
4. กู้คืนสำเนาลงฐานแยกด้วย `RESTORE_DATABASE_URL` และ
   `bun run db:restore <absolute-backup-path> --confirm-restore`
   ตรวจว่าฐานเป้าหมายแยกจาก source ก่อนรัน เทียบจำนวนแถวและยอดเงิน exact
   บันทึกเวลาเทียบกับ RPO และ RTO ที่เจ้าของระบบกำหนด
5. ใช้ Prisma migrations จาก artifact ที่เลือกด้วย
   `bun run db:migrate:deploy` แล้ว `bun run db:generate`
   ตรวจ schema drift ด้วย `bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
   ห้ามแก้ตารางตรงหรือใช้ `db push` เพื่อแทนประวัติ migrations

## ตรวจฐานแบบอ่านอย่างเดียว

ให้ DBA เตรียม login ที่มี CONNECT, USAGE และ SELECT ครบตารางที่ต้องตรวจ
role ต้องไม่มี ownership, CREATE, สิทธิ์เขียน, privileged membership หรือ
SECURITY DEFINER ที่ runner ปฏิเสธ ฐานที่เปิด RLS ต้องมีแผน audit แยก

ส่งค่าต่อไปนี้ผ่าน environment โดยไม่บันทึก credentials ใน evidence:

- `AUDIT_DATABASE_URL` และ `AUDIT_EXPECTED_HOST`
- `AUDIT_EXPECTED_DATABASE` และ `AUDIT_EXPECTED_ROLE`
- สำหรับ remote ใช้ `sslmode=verify-full` และ `AUDIT_TLS_CA_FILE` เมื่อจำเป็น

รัน `bun run scripts/run-numeric-audit.ts` และเก็บ JSON
exit0 หมายถึง 12 snapshot invariants และ 2 completeness checks ผ่านใน
REPEATABLE READ READ ONLY snapshot เดียว exit1 หมายถึง discrepancy
exit2 หมายถึง connection หรือ boundary ถูกปฏิเสธ
ผลนี้ไม่ยืนยันต้นฉบับ provider, bank หรือประวัติ wallet ทั้งหมด

## เปิดใช้บน staging แล้ว production

1. เริ่ม artifact ที่รองรับ v2 โดยตั้ง `CHECKOUT_V2_SETTLEMENT_ENABLED=false`
   ตรวจ `/api/health/ready` และ authenticated
   `/api/admin/checkout/tax-policy` บนแต่ละ instance
2. ตรวจ provider และ bank sandbox จาก records จริง รวม payment, refund,
   payout, duplicate callback, retry และยอด gross, fee, net, currency
   เทียบกับ UI, API และ DB เก็บหลักฐาน signature verification ที่ไม่เปิด secrets
3. ให้เจ้าของธุรกิจกำหนด tax policy จริงผ่าน admin ค่าเริ่มต้น0
   และ fixture7% ไม่ใช่อัตราที่ได้รับการยืนยันสำหรับ production
4. ตั้ง flag true แล้ว restart หรือ replace ทุก API instance
   อ่าน capability ให้ตรง true ก่อนรับ checkout v2
   flag เป็น boolean ไม่มี percentage canary หรือ cohort routing
5. ตรวจ sale snapshots, payment และ refund จากสิทธิ์เดิมบน staging
   รัน read-only audit อีกครั้ง ต้องไม่มี discrepancy
6. ส่ง artifact, CI และ external proof, backup recovery proof, tax policy,
   capacity budget และผล staging ให้ผู้รับผิดชอบตัดสินใจก่อน promotion
   ใช้ deployment mechanism ของระบบจริงหลังได้รับ authorization

## หยุดรับ v2 ใหม่เมื่อพบปัญหา

ตั้ง flag false แล้ว replace ทุก API instance เอา enabled instances เก่าออกจาก routing
ตรวจ capability ของแต่ละ instanceอีกครั้ง เก็บ v2-aware API และ worker ไว้
เพื่อประมวลผล payment, recognition และ refund ของ orders เดิม

เมื่อ stored tax policy ยัง nonzero การสร้าง checkout ใหม่ถูกปฏิเสธ503
อย่าเปลี่ยนเป็น tax0 อัตโนมัติ ลูกค้าต้องรับ quote ใหม่หลังเปลี่ยนนโยบาย
named coupon slots ยังต้องใช้ v2 แม้อัตราภาษี0

หลังมี v2 sales ห้ามถอย binary ไป revision ก่อนรองรับ v2
ห้ามลบ snapshots, allocations หรือ ledger เพื่อย้อน release
หากต้องกู้ข้อมูล ให้แยก target และ reconcile ธุรกรรมที่เกิดหลัง backup ก่อน
การ rehearsal ครั้งนี้พิสูจน์ additive upgrade และ current-schema restore
ยังไม่พิสูจน์ destructive downgrade หรือ multi-instance production rollback
