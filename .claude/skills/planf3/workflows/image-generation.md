# Image Generation

Fill or update the embedded images in an existing plan `.html` file. Pick the sub-workflow based on the incoming `USER_PROMPT`:

| Sub-workflow | When to call it |
| --- | --- |
| Create | The prompt asks to generate, fill, or add the plan's images from scratch (empty `{{...IMAGE` slots) |
| Update | The prompt asks to change, refine, regenerate, or replace images that already exist in the plan |

Scripts (run with `uv run`, needs `OPENAI_API_KEY`):
- Create image: `uv run .claude/skills/planf3/scripts/generate_gpt_image.py "<prompt>" <output.png> --size 1536x1024 --quality high`
- Edit image: `uv run .claude/skills/planf3/scripts/edit_gpt_image.py "<instruction>" <output.png> <input.png> --size 1536x1024 --quality high`

Shared rules for every image prompt:
- default to the visual identity from `../SKILL.md`: dark background, crisp white primary text, bold yellow accent, clean geometric typography, restrained glow, and sharp technical engineering motifs
- avoid generic blue-purple SaaS art, pastel gradients, glassmorphism, and excessive rounded-card compositions
- always generate in wide format (`--size 1536x1024`) at high quality (`--quality high`)
- convey the one or two core ideas of that section for a professional software engineer
- match the plan's synced visual identity (professional, focused, minimal)
- keep total words shown in the image under 10
- save images to `IMAGES_OUTPUT_DIR` (create it if missing)

## Image vs SVG (per non-hero slot)

Every slot EXCEPT the hero can be filled with a generated image OR a hand-crafted inline `<svg>`. The hero is ALWAYS a generated image — never an SVG.

**Core guideline:** if documenting information that is subject to change (schemas, state models, schedules, pipeline stages, commands, APIs), strongly prefer HTML tables or hand-crafted inline SVG over image generation so the visual is clear, simple, concise, and easily adjustable as code evolves. Reserve AI image generation primarily for high-level, abstract, or atmospheric concept explanations (like the hero).

Choose an **SVG** when the slot is fundamentally a structural diagram that doesn't need rich/photographic imagery: architecture diagrams, flowcharts, sequence/state diagrams, data models, dependency/relationship graphs, pipelines, before/after structures. An SVG renders these crisper, simpler, and self-contained.

Choose a **generated image** when the slot wants a rich, conceptual, or atmospheric visual (the hero, mood/metaphor visuals, anything photographic or illustrative).

An SVG substitution must obey the SAME rules a generated image would:
- **Always check your work:** visually verify the rendered SVG in a browser to ensure crispness, alignment, and proper layout.
- **Zero text overlap:** ensure generous padding and spacing between nodes, labels, and connecting paths. No overlapping text or clipped boxes.
- **Minimum text size 16px:** all text in SVGs must have a minimum `font-size` of 16px (16px for sub-labels, 18–20px for node titles, 22–26px for section headers).
- match the plan's synced `:root` visual identity (reuse the CSS custom properties — same palette, type, stroke weights); professional, focused, minimal
- convey only the one or two core ideas of that section
- keep total words shown under 10
- be properly centered and spaced inside its `<figure>`
- be authored as clean, semantic inline `<svg>` (no external refs, no `<script>`, no raster `<image>`) so the document stays self-contained

## Create

1. Find slots - Grep the plan for `{{...IMAGE` placeholders (hero + per-section). Each comment names the intended subject.
2. Decide image vs SVG - For each NON-hero slot, apply the *Image vs SVG* rule above. The hero is always a generated image.
3. For each generated-image slot:
   a. Write prompt - following the shared rules above.
   b. Generate - Run `generate_gpt_image.py` once, writing to `IMAGES_OUTPUT_DIR`. Parallelize independent generations.
   c. Embed - Replace the `<!-- {{...IMAGE: ...}} -->` placeholder with `<img src="<plan-name>/<file>.png" alt="...">`, keeping the existing `<figure>`/`<figcaption>`.
4. For each SVG slot:
   a. Author - Hand-craft a clean inline `<svg>` for the slot's subject, following the SVG rules above.
   b. Embed - Replace the `<!-- {{...IMAGE: ...}} -->` placeholder with the inline `<svg>...</svg>`, keeping the existing `<figure>`/`<figcaption>`.
5. Report - List, per slot, whether it was filled with a generated image or an inline SVG.

## Update

1. Identify targets - From the `USER_PROMPT`, determine which embedded visuals to change. A target may be a generated `<img>` OR an inline `<svg>`.
2. For each generated `<img>` target:
   a. Write instruction - describe the change, following the shared rules above.
   b. Edit - Run `edit_gpt_image.py` with the existing PNG as input, overwriting it (the script backs up the original first).
   c. Verify embed - Confirm the `<img>` still points at the updated file; update `src`/`alt`/`<figcaption>` if the change warrants it.
3. For each inline `<svg>` target:
   a. Edit the SVG markup in place per the *Image vs SVG* rules (synced `:root` identity, ≤10 words, self-contained).
   b. If the change makes the slot better served by a generated image (or vice-versa), swap the embed form accordingly — replace the `<svg>` with an `<img>` (generate it) or an `<img>` with an `<svg>` (author it). The hero stays a generated image.
4. Report - List each visual updated, whether it is an image or SVG, and what changed.
