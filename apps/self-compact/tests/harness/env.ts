/**
 * Shared paths and per-test working directories for the e2e suites.
 * Everything is written under apps/self-compact/verification/ (gitignored, recreated on every run).
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const HARNESS_DIR = resolve(new URL(".", import.meta.url).pathname);
export const WORKDIR = resolve(HARNESS_DIR, "..", "..");
export const EXTENSION = join(WORKDIR, "extensions", "self-compact", "self-compact.ts");
export const FAKE_PROVIDER = join(HARNESS_DIR, "fake-provider.ts");
export const VERIFICATION_DIR = join(WORKDIR, "verification");
export const TMP_ROOT = join(VERIFICATION_DIR, "tmp");

export interface TestDir {
	dir: string;
	sessionDir: string;
	logFile: string;
	traceFile: string;
}

/** Fresh working directory with small compaction retention so the scripted conversation has something to cut. */
export function makeTestDir(name: string, settings: Record<string, unknown> = {}): TestDir {
	const dir = join(TMP_ROOT, name);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(join(dir, ".pi"), { recursive: true });
	const sessionDir = join(dir, "sessions");
	mkdirSync(sessionDir, { recursive: true });
	writeFileSync(
		join(dir, ".pi", "settings.json"),
		JSON.stringify({ compaction: { enabled: true, reserveTokens: 16384, keepRecentTokens: 1500 }, ...settings }, null, 2),
	);
	return { dir, sessionDir, logFile: join(dir, "rpc.log"), traceFile: join(dir, "fake-trace.jsonl") };
}

/** CLI args shared by every scripted run. */
export function scriptedArgs(t: TestDir, extra: string[] = [], options: { session?: string } = {}): string[] {
	const args = [
		"--no-extensions",
		"--no-skills",
		"--no-prompt-templates",
		"--no-context-files",
		"-a",
		"-e",
		EXTENSION,
		"-e",
		FAKE_PROVIDER,
		"--model",
		"fake/scripted",
		"--session-dir",
		t.sessionDir,
	];
	if (options.session) args.push("--session", options.session);
	return [...args, ...extra];
}

export function latestSessionFile(t: TestDir): string | undefined {
	if (!existsSync(t.sessionDir)) return undefined;
	const walk = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
			entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith(".jsonl") ? [join(dir, entry.name)] : [],
		);
	const files = walk(t.sessionDir).sort();
	return files[files.length - 1];
}

export const DEFAULT_FAKE_ENV: Record<string, string> = {
	SC_FAKE_WINDOW: "200000",
	SC_FAKE_BASE: "5000",
	SC_FAKE_STEP: "20000",
};
