#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
revision=${GITHUB_SHA:-$(git rev-parse HEAD)}
[[ $revision =~ ^[a-f0-9]{40}$ ]] || exit 1
[[ $(uname -sm) == 'Linux x86_64' ]] || { echo 'Build on Ubuntu 24.04 x86_64' >&2; exit 1; }
source /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || exit 1
[[ $(bun --version) == 1.3.14 ]] || exit 1
test -s .next/BUILD_ID
GITHUB_SHA="$revision" bun -e '
const env = JSON.parse(process.env.PUBLIC_BUILD_ENV_JSON || "{}");
for (const [key,value] of Object.entries(env)) {
  if (!/^(NEXT_PUBLIC_[A-Z0-9_]+|API_BASE_URL|ALLOW_INSECURE_HTTP|S3_PUBLIC_BASE_URL)$/.test(key) || typeof value !== "string" || /[\r\n]/.test(value)) throw Error("Invalid public build environment");
}
await Bun.write("release-manifest.json", JSON.stringify({revision:process.env.GITHUB_SHA, platform:"ubuntu-24.04-x86_64",bun:Bun.version,publicBuildEnv:env},null,2));
'
mkdir -p release-artifact
paths=(release-manifest.json package.json bun.lock node_modules .next app server scripts generated prisma prisma.config.ts next.config.mjs tsconfig.json messages public deploy)
for optional in next-env.d.ts postcss.config.mjs proxy.ts; do
  [[ ! -e $optional ]] || paths+=("$optional")
done
tar --hard-dereference --exclude='.next/cache' --exclude='public/uploads' --exclude='*.tsbuildinfo' --exclude='.env' --exclude='.env.*' --exclude='*/.env' --exclude='*/.env.*' -czf release-artifact/release.tar.gz "${paths[@]}"
(cd release-artifact && sha256sum release.tar.gz > release.tar.gz.sha256)
