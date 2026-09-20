/**
 * Default thresholds for the self-compact extension. Edit here to change the shipped defaults.
 *
 * Each value is a percentage of the active model's context window, or a token count (`270000`, `100k`, `1.5m`).
 * The hard cutoff is not set directly: it is the warning line plus the buffer, capped at 90% of the window.
 *
 *   notice      10%   soft heads-up, nothing changes            --compact-soft-at 10%
 *   warning     20%   time to write a note and compact soon     --compact-at 20%
 *   hard cutoff 30%   every tool except self_compact is blocked --compact-buffer 10%   (20% + 10%)
 *
 * Override at launch with the CLI flags, e.g.
 *   pi -e extensions/self-compact/self-compact.ts --compact-soft-at 15% --compact-at 40% --compact-buffer 5%
 *   just soft=15% warn=40% buffer=5% run
 */
export interface ThresholdSpecs {
	/** --compact-soft-at: notice line. */
	softAt: string;
	/** --compact-at: warning line. */
	at: string;
	/** --compact-buffer: allowance above the warning line before the hard cutoff (0 = cutoff at the warning line). */
	buffer: string;
}

export const DEFAULT_SPECS: ThresholdSpecs = { softAt: "10%", at: "20%", buffer: "10%" };

/** The hard cutoff never sits above this fraction of the model window. */
export const HARD_CAP_FRACTION = 0.9;
