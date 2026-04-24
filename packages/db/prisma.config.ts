import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../..");
const envPath = path.join(workspaceRoot, ".env");
const envExamplePath = path.join(workspaceRoot, ".env.example");

loadEnv({
  path: existsSync(envPath) ? envPath : envExamplePath,
});

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
