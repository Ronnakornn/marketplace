#!/usr/bin/env bash
set -euo pipefail
umask 077
export PATH="/root/.bun/bin:/usr/local/bin:/usr/bin:/bin"
[[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([a-f0-9]{40})\ ([a-f0-9]{64})$ ]] || { echo 'Invalid deployment command' >&2; exit 1; }
revision=${BASH_REMATCH[1]}
digest=${BASH_REMATCH[2]}
base=/var/www/marketplace-releases
shared=/var/www/marketplace
current=/var/www/marketplace-current
mkdir -p "$base/.incoming" "$base/backups"
exec 9>"$base/.deploy.lock"
flock -w 900 9
incoming=$(mktemp "$base/.incoming/release.XXXXXX")
stage=$(mktemp -d "$base/.incoming/stage.XXXXXX")
activated=false
previous=$shared
[[ ! -L $current ]] || previous=$(readlink -f "$current")
rollback_config="$stage/previous.config.cjs"
cleanup() {
  code=$?
  trap - EXIT
  if [[ $code != 0 && $activated == true ]]; then
    echo 'Activation failed; restoring previous application processes. Database migrations are retained.' >&2
    ln -sfn "$previous" "$current.rollback"
    mv -Tf "$current.rollback" "$current"
    pm2 delete marketplace-web marketplace-api >/dev/null 2>&1 || true
    pm2 start "$rollback_config" --update-env || echo 'PM2 rollback failed; operator intervention required' >&2
    pm2 save || true
  fi
  rm -f "$incoming"
  rm -rf "$stage"
  exit "$code"
}
trap cleanup EXIT
cat > "$incoming"
printf '%s  %s\n' "$digest" "$incoming" | sha256sum --check --status
python3 - "$incoming" "$stage" <<'PY'
import pathlib, posixpath, sys, tarfile
allowed = {'release-manifest.json','package.json','bun.lock','node_modules','.next','app','server','scripts','generated','prisma','prisma.config.ts','next.config.mjs','tsconfig.json','messages','public','deploy','next-env.d.ts','postcss.config.mjs','proxy.ts'}
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    for member in archive.getmembers():
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] not in allowed:
            raise SystemExit('Invalid archive path')
        if any(p == '.env' or p.startswith('.env.') for p in path.parts) or path.parts[:2] in [('public','uploads'),('.next','cache')]:
            raise SystemExit('Archive includes persistent or secret content')
        if member.isdev() or member.isfifo() or member.islnk():
            raise SystemExit('Unsupported archive entry')
        if member.issym():
            target = posixpath.normpath(posixpath.join(str(path.parent), member.linkname))
            if member.linkname.startswith('/') or target == '..' or target.startswith('../'):
                raise SystemExit('Unsafe archive symlink')
    archive.extractall(sys.argv[2], filter='data')
PY
cd "$stage"
for required in .next/BUILD_ID node_modules/.bin/prisma node_modules/.bin/next generated/client/client.ts server/index.ts scripts/db-backup.ts deploy/ecosystem.release.config.cjs prisma/schema.prisma; do
  test -s "$required" || { echo "Incomplete artifact: $required" >&2; exit 1; }
done
[[ $(bun --version) == 1.3.14 && $(uname -sm) == 'Linux x86_64' ]] || exit 1
source /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || exit 1
REVISION="$revision" SHARED="$shared" bun -e '
const fs=require("node:fs"); const dotenv=require("dotenv");
const manifest=JSON.parse(fs.readFileSync("release-manifest.json","utf8"));
if(manifest.revision!==process.env.REVISION || manifest.platform!=="ubuntu-24.04-x86_64" || manifest.bun!==Bun.version) throw Error("Artifact runtime mismatch");
const env={};
for(const name of [".env.local",".env"]) { const file=`${process.env.SHARED}/${name}`; if(fs.existsSync(file)) for(const [key,value] of Object.entries(dotenv.parse(fs.readFileSync(file)))) if(!(key in env)) env[key]=value; }
const build=manifest.publicBuildEnv;
if(!build || !build.NEXT_PUBLIC_APP_URL || !build.API_BASE_URL) throw Error("Missing public build environment");
const keys=new Set([...Object.keys(build),...Object.keys(env).filter(k=>k.startsWith("NEXT_PUBLIC_") || ["API_BASE_URL","ALLOW_INSECURE_HTTP","S3_PUBLIC_BASE_URL"].includes(k))]);
for(const key of keys) if(!/^(NEXT_PUBLIC_[A-Z0-9_]+|API_BASE_URL|ALLOW_INSECURE_HTTP|S3_PUBLIC_BASE_URL)$/.test(key) || (build[key]??"")!==(env[key]??"")) throw Error(`Public build environment mismatch: ${key}`);
'
pm2 jlist | ROLLBACK_CONFIG="$rollback_config" bun -e '
const rows=JSON.parse(await Bun.stdin.text());
const apps=["marketplace-web","marketplace-api"].map(name=>{
const row=rows.find(p=>p.name===name); if(!row || row.pm2_env.status!=="online") throw Error(`Missing online process ${name}`);
const e=row.pm2_env; return {name,cwd:e.pm_cwd,script:e.pm_exec_path,args:e.args,interpreter:e.exec_interpreter,exec_mode:"fork",instances:1,env:e.env,autorestart:true,kill_timeout:60000};
});
await Bun.write(process.env.ROLLBACK_CONFIG,"module.exports="+JSON.stringify({apps}));
'
mkdir -p "$shared/public/uploads" "$shared/.data/uploads"
ln -s "$shared/.env" .env
[[ ! -f "$shared/.env.local" ]] || ln -s "$shared/.env.local" .env.local
ln -s "$shared/public/uploads" public/uploads
ln -s "$shared/.data" .data
destination="$base/$revision"
if [[ -e $destination ]]; then
  [[ -d $destination && ! -L $destination && $(cat "$destination/.release-sha256") == "$digest" ]] || { echo 'Existing release checksum differs' >&2; exit 1; }
fi
backup="$base/backups/$revision-$(date -u +%Y%m%dT%H%M%SZ).dump"
bun run scripts/db-backup.ts "$backup"
bun run db:migrate:deploy
if [[ ! -e $destination ]]; then
  printf '%s\n' "$digest" > .release-sha256
  mv "$stage" "$destination"
  stage=$(mktemp -d "$base/.incoming/rollback.XXXXXX")
  cp "$destination/previous.config.cjs" "$stage/previous.config.cjs"
  rollback_config="$stage/previous.config.cjs"
  rm "$destination/previous.config.cjs"
fi
ln -sfn "$destination" "$current.next"
mv -Tf "$current.next" "$current"
activated=true
pm2 delete marketplace-web marketplace-api
MARKETPLACE_RELEASE_DIR="$destination" pm2 start "$destination/deploy/ecosystem.release.config.cjs" --update-env
ready=false
for attempt in $(seq 1 45); do
  if curl --silent --fail --max-time 5 http://127.0.0.1:3000/api/health/ready > "$stage/ready.json" &&
     bun -e 'const r=await Bun.file(process.argv[1]).json(); if(r.status!=="ok" || !r.services || Object.values(r.services).some(v=>v!=="ok" && v?.status!=="ok")) process.exit(1)' "$stage/ready.json" &&
     curl --silent --fail --max-time 10 http://127.0.0.1:3000/th > /dev/null; then
    ready=true
    break
  fi
  sleep 2
done
[[ $ready == true ]] || { echo 'Release readiness failed' >&2; exit 1; }
pm2 jlist | RELEASE_DIR="$destination" bun -e '
const rows=JSON.parse(await Bun.stdin.text());
for(const name of ["marketplace-web","marketplace-api"]) if(!rows.some(p=>p.name===name && p.pm2_env.status==="online" && p.pm2_env.pm_cwd===process.env.RELEASE_DIR)) throw Error("PM2 release mismatch");
'
pm2 save
echo "Deployed $revision"
