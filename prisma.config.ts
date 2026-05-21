import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: path.join(__dirname, ".env.local") });
loadEnv({ path: path.join(__dirname, ".env") });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://postgres:password@localhost:5432/sming?schema=public",
  },
});
