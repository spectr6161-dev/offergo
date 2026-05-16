import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "public", "downloads");
const targetDir = path.join(rootDir, "dist", "downloads");

async function ensureDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function copyDownloads() {
  try {
    const entries = await readdir(sourceDir);
    await ensureDirectory(targetDir);

    for (const entry of entries) {
      const from = path.join(sourceDir, entry);
      const to = path.join(targetDir, entry);
      const entryStat = await stat(from);

      if (entryStat.isFile()) {
        await cp(from, to, { force: true });
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

await copyDownloads();
