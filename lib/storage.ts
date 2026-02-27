import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {existsSync} from "node:fs";

// UPLOADS_DIR is set to <project root>/uploads using process.cwd()
const UPLOADS_DIR = join(process.cwd(), "uploads");

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

export async function saveFile(
  storageKey: string,
  buffer: Buffer
): Promise<void> {
  await ensureUploadsDir();
  const filePath = join(UPLOADS_DIR, storageKey);
  await writeFile(filePath, buffer);
}

export async function getFile(storageKey: string): Promise<Buffer> {
  const filePath = join(UPLOADS_DIR, storageKey);
  return readFile(filePath);
}
