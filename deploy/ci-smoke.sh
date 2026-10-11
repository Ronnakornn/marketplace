#!/usr/bin/env bash
set -euo pipefail
umask 077

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
evidence_dir="$root_dir/artifacts/container"
mkdir -p "$evidence_dir/tls"
runtime_env="$evidence_dir/runtime.env"
project="marketplace-ci-${GITHUB_RUN_ID:-local}-${RANDOM}"
host=ci.marketplace.test
metrics_token=ci_metrics_token_at_least_32_characters

cat > "$runtime_env" <<EOF
APP_HOST=$host
APP_ENV_FILE=$runtime_env
TLS_CERT_DIR=$evidence_dir/tls
HTTP_PORT=8080
HTTPS_PORT=8443
MARKETPLACE_IMAGE=marketplace:ci
MIGRATION_IMAGE=marketplace-migration:ci
POSTGRES_DB=marketplace_ci
POSTGRES_PASSWORD=ci_postgres_password_at_least_32_characters
REDIS_PASSWORD=ci_redis_password_at_least_32_characters
BETTER_AUTH_SECRET=ci_auth_secret_at_least_32_characters
PAYMENT_WEBHOOK_SECRET=ci_payment_secret_at_least_32_characters
OTP_HASH_SECRET=ci_otp_secret_at_least_32_characters
KYC_ENCRYPTION_KEY=ci_kyc_secret_at_least_32_characters
LOCAL_UPLOAD_SECRET=ci_upload_secret_at_least_32_characters
METRICS_AUTH_TOKEN=$metrics_token
MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED=true
EMAIL_PROVIDER=disabled
CHECKOUT_V2_SETTLEMENT_ENABLED=true
CACHE_ENABLED=true
SUCCESSFUL_REQUEST_LOG_SAMPLE_RATE=0
EOF

openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$evidence_dir/tls/privkey.pem" \
  -out "$evidence_dir/tls/fullchain.pem" \
  -subj "/CN=$host" -addext "subjectAltName=DNS:$host" 2> "$evidence_dir/tls-generation.log"

compose() {
  docker compose --project-name "$project" --env-file "$runtime_env" -f "$root_dir/deploy/compose.yml" "$@"
}

cleanup() {
  compose logs --no-color > "$evidence_dir/compose.log" 2>&1 || true
  compose stop --timeout 60 > "$evidence_dir/cleanup.log" 2>&1 || true
  compose down --volumes --remove-orphans >> "$evidence_dir/cleanup.log" 2>&1 || true
}
trap cleanup EXIT

request() {
  curl --silent --show-error --connect-timeout 5 --max-time 10 \
    --cacert "$evidence_dir/tls/fullchain.pem" \
    --noproxy "$host" --resolve "$host:8443:127.0.0.1" "https://$host:8443$1" "${@:2}"
}

compose config --quiet
compose up --no-build --detach --wait --wait-timeout 180
compose exec -T nginx nginx -t
test "$(curl --silent --show-error --connect-timeout 5 --max-time 10 --noproxy "$host" \
  --resolve "$host:8080:127.0.0.1" "http://$host:8080/api/health/ready" -o /dev/null -w '%{http_code}')" = 308
request /api/health/ready > "$evidence_dir/readiness.json"
python3 - "$evidence_dir/readiness.json" <<'PY'
import json, sys
health = json.load(open(sys.argv[1]))
assert health['status'] == 'ok', health
assert all(health['services'][name] == 'ok' for name in ('api', 'database', 'databaseSchema', 'redis', 'queue')), health
PY

test "$(request /api/admin/dashboard -o /dev/null -w '%{http_code}')" = 401
test "$(request /api/metrics/worker -o /dev/null -w '%{http_code}')" = 401
test "$(request /api/realtime --http1.1 -o /dev/null -w '%{http_code}' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==')" = 401

compose exec -T app bun -e '
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { prisma } from "./server/lib/prisma.ts";
import { createLogger } from "./server/infrastructure/logging/index.ts";
import { PrismaUploadRepository } from "./server/modules/upload/upload.repository.ts";
import { UploadService } from "./server/modules/upload/upload.service.ts";
import { createUploadStorageFromEnv } from "./server/modules/upload/upload.storage.ts";
if (new URL(process.env.DATABASE_URL).pathname !== "/marketplace_ci") throw new Error("Smoke upload requires disposable CI database");
const context = { logger: createLogger({ environment: "production" }), config: { environment: "production" } };
const uploads = new UploadService(context, new PrismaUploadRepository(context, prisma), createUploadStorageFromEnv());
try {
  const user = await prisma.user.create({ data: { name: "Container upload fixture", email: "container-upload@example.invalid" } });
  const image = await sharp(randomBytes(900 * 900 * 3), { raw: { width: 900, height: 900, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  if (image.length <= 1024 * 1024) throw new Error("Upload fixture did not exceed normal request limit");
  const signed = await uploads.createPresignedUrl(user, { usage: "review_image", contentType: "image/png", fileSize: image.length, fileName: "container-smoke.png" });
  await Bun.write("/tmp/ci-upload.png", image);
  await Bun.write("/tmp/ci-upload.fixture", JSON.stringify({ ...signed, userId: user.id, bytes: image.length }));
} finally {
  await prisma.$disconnect();
}'
app_id="$(compose ps --quiet app)"
docker cp "$app_id:/tmp/ci-upload.png" "$evidence_dir/ci-upload.png"
docker cp "$app_id:/tmp/ci-upload.fixture" "$evidence_dir/ci-upload.fixture"
upload_url="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["uploadUrl"])' "$evidence_dir/ci-upload.fixture")"
public_url="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["publicUrl"])' "$evidence_dir/ci-upload.fixture")"
upload_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["fileId"])' "$evidence_dir/ci-upload.fixture")"
upload_bytes="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["bytes"])' "$evidence_dir/ci-upload.fixture")"
test "$(request "$upload_url" -X PUT --data-binary "@$evidence_dir/ci-upload.png" \
  -H 'Content-Type: image/png' -o "$evidence_dir/upload-response.json" -w '%{http_code}')" = 200
request "$public_url" --fail -o "$evidence_dir/upload-before-replacement.png"
cmp "$evidence_dir/ci-upload.png" "$evidence_dir/upload-before-replacement.png"
compose exec -T app bun -e '
import { prisma } from "./server/lib/prisma.ts";
import { createLogger } from "./server/infrastructure/logging/index.ts";
import { PrismaUploadRepository } from "./server/modules/upload/upload.repository.ts";
import { UploadService } from "./server/modules/upload/upload.service.ts";
import { createUploadStorageFromEnv } from "./server/modules/upload/upload.storage.ts";
const context = { logger: createLogger({ environment: "production" }), config: { environment: "production" } };
const uploads = new UploadService(context, new PrismaUploadRepository(context, prisma), createUploadStorageFromEnv());
try {
  const fixture = JSON.parse(await Bun.file("/tmp/ci-upload.fixture").text());
  const completed = await uploads.completeUpload({ id: fixture.userId, role: "USER" }, fixture.fileId);
  if (completed.status !== "COMPLETED") throw new Error("Large upload did not complete");
} finally {
  await prisma.$disconnect();
}'

compose exec -T app bun -e '
import { Queue } from "bullmq";
import { getQueueConfigFromEnv } from "./server/modules/queue/queue.config.ts";
import { createRedisConnection } from "./server/modules/queue/queue.connection.ts";
const connection = createRedisConnection(getQueueConfigFromEnv());
const queue = new Queue("marketplace-jobs", { connection });
try {
  const job = await queue.add("reconcile_seller_earnings", { limit: 10 }, { jobId: "ci-container-smoke" });
  const deadline = Date.now() + 60000;
  let state = await job.getState();
  while (state !== "completed" && state !== "failed" && Date.now() < deadline) {
    await Bun.sleep(500);
    state = await job.getState();
  }
  if (state !== "completed") throw new Error("Smoke job did not complete");
} finally {
  await queue.close();
  await connection.quit();
}'

completed=false
for attempt in $(seq 1 30); do
  request /api/metrics/worker -H "Authorization: Bearer $metrics_token" > "$evidence_dir/worker-metrics.json"
  if python3 - "$evidence_dir/worker-metrics.json" <<'PY'
import json, sys
metrics = json.load(open(sys.argv[1]))
sys.exit(0 if metrics['queueJobs']['success'] > 0 else 1)
PY
  then
    completed=true
    break
  fi
  sleep 2
done
test "$completed" = true
compose logs --no-color app > "$evidence_dir/app-running.log"
grep -q 'Job worker running' "$evidence_dir/app-running.log"

compose exec -T app bun -e '
await Bun.write("/app/public/uploads/ci-persistence.txt", "public-upload-survived");
await Bun.write("/app/.data/uploads/ci-persistence.txt", "private-upload-survived");'
test "$(request /uploads/ci-persistence.txt)" = public-upload-survived
compose exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli SET ci:persistence retained' > /dev/null
sleep 2

app_id="$(compose ps --quiet app)"
compose stop --timeout 60 app nginx
docker inspect --format '{{json .State}}' "$app_id" > "$evidence_dir/shutdown.json"
python3 - "$evidence_dir/shutdown.json" <<'PY'
import json, sys
state = json.load(open(sys.argv[1]))
assert not state['Running'] and state['ExitCode'] == 0 and not state['OOMKilled'], state
PY
compose logs --no-color > "$evidence_dir/before-replacement.log"
grep -q 'Job worker shutting down' "$evidence_dir/before-replacement.log"

compose up --no-build --detach --force-recreate --wait --wait-timeout 180 postgres redis app nginx
compose exec -T app bun -e '
if (await Bun.file("/app/public/uploads/ci-persistence.txt").text() !== "public-upload-survived") throw new Error("Public upload volume lost");
if (await Bun.file("/app/.data/uploads/ci-persistence.txt").text() !== "private-upload-survived") throw new Error("Private upload volume lost");'
test "$(compose exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli GET ci:persistence')" = retained
test "$(request /uploads/ci-persistence.txt)" = public-upload-survived
request "$public_url" --fail -o "$evidence_dir/upload-after-replacement.png"
cmp "$evidence_dir/ci-upload.png" "$evidence_dir/upload-after-replacement.png"
compose exec -T -e CI_UPLOAD_ID="$upload_id" -e CI_UPLOAD_BYTES="$upload_bytes" app bun -e '
import { prisma } from "./server/lib/prisma.ts";
try {
  const record = await prisma.upload.findUnique({ where: { id: process.env.CI_UPLOAD_ID } });
  if (!record || record.status !== "COMPLETED" || record.fileSize !== Number(process.env.CI_UPLOAD_BYTES)) throw new Error("Completed upload database record lost across replacement");
  process.stdout.write(JSON.stringify({ uploadPersisted: true, status: record.status, bytes: record.fileSize }));
} finally {
  await prisma.$disconnect();
}' > "$evidence_dir/upload-persistence.json"
request /api/health/ready > "$evidence_dir/readiness-after-replacement.json"
python3 - "$evidence_dir/readiness-after-replacement.json" <<'PY'
import json, sys
health = json.load(open(sys.argv[1]))
assert health['status'] == 'ok' and health['services']['databaseSchema'] == 'ok', health
PY
test "$(request /.data/uploads/ci-persistence.txt -o /dev/null -w '%{http_code}')" = 404
printf '%s\n' 'Container smoke passed. TLS proxy, readiness, authorization, upload routing, worker completion, shutdown, and persistence verified.'
