import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type Finding = {
  type: "thai-readability" | "hardcoded-english";
  file: string;
  line: number;
  value: string;
  detail: string;
};

type Baseline = {
  version: 1;
  updatedAt: string;
  exceptions: string[];
  findings: string[];
};

const rootDir = process.cwd();
const baselinePath = path.join(rootDir, "scripts", "i18n-audit-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");
const verbose = process.argv.includes("--verbose");

const scopedMessageNamespaces = new Set([
  "common",
  "nav",
  "home",
  "product",
  "cart",
  "checkout",
  "order",
  "chat",
  "buyer",
  "notification",
  "affiliate",
  "state",
  "ui",
]);

const scopedMessagePrefixes = [
  "seller.onboarding.",
  "seller.kyc.",
];

const scopedProductionRoots = [
  "app/[locale]/(buyer)",
  "app/[locale]/(public)",
  "app/[locale]/admin",
  "app/[locale]/seller",
  "app/features/admin",
  "app/features/auth",
  "app/features/buyer",
  "app/features/cart",
  "app/features/checkout",
  "app/features/order",
  "app/features/payment",
  "app/features/seller",
  "app/features/chat",
  "app/features/affiliate",
  "app/features/home",
  "app/features/marketplace",
  "app/features/product",
];

const additionalScopedFiles = [
  "app/components/BuyerShell.tsx",
  "app/components/BuyerState.tsx",
  "app/components/LanguageSwitcher.tsx",
  "app/features/product/cart-handoff.ts",
  "app/i18n/client.tsx",
  "app/i18n/config.ts",
  "app/i18n/navigation.ts",
  "app/i18n/server.ts",
  "app/features/seller/components/SellerOnboardingPages.tsx",
];

const documentedExceptions = [
  "test files and fixtures are excluded by filename",
  "import paths, dynamic imports, and module specifiers are excluded",
  "CSS class names and style-only attributes are excluded",
  "URLs, route templates, and query keys are excluded",
  "analytics event names and machine identifiers are excluded",
  "provider brand names such as Google and Facebook are excluded",
  "enum/status raw values and API normalizer fallback data are excluded when they are not JSX-visible literals",
  "product, shop, order, address, notification, chat, review, and other user/API-provided data is not translated by this audit",
];

const textBearingAttributes = new Set([
  "aria-label",
  "alt",
  "label",
  "placeholder",
  "title",
  "description",
]);

const nonUiStringKeys = new Set([
  "className",
  "href",
  "src",
  "to",
  "type",
  "variant",
  "size",
  "id",
  "key",
  "role",
  "method",
  "target",
  "rel",
  "name",
  "value",
  "event",
  "eventName",
  "queryKey",
  "mutationKey",
  "status",
  "paymentStatus",
  "fulfillmentStatus",
  "trackingNumber",
  "orderNumber",
  "productTitle",
  "shopName",
  "couponCode",
]);

const englishWordPattern = /\b(?:[A-Z][a-z]{2,}|[a-z]{3,})(?:\s+(?:[A-Z][a-z]{2,}|[a-z]{2,})){0,8}\b/;
const thaiPattern = /[\u0E00-\u0E7F]/;
const mojibakePattern = /(?:เธ[\u0080-\u00BF]|เน€|เน|โ|[\u0080-\u009F\u00A0-\u00BF€])/;
const placeholderPattern = /\{[A-Za-z0-9_]+\}/g;

function readJson(filePath: string): JsonValue {
  return JSON.parse(readFileSync(filePath, "utf8")) as JsonValue;
}

function flattenMessages(value: JsonValue, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof value === "string") {
    result.set(prefix, value);
    return result;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    for (const [childKey, childValue] of flattenMessages(child, childPrefix)) {
      result.set(childKey, childValue);
    }
  }
  return result;
}

function placeholders(value: string): string[] {
  return [...new Set(value.match(placeholderPattern) ?? [])].sort();
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function scopedProductionFiles(): string[] {
  const files = new Set<string>();
  for (const root of scopedProductionRoots) {
    for (const file of listFiles(path.join(rootDir, root))) {
      files.add(path.relative(rootDir, file).replaceAll("\\", "/"));
    }
  }
  for (const file of additionalScopedFiles) {
    if (existsSync(path.join(rootDir, file)) && !/\.test\.(ts|tsx)$/.test(file)) {
      files.add(file);
    }
  }
  return [...files].sort();
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function unquote(raw: string): string {
  try {
    return JSON.parse(raw.replace(/^'/, '"').replace(/'$/, '"')) as string;
  } catch {
    return raw.slice(1, -1);
  }
}

function isProbablyUiString(source: string, matchIndex: number, raw: string, value: string): boolean {
  const before = source.slice(Math.max(0, matchIndex - 90), matchIndex);
  const after = source.slice(matchIndex + raw.length, matchIndex + raw.length + 30);
  const trimmedBefore = before.trimEnd();
  const keyMatch = trimmedBefore.match(/([A-Za-z0-9_$-]+)\s*[:=]\s*$/);
  const key = keyMatch?.[1];
  if (trimmedBefore.endsWith("new Error(")) return false;

  const literalText = value.replace(/\$\{[^}]+\}/g, "");
  if (!englishWordPattern.test(literalText)) return false;
  if (value.length > 140) return false;
  if (/^(undefined|null|true|false)$/i.test(value)) return false;
  if (/^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*\.?$/.test(value) && value.includes(".")) return false;
  if (/^[a-z][a-z0-9_-]*$/.test(value)) return false;
  if (/^[A-Z0-9_./:-]+$/.test(value)) return false;
  if (/^(GET|POST|PUT|PATCH|DELETE|ACTIVE|INACTIVE|PENDING|PAID|FAILED|THB|USD)$/i.test(value)) return false;
  if (/^(#[0-9A-Fa-f]{3,8}|[a-z]+-[a-z0-9- ]+)$/.test(value)) return false;
  if (/^(?:blur|scale|translate|rotate)\([^)]*\)$/.test(value)) return false;
  if (/^\d+-digit$/.test(value)) return false;
  if (/^(?:Google|Facebook)$/.test(value)) return false;
  if (value.includes("${") && !/\s/.test(value)) return false;
  if (/^[a-z]+\/[a-z0-9.+-]*$/i.test(value)) return false;
  if (literalText.startsWith("/") && !/\s/.test(literalText)) return false;
  if (/^(https?:|#\/|\/api\/|\/[A-Za-z0-9_/[?=&:${}().-]+$)/.test(value)) return false;
  if (/\$\{[^}]*className[^}]*\}/.test(value)) return false;
  if (/\b(?:size|rounded|flex|items|justify|border|bg|text|fill|grid|gap|px|py|mt|mb|mx|my)-/.test(value)) return false;
  if (/(?:^|\s)(?:import|from|export)\s*$/.test(before)) return false;
  if (/\b(?:t|common|home|product|cart|checkout|order|buyer|notification|affiliate|state|ui)\s*\(\s*$/.test(before)) return false;
  if (/(?:===|!==)\s*$/.test(before)) return false;
  if (key && nonUiStringKeys.has(key)) return false;
  if (key && /(?:Id|Url|Key)$/.test(key)) return false;
  if (/className\s*=\s*$/.test(before)) return false;

  if (key && textBearingAttributes.has(key)) return true;
  if (/[<>]\s*$/.test(before) || /^\s*[<})\]]/.test(after)) return true;
  if (/\btoast\.(success|error|message|info|warning)\s*\(\s*$/.test(before)) return true;
  if (/\bnew\s+Error\s*\(\s*$/.test(before)) return false;
  if (/=\s*$/.test(before) && !key) return false;

  return Boolean(key && /(?:title|label|description|message|empty|error|aria|placeholder|text|button|cta)/i.test(key));
}

function hardcodedEnglishFindings(): Finding[] {
  const findings: Finding[] = [];
  for (const file of scopedProductionFiles()) {
    const absolute = path.join(rootDir, file);
    const source = readFileSync(absolute, "utf8");
    const stringPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
    for (const match of source.matchAll(stringPattern)) {
      const raw = match[0];
      const value = match[1] === "`" ? match[2] : unquote(raw);
      if (!isProbablyUiString(source, match.index ?? 0, raw, value)) continue;
      findings.push({
        type: "hardcoded-english",
        file,
        line: lineNumber(source, match.index ?? 0),
        value,
        detail: "Move visible buyer-facing English text to a translation key or document a narrower exception.",
      });
    }
  }
  return findings;
}

function thaiReadabilityFindings(thMessages: Map<string, string>): Finding[] {
  const findings: Finding[] = [];
  for (const [key, value] of thMessages) {
    const namespace = key.split(".")[0];
    const isScoped = scopedMessageNamespaces.has(namespace)
      || scopedMessagePrefixes.some((prefix) => key.startsWith(prefix));
    if (!isScoped) continue;
    if (!value.trim()) continue;
    const hasThai = thaiPattern.test(value);
    const hasMojibake = mojibakePattern.test(value);
    if (hasThai && !hasMojibake) continue;
    findings.push({
      type: "thai-readability",
      file: "messages/th.json",
      line: 0,
      value: key,
      detail: hasMojibake
        ? "Thai message appears to contain mojibake."
        : "Thai scoped message does not contain Thai characters.",
    });
  }
  return findings;
}

function parityErrors(enMessages: Map<string, string>, thMessages: Map<string, string>): string[] {
  const errors: string[] = [];
  for (const key of enMessages.keys()) {
    if (!thMessages.has(key)) errors.push(`messages/th.json missing key: ${key}`);
  }
  for (const key of thMessages.keys()) {
    if (!enMessages.has(key)) errors.push(`messages/en.json missing key: ${key}`);
  }
  for (const [key, enValue] of enMessages) {
    const thValue = thMessages.get(key);
    if (thValue === undefined) continue;
    const enPlaceholders = placeholders(enValue).join(", ");
    const thPlaceholders = placeholders(thValue).join(", ");
    if (enPlaceholders !== thPlaceholders) {
      errors.push(`placeholder mismatch at ${key}: en=[${enPlaceholders}] th=[${thPlaceholders}]`);
    }
  }
  return errors;
}

function fingerprint(finding: Finding): string {
  return [finding.type, finding.file, finding.line, finding.value].join("|");
}

function loadBaseline(): Baseline {
  if (!existsSync(baselinePath)) {
    return { version: 1, updatedAt: "", exceptions: documentedExceptions, findings: [] };
  }
  return JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;
}

function printFinding(finding: Finding): void {
  const location = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
  console.error(`- ${finding.type} ${location} "${finding.value}"`);
  console.error(`  ${finding.detail}`);
}

const enMessages = flattenMessages(readJson(path.join(rootDir, "messages", "en.json")));
const thMessages = flattenMessages(readJson(path.join(rootDir, "messages", "th.json")));
const parity = parityErrors(enMessages, thMessages);
const findings = [...thaiReadabilityFindings(thMessages), ...hardcodedEnglishFindings()];
const findingFingerprints = findings.map(fingerprint).sort();

if (updateBaseline) {
  const baseline: Baseline = {
    version: 1,
    updatedAt: new Date().toISOString(),
    exceptions: documentedExceptions,
    findings: findingFingerprints,
  };
  mkdirSync(path.dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Updated ${path.relative(rootDir, baselinePath)} with ${baseline.findings.length} scoped findings.`);
  process.exit(0);
}

const baseline = loadBaseline();
const baselineSet = new Set(baseline.findings);
const currentSet = new Set(findingFingerprints);
const newFindings = findings.filter((finding) => !baselineSet.has(fingerprint(finding)));
const staleFindings = baseline.findings.filter((item) => !currentSet.has(item));

if (parity.length > 0 || newFindings.length > 0) {
  console.error("i18n audit failed.");
  if (parity.length > 0) {
    console.error("\nKey or placeholder parity errors:");
    for (const error of parity) console.error(`- ${error}`);
  }
  if (newFindings.length > 0) {
    console.error("\nNew unbaselined scoped i18n findings:");
    const counts = new Map<string, number>();
    for (const finding of newFindings) counts.set(finding.file, (counts.get(finding.file) ?? 0) + 1);
    console.error(`By file: ${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([file, count]) => `${file} (${count})`).join(", ")}`);
    for (const finding of newFindings.slice(0, 200)) printFinding(finding);
    if (newFindings.length > 200) console.error(`- ...and ${newFindings.length - 200} more`);
  }
  process.exit(1);
}

console.log("i18n audit passed.");
console.log(`Key parity: ${enMessages.size} en keys, ${thMessages.size} th keys.`);
console.log(`Placeholder parity: ok.`);
console.log(`Scoped Thai/hardcoded findings covered by baseline: ${findings.length}.`);
if (verbose && findings.length > 0) {
  for (const finding of findings) printFinding(finding);
}
if (staleFindings.length > 0) {
  console.log(`Baseline can be reduced by ${staleFindings.length} stale finding(s). Run bun run audit:i18n -- --update-baseline after intentional fixes.`);
}
