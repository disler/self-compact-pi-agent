/**
 * 20-cell context bar renderer (pure).
 *
 * Cell i covers (5i, 5(i+1)] percent. Used cells are `#` inside the cached share
 * and `=` beyond it; free cells are `-`. Threshold markers overlay the cell whose
 * upper bound equals the threshold percent (index ceil(pct / 5) - 1):
 * `~` soft, `!` warning, `|` forced. Stronger markers win the same cell
 * (`|` > `!` > `~`), so a zero buffer shows a single `|`.
 */

export interface ContextBarInput {
	/** Used context as a percentage of the window, or null when unknown. */
	usedPct: number | null;
	/** Cached share of the window as a percentage (0 when unknown). */
	cachedPct?: number;
	softPct: number;
	warnPct: number;
	forcedPct: number;
	cells?: number;
}

export interface ContextBarOutput {
	/** The 20 cells joined, without brackets. */
	bar: string;
	/** `40%` or `--%`. */
	label: string;
	/** `[###~====-!-|--------] 40%` */
	text: string;
	cells: string[];
}

export const CELL_CACHED = "#";
export const CELL_USED = "=";
export const CELL_FREE = "-";
export const MARK_SOFT = "~";
export const MARK_WARN = "!";
export const MARK_FORCED = "|";

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/** Cell index whose upper bound is `pct` (cell width = 100 / cells). */
export function markerIndex(pct: number, cells: number): number {
	const width = 100 / cells;
	return clamp(Math.ceil(pct / width) - 1, 0, cells - 1);
}

export function renderContextBar(input: ContextBarInput): ContextBarOutput {
	const cells = input.cells && input.cells > 0 ? Math.floor(input.cells) : 20;
	const width = 100 / cells;
	const out: string[] = new Array(cells).fill(CELL_FREE);
	if (input.usedPct !== null && Number.isFinite(input.usedPct)) {
		const used = clamp(Math.ceil(clamp(input.usedPct, 0, 100) / width), 0, cells);
		const cachedPct = clamp(input.cachedPct ?? 0, 0, 100);
		const cached = Math.min(used, clamp(Math.ceil(cachedPct / width), 0, cells));
		for (let i = 0; i < used; i++) out[i] = i < cached ? CELL_CACHED : CELL_USED;
	}
	// Weakest first so stronger markers overwrite on a shared cell.
	out[markerIndex(input.softPct, cells)] = MARK_SOFT;
	out[markerIndex(input.warnPct, cells)] = MARK_WARN;
	out[markerIndex(input.forcedPct, cells)] = MARK_FORCED;
	const label = input.usedPct === null || !Number.isFinite(input.usedPct) ? "--%" : `${Math.round(clamp(input.usedPct, 0, 100))}%`;
	const bar = out.join("");
	return { bar, label, text: `[${bar}] ${label}`, cells: out };
}

/** 950 -> "950", 120000 -> "120.0k", 1000000 -> "1.00M" */
export function formatTokens(n: number | null | undefined): string {
	if (n === null || n === undefined || !Number.isFinite(n)) return "?";
	if (n < 1_000) return `${Math.round(n)}`;
	if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
	return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatPct(pct: number | null | undefined, digits = 0): string {
	if (pct === null || pct === undefined || !Number.isFinite(pct)) return "--%";
	return `${pct.toFixed(digits)}%`;
}
