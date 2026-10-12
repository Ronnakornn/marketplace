import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

type Asset = {
  url: string;
  sha256: string;
  width: number;
  height: number;
  sourceUrl?: string;
};

export async function prepareUatAssets(root = process.cwd(), checkOnly = false) {
  const manifest: Asset[] = JSON.parse(await readFile(resolve(root, "public/uat/assets.json"), "utf8"));
  for (const asset of manifest) {
    if (!/^\/uat\/(products|reviews|shops|brands)\/[a-z0-9-]+\.(webp|svg)$/.test(asset.url)) {
      throw new Error(`Invalid UAT asset path ${asset.url}`);
    }
    const target = resolve(root, `public${asset.url}`);
    const exists = await access(target).then(() => true, () => false);
    let bytes: Buffer;
    if (exists) {
      bytes = await readFile(target);
    } else {
      if (checkOnly || !asset.sourceUrl) throw new Error(`Missing UAT asset ${asset.url}`);
      const source = new URL(asset.sourceUrl);
      if (source.protocol !== "https:" || source.hostname !== "cdn.dummyjson.com" || !source.pathname.startsWith("/product-images/")) {
        throw new Error(`Invalid UAT image source for ${asset.url}`);
      }
      const response = await fetch(source, { signal: AbortSignal.timeout(30_000), redirect: "error" });
      if (!response.ok) throw new Error(`Cannot download ${asset.url}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
      throw new Error(`UAT asset content changed: ${asset.url}`);
    }
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== asset.width || metadata.height !== asset.height) {
      throw new Error(`UAT asset dimensions changed: ${asset.url}`);
    }
    if (!exists) {
      await mkdir(dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.tmp`;
      await writeFile(temporary, bytes);
      await rename(temporary, target);
    }
  }
  return manifest.length;
}

if (import.meta.main) {
  prepareUatAssets(process.cwd(), process.argv.includes("--check"))
    .then((count) => process.stdout.write(`Validated ${count} local UAT images.\n`))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
