/** Root directory for ephemeral Crawlee request-queue storage (cwd-relative). */
export declare const FLIGHTCHECK_STORAGE_ROOT = ".flightcheckStorage";
/**
 * Create a unique per-run storage path: `.flightcheckStorage/<hash>`.
 * Concurrent runs each get their own subdirectory so cleanup of one does not
 * wipe another run's queue files.
 */
export declare function createRunStoragePath(options?: {
    cwd?: string;
    seed?: string;
}): {
    rootDir: string;
    runDir: string;
    runId: string;
};
/** Remove a single run subdirectory. Ignores missing paths. */
export declare function cleanupRunStorageDir(runDir: string): Promise<void>;
//# sourceMappingURL=crawleeStorage.d.ts.map