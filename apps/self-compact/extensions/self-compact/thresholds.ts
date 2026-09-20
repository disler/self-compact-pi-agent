/**
 * Threshold parsing and resolution for the self-compact extension.
 *
 * Pure module: no Pi imports, erasable TypeScript only (runs under Pi's jiti
 * loader and under Node's native type stripping for `node --test`).
 * The shipped defaults live in ./defaults.ts.
 */

export type TokenSpec =
	| { kind: "tokens"; value: number; raw: string }
	| { kind: "percent"; value: number; raw: string };

import { DEFAULT_SPECS, HARD_CAP_FRACTION, type ThresholdSpecs } from "./defaults.ts";

export { DEFAULT_SPECS, HARD_CAP_FRACTION, type ThresholdSpecs };

export type SpecSource = "flag" | "default";

export interface ThresholdSpecSources {
	softAt: SpecSource;
	at: SpecSource;
	buffer: SpecSource;
}

export const SPEC_HELP = "Use whole tokens (270000), k/m suffixes (100k, 1.5m), or a percentage (20%).";

const SPEC_RE = /^(\d+(?:\.\d+)?)\s*(k|m|%)?$/i;

/** Parse one threshold value. Throws a descriptive Error on invalid input. */
export function parseTokenSpec(raw: string | undefined, label: string): TokenSpec {
	const text = (raw ?? "").trim();
	if (!text) throw new Error(`Invalid ${label}: value is blank. ${SPEC_HELP}`);
	const match = SPEC_RE.exec(text);
	if (!match) throw new Error(`Invalid ${label}: "${text}". ${SPEC_HELP}`);
	const numberPart = Number(match[1]);
	const suffix = (match[2] ?? "").toLowerCase();
	if (!Number.isFinite(numberPart) || numberPart < 0) {
		throw new Error(`Invalid ${label}: "${text}" must be a non-negative number. ${SPEC_HELP}`);
	}
	if (suffix === "%") {
		if (numberPart > 100) throw new Error(`Invalid ${label}: "${text}" is above 100%.`);
		return { kind: "percent", value: numberPart, raw: text };
	}
	if (suffix === "k") return { kind: "tokens", value: Math.round(numberPart * 1_000), raw: text };
	if (suffix === "m") return { kind: "tokens", value: Math.round(numberPart * 1_000_000), raw: text };
	if (!Number.isInteger(numberPart)) {
		throw new Error(`Invalid ${label}: "${text}" must be a whole token count. ${SPEC_HELP}`);
	}
	return { kind: "tokens", value: numberPart, raw: text };
}

export interface ParsedSpecs {
	soft: TokenSpec;
	warn: TokenSpec;
	buffer: TokenSpec;
}

/** Parse all three specs. Throws on the first invalid value. */
export function parseSpecs(specs: ThresholdSpecs): ParsedSpecs {
	return {
		soft: parseTokenSpec(specs.softAt, "--compact-soft-at"),
		warn: parseTokenSpec(specs.at, "--compact-at"),
		buffer: parseTokenSpec(specs.buffer, "--compact-buffer"),
	};
}

/**
 * Load-time validation (no model window needed). Rejects what can be rejected
 * without knowing the window: percent above the cap, and same-unit ordering
 * violations. Mixed units are checked later by resolveThresholds().
 */
export function validateSpecs(specs: ThresholdSpecs): ParsedSpecs {
	const parsed = parseSpecs(specs);
	const capPct = HARD_CAP_FRACTION * 100;
	if (parsed.warn.kind === "percent" && parsed.warn.value > capPct) {
		throw new Error(`Invalid --compact-at: "${parsed.warn.raw}" is above the ${capPct}% hard cap.`);
	}
	if (parsed.soft.kind === "percent" && parsed.soft.value > capPct) {
		throw new Error(`Invalid --compact-soft-at: "${parsed.soft.raw}" is above the ${capPct}% hard cap.`);
	}
	if (parsed.soft.kind === parsed.warn.kind && parsed.soft.value > parsed.warn.value) {
		throw new Error(
			`Invalid thresholds: --compact-soft-at (${parsed.soft.raw}) must not exceed --compact-at (${parsed.warn.raw}).`,
		);
	}
	return parsed;
}

export interface ResolvedThresholds {
	contextWindow: number;
	capTokens: number;
	softTokens: number;
	warnTokens: number;
	bufferTokens: number;
	forcedTokens: number;
	softPct: number;
	warnPct: number;
	forcedPct: number;
	/** True when defaults were clamped to fit a small window. */
	clamped: boolean;
	notes: string[];
}

export type ResolveResult = { ok: true; thresholds: ResolvedThresholds } | { ok: false; error: string };

function toTokens(spec: TokenSpec, window: number): number {
	return spec.kind === "percent" ? Math.floor((spec.value / 100) * window) : spec.value;
}

export function pctOf(tokens: number, window: number): number {
	if (window <= 0) return 0;
	return (tokens / window) * 100;
}

/**
 * Resolve specs against a model window.
 * - forced = min(warn + buffer, cap) where cap = floor(0.9 * window)
 * - explicit settings that violate soft <= warn <= cap are rejected
 * - defaults that do not fit a small window are clamped with a note
 */
export function resolveThresholds(
	specs: ThresholdSpecs,
	contextWindow: number,
	options: { fromDefaults?: boolean } = {},
): ResolveResult {
	if (!Number.isFinite(contextWindow) || contextWindow <= 0) {
		return { ok: false, error: `Model context window is unknown (${contextWindow}); cannot resolve thresholds.` };
	}
	let parsed: ParsedSpecs;
	try {
		parsed = parseSpecs(specs);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	const capTokens = Math.floor(HARD_CAP_FRACTION * contextWindow);
	let softTokens = toTokens(parsed.soft, contextWindow);
	let warnTokens = toTokens(parsed.warn, contextWindow);
	const bufferTokens = toTokens(parsed.buffer, contextWindow);
	const notes: string[] = [];
	let clamped = false;

	if (warnTokens > capTokens) {
		if (options.fromDefaults) {
			notes.push(
				`Default --compact-at (${parsed.warn.raw}) exceeds the ${HARD_CAP_FRACTION * 100}% cap of this ${contextWindow}-token window; clamped to ${capTokens}.`,
			);
			warnTokens = capTokens;
			clamped = true;
		} else {
			return {
				ok: false,
				error: `Invalid --compact-at: ${parsed.warn.raw} (${warnTokens} tokens) exceeds the ${HARD_CAP_FRACTION * 100}% cap (${capTokens} tokens) of the ${contextWindow}-token window.`,
			};
		}
	}
	if (softTokens > warnTokens) {
		if (options.fromDefaults) {
			notes.push(`Default --compact-soft-at (${parsed.soft.raw}) exceeds the warning threshold; clamped to ${warnTokens}.`);
			softTokens = warnTokens;
			clamped = true;
		} else {
			return {
				ok: false,
				error: `Invalid thresholds: --compact-soft-at (${parsed.soft.raw} = ${softTokens} tokens) must not exceed --compact-at (${parsed.warn.raw} = ${warnTokens} tokens).`,
			};
		}
	}
	const forcedTokens = Math.min(warnTokens + bufferTokens, capTokens);
	if (warnTokens + bufferTokens > capTokens) {
		notes.push(`Forced threshold capped at ${HARD_CAP_FRACTION * 100}% (${capTokens} tokens).`);
	}
	return {
		ok: true,
		thresholds: {
			contextWindow,
			capTokens,
			softTokens,
			warnTokens,
			bufferTokens,
			forcedTokens,
			softPct: pctOf(softTokens, contextWindow),
			warnPct: pctOf(warnTokens, contextWindow),
			forcedPct: pctOf(forcedTokens, contextWindow),
			clamped,
			notes,
		},
	};
}

export type UsageLevel = "unknown" | "idle" | "notice" | "warning" | "forced";

/** Level for a token count. Forced wins ties, so a zero buffer enforces at the warning line. */
export function levelFor(tokens: number | null | undefined, thresholds: ResolvedThresholds): UsageLevel {
	if (tokens === null || tokens === undefined || !Number.isFinite(tokens)) return "unknown";
	if (tokens >= thresholds.forcedTokens) return "forced";
	if (tokens >= thresholds.warnTokens) return "warning";
	if (tokens >= thresholds.softTokens) return "notice";
	return "idle";
}

export const LEVEL_ORDER: Record<UsageLevel, number> = { unknown: -1, idle: 0, notice: 1, warning: 2, forced: 3 };
