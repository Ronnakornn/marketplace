import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  loadEnvLocal();
  const { prisma } = await import("#server/lib/prisma.ts");
  const emails = parseAdminEmails();

  if (emails.length === 0) {
    throw new Error("ADMIN_EMAILS is required. Example: ADMIN_EMAILS=admin@example.com");
  }

  const result = await prisma.user.updateMany({
    where: { email: { in: emails } },
    data: { role: "ADMIN" },
  });

  if (result.count === 0) {
    throw new Error(
      `No matching users found for ADMIN_EMAILS: ${emails.join(", ")}. Create the account first, then run db:seed-admin.`,
    );
  }

  console.log(`Promoted ${result.count} user(s) to ADMIN.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("#server/lib/prisma.ts");
    await prisma.$disconnect();
  });
