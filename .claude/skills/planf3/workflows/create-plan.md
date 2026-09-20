# Create Plan

1. Analyze Requirements - THINK HARD and parse the `USER_PROMPT` to understand the core problem and desired outcome
2. Explore Codebase - Understand existing patterns, architecture, relevant files, and prior specs to back-reference. Read `AI_DOCS` for AI/agent-facing documentation and `APP_DOCS` for application documentation to ground the plan.
3. Design Solution - Develop technical approach including architecture decisions and implementation strategy
4. Author HTML Plan - Fill the `## Plan Template`, replacing every `{{PLACEHOLDER}}` and repeating `<!-- repeat -->` blocks as needed. **Inline the icon sprite**: paste the full contents of `.claude/skills/planf3/icons/sprite.svg` into the marked block near `<body>`, add the `.ic` CSS rule to the plan's `<style>`, and apply the icon conventions (file-type icons in Relevant Files by extension; `ic-table`/`ic-type` in Database Models; `ic-agent` wherever an agent is named) per the *Inline icons* instruction in `SKILL.md`. **Build the TOC last**, once the sections and phases are final: one link per section that exists, one nested link per phase, every `href` matching a real `id` (each phase div needs `id="phase-N"`). Click-test it by reading back the ids — no dead anchors.
5. Generate Images - Run the Create sub-workflow in `workflows/image-generation.md` to fill the `{{...IMAGE` slots. Parallelize the image generation as there's no reason to block here.
6. Surface Questionables - If `QUESTIONABLE` is true, populate the conditional Questionables section with open decisions/assumptions/risks; otherwise omit the section
7. Generate Filename - Create a descriptive kebab-case filename based on the plan's main topic
8. Save - Write the plan to `PLAN_FILE` and provide a summary of key components
9. Open in Browser - Open the saved plan in `BROWSER` (e.g. `open -a "Google Chrome" PLAN_FILE`)
