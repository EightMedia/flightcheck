import { createHash, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

/** Root directory for ephemeral Crawlee request-queue storage (cwd-relative). */
export const FLIGHTCHECK_STORAGE_ROOT = ".flightcheckStorage";

/**
 * Create a unique per-run storage path: `.flightcheckStorage/<hash>`.
 * Concurrent runs each get their own subdirectory so cleanup of one does not
 * wipe another run's queue files.
 */
export function createRunStoragePath(options?: {
  cwd?: string;
  seed?: string;
}): { rootDir: string; runDir: string; runId: string } {
  const cwd = options?.cwd ?? process.cwd();
  const runId = createHash("sha256")
    .update(`${options?.seed ?? ""}:${Date.now()}:${process.pid}:${randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 16);
  const rootDir = path.join(cwd, FLIGHTCHECK_STORAGE_ROOT);
  const runDir = path.join(rootDir, runId);
  return { rootDir, runDir, runId };
}

/** Remove a single run subdirectory. Ignores missing paths. */
export async function cleanupRunStorageDir(runDir: string): Promise<void> {
  await rm(runDir, { recursive: true, force: true });
}
