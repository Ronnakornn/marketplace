import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(process.cwd(), "app");
const sourceExtensions = new Set([".ts", ".tsx"]);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) return listSourceFiles(absolute);
    if (!sourceExtensions.has(absolute.slice(absolute.lastIndexOf(".")))) return [];
    if (absolute.endsWith(".test.ts") || absolute.endsWith(".test.tsx")) return [];
    return [absolute];
  });
}

describe("frontend role contract", () => {
  it("does not model seller access as a User.role value", () => {
    const forbiddenPatterns = [
      /ROLES\.SELLER/,
      /isSellerRole/,
      /role is ["']SELLER["']/,
      /["']SELLER["']/,
    ];

    const offenders = listSourceFiles(appRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const matched = forbiddenPatterns.some((pattern) => pattern.test(source));
      return matched ? [filePath.replace(`${appRoot}\\`, "app\\")] : [];
    });

    expect(offenders).toEqual([]);
  });
});
