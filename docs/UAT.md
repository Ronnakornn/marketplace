# เตรียมข้อมูลและทดสอบ UAT ในเครื่อง

ชุดนี้เพิ่มผู้ใช้ 8 บัญชี ร้าน 4 ร้าน สินค้า 20 รายการ รูปสินค้า 52 รูป และออเดอร์ตัวอย่าง 5 สถานการณ์ลงฐาน local ของโปรเจกต์ สินค้าและร้านมีข้อมูลภาษาไทยกับอังกฤษ รูปทั้งหมดอยู่ใน `public/uat` จึงแสดงได้โดยไม่ต้องเรียกรูปจากเว็บภายนอกขณะทดสอบ

## เตรียมและตรวจข้อมูล

หากสินค้าจาก seed เดิมหรือสินค้าทดสอบยังไม่มีรูป ให้รัน `bun run db:seed:product-images` คำสั่งนี้เติมเฉพาะ `ProductImage` ให้ทุกสถานะของสินค้า และแทน URL ตัวอย่าง `example.com/demo/products/` ด้วยไฟล์ local รักษารูปที่อัปโหลดเองไว้ ไม่รีเซ็ตสินค้า สต็อก หรือออเดอร์ ตรวจความครบด้วย `bun run db:seed:product-images --check` และตรวจไฟล์โดยไม่อ่านฐานด้วย `--validate` รูปสินค้า demo ที่ไม่มีภาพถ่ายตรงชนิดใช้ภาพวาด SVG ตัวอย่าง ชุด UAT ใช้ gallery ภาพถ่ายเดิม

รันจากโฟลเดอร์โปรเจกต์ โดยใช้ `DATABASE_URL` ใน `.env.local` สคริปต์อ่าน `.env.local` ก่อน `.env` และรักษาค่าที่ตั้งไว้ใน environment สคริปต์ไม่ใช้ฐานข้อมูลสำรองเมื่อไม่มี `DATABASE_URL`

```powershell
bun run uat:assets --check
bun run db:seed:uat --validate
bun run db:seed:uat
bun run db:verify:uat
bun run dev:uat
```

เปิด [หน้าร้านภาษาไทย](http://localhost:3000/th) และ [ภาษาอังกฤษ](http://localhost:3000/en) คำสั่ง `dev:uat` เปิด mock payment และ `CHECKOUT_V2_SETTLEMENT_ENABLED=true` สำหรับช่องคูปองร้านกับคูปองแพลตฟอร์ม โดยไม่แก้ `.env.local` ค่า fixture ใช้ภาษีศูนย์และ settlement policy 1 ส่วน checkout ใหม่ที่ใส่ช่องคูปองแบบแยกใช้ policy 2

เปิดร้าน UAT โดยตรงได้ที่ [แฟชั่น](http://localhost:3000/th/shops/uat-fashion), [แกดเจ็ต](http://localhost:3000/th/shops/uat-gadget), [บ้านและครัว](http://localhost:3000/th/shops/uat-home) และ [ความงาม](http://localhost:3000/th/shops/uat-beauty) ฐาน local ยังมีข้อมูลเดิมร่วมกับชุดนี้

ถ้าไฟล์รูปยังไม่ครบ ให้รัน `bun run uat:assets` เพื่อเตรียมไฟล์ แล้วรัน `--check` อีกครั้ง `--check` ตรวจไฟล์กับ checksum โดยไม่ใช้เครือข่าย `db:seed:uat --validate` และ `db:verify:uat --validate` ตรวจ manifest รูป และขนาดรูปโดยไม่เชื่อมฐานข้อมูล

ฐานข้อมูลต้องมี schema ปัจจุบัน หากเพิ่งสร้างฐาน local ให้รัน `bun run db:migrate:deploy` และ `bun run db:generate` ก่อน seed

Seed ตรวจไฟล์ก่อนเขียนฐานข้อมูล และเขียนใน transaction เดียว การรันซ้ำไม่เติมสต็อก ไม่ย้อนสถานะออเดอร์ ไม่คืนสินค้าในตะกร้าที่ซื้อแล้ว และไม่เขียนทับการแก้ร้าน รีวิว คำขอคืนสินค้า หรือรหัสผ่านเดิม ไม่มีคำสั่งลบข้อมูลเดิม รหัส fixture คงเดิมทุกครั้ง หมวดหมู่ที่ยังไม่มีชื่อไทยหรือใช้ชื่ออังกฤษในช่องไทยจะได้รับชื่อไทย โดยรักษาคำแปลที่แก้เอง

สคริปต์ปฏิเสธฐานที่อยู่นอก `localhost`, `127.0.0.1`, `::1` โดยปริยาย หากมีความจำเป็นเฉพาะ environment ให้ใช้ `--allow-remote` หรือ `SEED_UAT_ALLOW_REMOTE=true` การใช้ `NODE_ENV=production` หรือชื่อฐานที่มีคำ `prod`/`production` ต้องระบุ `--allow-production` หรือ `SEED_UAT_ALLOW_PRODUCTION=true` เพิ่มด้วย งาน UAT นี้ใช้ฐาน local

หลัง seed สคริปต์ล้างเฉพาะ cache รายการสินค้า การค้นหา หมวดหมู่ คำแนะนำ และ dashboard ร้าน UAT ผ่าน helper ของระบบ หาก Redis ใช้ไม่ได้ ข้อมูลฐานยังคงบันทึกและ log ระบุเหตุการณ์ cache ค่า TTL ปริยายคือสินค้า 300 วินาที การค้นหา 120 วินาที และ dashboard 60 วินาที โดยอาจมีค่าทับใน environment การรีสตาร์ต API ไม่ลบ cache Redis

## เข้าสู่ระบบ

รหัสผ่านเริ่มต้นทุกบัญชีคือ `UatPass123!`

| บัญชี | ใช้ทดสอบ |
| --- | --- |
| `uat-buyer@example.test` | ซื้อสินค้า ชำระเงิน ติดตามออเดอร์ ยกเลิกก่อนชำระ |
| `uat-return@example.test` | รีวิว คืนบางส่วน และติดตามคืนเงิน |
| `uat-fashion@example.test` | ร้าน `uat-fashion` สินค้าแฟชั่น |
| `uat-gadget@example.test` | ร้าน `uat-gadget` อิเล็กทรอนิกส์และแกดเจ็ต |
| `uat-home@example.test` | ร้าน `uat-home` บ้านและครัว |
| `uat-beauty@example.test` | ร้าน `uat-beauty` ความงาม |
| `uat-admin@example.test` | ผู้ดูแลและผู้เริ่ม PROCESSING คืนเงิน |
| `uat-finance@example.test` | ผู้ดูแลอีกคนสำหรับบันทึก completion คืนเงิน |

หากต้องเปลี่ยนรหัสผ่านบัญชี UAT ทั้งชุด ให้ตั้ง `SEED_UAT_PASSWORD` ก่อน seed แล้วนำค่าออกหลังรัน การตั้งค่านี้โดยชัดเจนจะอัปเดตรหัสผ่าน UAT ที่มีอยู่

```powershell
$env:SEED_UAT_PASSWORD = 'รหัสผ่านทดสอบใหม่อย่างน้อย8ตัว'
bun run db:seed:uat
Remove-Item Env:SEED_UAT_PASSWORD
```

ผู้ขายเป็นบัญชี `USER` ที่มี seller profile สถานะ `VERIFIED` ร้าน `ACTIVE` และสมาชิก `OWNER` ตามระบบ แต่ละร้านมีที่อยู่รับสินค้าและค่าส่ง 40 บาท ผู้ซื้อแต่ละคนมีที่อยู่เริ่มต้น ตะกร้าจากแฟชั่นกับแกดเจ็ต สินค้าที่ชอบ และร้านที่ติดตามพร้อมใช้งาน

## สินค้าสำหรับทดสอบ

ใช้คำค้นชื่อไทย ชื่ออังกฤษ หรือ SKU ที่แสดงในหน้าผู้ขาย ราคาต่อไปนี้เป็นบาท ส่วนฐานข้อมูลเก็บเป็นจำนวนเต็มสตางค์

| SKU หลัก | สินค้า | ราคา | กรณีทดสอบ |
| --- | --- | ---: | --- |
| `UAT-83-1` | เสื้อเชิ้ตลายตารางน้ำเงินดำ | 790 | ไซซ์ M/L/XL ตะกร้าและหลายร้าน |
| `UAT-100-1` | หูฟัง Apple AirPods | 4,590 | ซื้อคู่แฟชั่น แยกจัดส่งตามร้าน |
| `UAT-43-1` | ชิงช้าตกแต่งบ้าน | 890 | ออเดอร์ส่งแล้ว 3 ชิ้น คืนบางส่วน |
| `UAT-1-1` | มาสคาร่า Essence Lash Princess | 290 | ออเดอร์ส่งแล้ว 2 ชิ้น สร้างรีวิวใหม่ |
| `UAT-105-1` | แบตเตอรี่สำรอง Apple MagSafe | 2,990 | สต็อก 2 ชิ้น ทดสอบเกินสต็อก |
| `UAT-107-1` | หูฟังไร้สาย Beats Flex | 1,990 | สต็อก 0 ชิ้น ต้องซื้อไม่ได้ |
| `UAT-85-1`, `UAT-51-1` | เสื้อเชิ้ตลายสก็อต, เครื่องปั่น | 690, 1,590 | DRAFT เห็นในผู้ขาย แต่ไม่ขายในหน้าร้าน |
| `UAT-99-1` | ลำโพง Amazon Echo Plus | 3,490 | ARCHIVED ไม่ขายในหน้าร้าน |

รายละเอียดทั้ง 20 รายการอยู่ใน [catalog manifest](../scripts/uat/catalog.json) หลัง seed ครั้งแรก `UAT-83-1` และ `UAT-100-1` มีคงเหลือ 38 จอง 1 และพร้อมขาย 37 ชิ้น `UAT-43-1` คงเหลือ 37 และ `UAT-1-1` คงเหลือ 38 ชิ้น สต็อกเหล่านี้เปลี่ยนตามการทดสอบ และการ seed ซ้ำรักษาค่านั้น

## ทดสอบคูปอง

| รหัส | เงื่อนไขเริ่มต้น |
| --- | --- |
| `UAT10` | แพลตฟอร์ม ลด 10% สูงสุด 200 บาท ยอดสินค้าอย่างน้อย 100 บาท |
| `UATFASHION100` | ร้านแฟชั่น ลด 100 บาท ยอดสินค้าในร้านอย่างน้อย 500 บาท |
| `UATSHIP` | แพลตฟอร์มส่งฟรี ยอดสินค้าอย่างน้อย 100 บาท |
| `UATEXPIRED` | คูปองหมดอายุ ต้องปฏิเสธ |
| `UATMIN` | ลด 100 บาท เมื่อยอดสินค้าอย่างน้อย 10,000 บาท |

คูปองปกติใช้ได้จนถึง 1 มกราคม 2035 จำกัดรวม 1,000 ครั้งและคนละ 20 ครั้ง ลองใช้คูปองร้านก่อนคูปองแพลตฟอร์ม แล้วตรวจ quote บน checkout หากไม่ได้ใช้ `dev:uat` ต้องเปิด `CHECKOUT_V2_SETTLEMENT_ENABLED=true` และสร้าง process API ใหม่เพื่อใช้ช่องคูปองที่แยกกัน

## ทดสอบสถานการณ์ออเดอร์

| เลขออเดอร์ | เจ้าของ | สถานะเริ่มต้น | ยอดบาท | ทดสอบต่อ |
| --- | --- | --- | ---: | --- |
| `UAT-PENDING-1001` | uat-buyer | PENDING_PAYMENT / PENDING | 5,460 | mock ชำระสำเร็จ ชำระล้มเหลว หรือยกเลิก |
| `UAT-PAID-1002` | uat-buyer | PAID / SUCCEEDED | 5,460 | ผู้ขายแพ็กและส่ง หรือ admin เตรียมยกเลิกก่อนส่ง |
| `UAT-SHIPPED-1003` | uat-buyer | SHIPPED / SUCCEEDED | 5,460 | ส่งถึงแยกร้าน ยอดผู้ขายรับรู้เมื่อทั้งออเดอร์ส่งถึง |
| `UAT-DELIVERED-1004` | uat-return | DELIVERED / SUCCEEDED | 3,330 | อนุมัติคืนบ้าน 1 จาก 3 ชิ้น และรีวิวมาสคาร่า |
| `UAT-FAILED-1005` | uat-buyer | CANCELED / FAILED | 830 | ตรวจประวัติชำระล้มเหลวและปล่อยสต็อกแล้ว |

ออเดอร์สำเร็จมี `PaymentEvent` ที่ระบุว่าเป็น fixture ออเดอร์แต่ละรายการมี snapshot ราคา ที่อยู่ `ShopOrder` และ snapshot การแบ่งรายได้ครบ สต็อกหักครั้งเดียวสำหรับ COMMITTED และออเดอร์รอจ่ายมี reservation ACTIVE ที่เชื่อม checkout กับ order ออเดอร์สำเร็จแยก shipment ตามร้าน

สถานะชำระสำเร็จและรูปหลักฐานใน fixture เป็นข้อมูลสมมติสำหรับ UAT ไม่ใช่หลักฐานการรับเงินจากธนาคารหรือผู้ให้บริการ ออเดอร์ PAID และ SHIPPED ไม่มีรายได้ผู้ขายที่ถอนได้ก่อนส่งถึง ออเดอร์ DELIVERED รับรู้รายได้บ้าน 2,443 บาท และความงาม 562 บาทแล้ว หลังหักค่าธรรมเนียม 10% เฉพาะสินค้า ไม่มี payout หรือ refund สำเร็จที่สร้างไว้ล่วงหน้า

ทดสอบการแยกร้านโดยเข้าบัญชี fashion แล้วดูและจัดการออเดอร์ของร้านตนเอง ลองเปิด ID ของร้าน gadget ผ่าน API ผู้ขาย ต้องได้รับการปฏิเสธ ผู้ซื้อและผู้ขายต้องเข้า API admin ไม่ได้

## จำลอง webhook ผ่านหน้าชำระเงิน

เข้าบัญชี `uat-buyer@example.test` แล้วเปิด [mock payment ของ UAT-PENDING-1001](http://localhost:3000/th/payment/mock/cdd85071-a2cb-52b9-95c1-fcd0ddbb1f2b) เลือกผลชำระที่ต้องการ ปุ่มเรียก `POST /api/payments/mock/:paymentId/events` พร้อม `{ "eventType": "payment.paid" }` หรือ `{ "eventType": "payment.failed" }` จาก session ของผู้ซื้อ เซิร์ฟเวอร์ตรวจเจ้าของและส่ง event เข้า payment settlement เดียวกับ webhook

หลังชำระสำเร็จ ให้เรียก event เดิมซ้ำในออเดอร์เดียวกัน ต้องไม่หักสต็อกหรือเพิ่มรายได้/เหรียญซ้ำ โดยรหัสตอบกลับอาจเป็น `WEBHOOK_ALREADY_PROCESSED` หรือสถานะที่ประมวลผลแล้ว กรณีสำเร็จกับล้มเหลวต้องใช้คนละออเดอร์ สำหรับการลองรอบใหม่ให้ checkout สินค้าใหม่

หากทดสอบ provider webhook โดยตรง ใช้ `POST /api/payment/webhook` หรือ `/api/payments/webhook` พร้อม `provider`, `providerRef`, `eventType`, `paymentId`, `orderId`, `amount` จำนวน `amount` เป็นตัวเลขจำนวนเต็มสตางค์ที่ตรงกับ payment `UAT-PENDING-1001` มี `amount=546000` และ `orderId=71e5e7f7-e069-5c62-8db7-66bb4eaad01f` เมื่อมี `PAYMENT_WEBHOOK_SECRET` ต้องใช้ helper `signPaymentWebhookBody` ใน [payment.webhook-signature.ts](../server/modules/payment/payment.webhook-signature.ts) พร้อม `x-payment-signature` และ `x-payment-timestamp` ภายในช่วง 5 นาที ใช้ `providerRef` เดิมทดสอบ duplicate และทดสอบ amount/signature ผิดเพื่อยืนยันว่าไม่มีการ settlement

Reservation ของออเดอร์รอจ่ายเริ่มต้นมีอายุ 24 ชั่วโมง worker สามารถปล่อยเมื่อหมดอายุ การ seed ซ้ำไม่ต่ออายุ ส่วนระยะเวลาคืนสินค้าใช้วันส่งถึงจริงใน fixture ซึ่งตั้งไว้ 1 ชั่วโมงก่อน seed ครั้งแรก ระบบปริยายรับคำขอใหม่ภายใน 7 วัน การ seed ซ้ำไม่เลื่อนวันส่งถึง

## คืนบางส่วนและรีวิว

1. เข้าบัญชี `uat-home@example.test` แล้วเปิดคำขอ REQUESTED ของ `UAT-DELIVERED-1004` จำนวน 1 ชิ้นจากชิงช้า 3 ชิ้น รูปหลักฐานอยู่ใน `/uat/reviews/review-home.webp`
2. อนุมัติคำขอ ระบบสร้าง PENDING refund สำหรับสินค้าจำนวน 1 ชิ้น ค่าส่งยังคงอยู่ตามเหตุเปลี่ยนใจ ยอดสินค้า 890 บาทมาจาก snapshot
3. เข้าบัญชี `uat-admin@example.test` ตรวจแผน แล้วเปลี่ยนเป็น PROCESSING
4. เข้าบัญชี `uat-finance@example.test` บันทึก completion reference สำหรับทดสอบ ผู้ดูแลคนเดิมต้องบันทึก SUCCESS ไม่ได้ ตรวจว่ารายได้ผู้ขายและเหรียญเปลี่ยนครั้งเดียว
5. ใช้ `uat-return@example.test` รีวิวมาสคาร่าจากรายการส่งถึง 2 ชิ้น ส่วนรายการบ้านมีรีวิว PUBLISHED พร้อมรูปแล้ว ใช้กรณีบ้านทดสอบแก้รีวิวหรือ moderation
6. หากทดสอบแนบรูปผ่าน API ใช้ completed REVIEW_IMAGE upload ของเจ้าของบัญชีนี้ `bfbed43d-6bda-5f6c-946e-12677e8b2992` สำหรับบ้าน หรือ `28f8330c-4940-55cf-977d-cc06043ce5ff` สำหรับมาสคาร่า ใน `uploadIds` การแนบรูปผ่านหน้าจอใช้ uploader ของระบบ

เส้นทาง refund ปัจจุบันบันทึกการคืนเงินด้วยมือและ reference ไม่เรียกผู้ให้บริการคืนเงิน ข้อมูล UAT ไม่ควรใช้เป็นหลักฐานการโอนเงินจริง การคืนแบบเปลี่ยนใจไม่เพิ่มสต็อกกายภาพอัตโนมัติ

หลังแต่ละช่วงทดสอบ รัน `bun run db:verify:uat` ตัวตรวจสอบรายงาน `testerActivity` เมื่อราคา สต็อก รายการสินค้า หรือ workflow เปลี่ยน แต่ยังตรวจสมการยอด snapshot การแยกร้าน ความสัมพันธ์ reservation และยอดจองรวม ข้อมูลทดลองใหม่จึงไม่ถูกบังคับให้กลับเป็นค่าเริ่มต้น หากรายงาน integrity failure ให้แก้ข้อมูลหรือพฤติกรรมที่ทำให้ความสัมพันธ์ผิดก่อนทดสอบต่อ

## ที่มาของรูป

ภาพสินค้ามาจากชุดตัวอย่าง [DummyJSON products](https://dummyjson.com/docs/products) และเก็บ URL ต้นทางไว้ใน catalog manifest รูปรีวิวเป็นสำเนารูปสินค้าเพื่อใช้เป็นหลักฐานสมมติ โลโก้ร้าน ภาพ cover และโลโก้แบรนด์ UAT เป็น SVG ที่สร้างสำหรับชุดทดสอบ ดู [LICENSE-DummyJSON.txt](../public/uat/LICENSE-DummyJSON.txt) และ [asset checksums](../public/uat/assets.json) สำหรับไฟล์ที่จัดเตรียม
