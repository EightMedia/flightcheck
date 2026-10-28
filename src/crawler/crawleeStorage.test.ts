import { mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FLIGHTCHECK_STORAGE_ROOT,
  cleanupRunStorageDir,
  createRunStoragePath,
} from "./crawleeStorage.js";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const dir of tempRoots.splice(0)) {
    await cleanupRunStorageDir(dir);
  }
});

describe("createRunStoragePath", () => {
  it("uses .flightcheckStorage/<hash> under cwd", () => {
    const { rootDir, runDir, runId } = createRunStoragePath({ cwd: "/tmp/project" });
    expect(rootDir).toBe(path.join("/tmp/project", FLIGHTCHECK_STORAGE_ROOT));
    expect(runDir).toBe(path.join(rootDir, runId));
    expect(runId).toMatch(/^[a-f0-9]{16}$/);
  });

  it("gives distinct run ids for concurrent-looking calls", () => {
    const a = createRunStoragePath({ seed: "https://a.example" });
    const b = createRunStoragePath({ seed: "https://a.example" });
    expect(a.runId).not.toBe(b.runId);
  });
});

describe("cleanupRunStorageDir", () => {
  it("removes only the run subdirectory", async () => {
    const base = await mkdir(path.join(os.tmpdir(), `fc-storage-${Date.now()}`), { recursive: true });
    tempRoots.push(base!);
    const runA = path.join(base!, "aaa");
    const runB = path.join(base!, "bbb");
    await mkdir(runA, { recursive: true });
    await mkdir(runB, { recursive: true });
    await writeFile(path.join(runA, "entries.json"), "[]");
    await writeFile(path.join(runB, "keep.json"), "{}");

    await cleanupRunStorageDir(runA);

    const remaining = await readdir(base!);
    expect(remaining).toEqual(["bbb"]);
  });
});
