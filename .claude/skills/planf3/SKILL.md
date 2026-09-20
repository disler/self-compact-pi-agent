---
name: planf3
description: Creates a concise engineering implementation plan based on user requirements and saves it to specs directory
argument-hint: "[user-prompt] [questionable]"
---

# Plan F3

## Purpose

Create a detailed, **HTML-first** implementation plan based on the `USER_PROMPT` variable. The plan is authored as a single self-contained `.html` page so it can be opened in a browser, embed focused images with a synced visual identity, and be created/updated/consumed by the agent trifecta (engineer, team, AI agents). Analyze the request, think through the implementation approach, follow the `## Instructions`, and work through the `## Workflow` to produce the plan from the `## Plan Template`.

## Variables

USER_PROMPT: $1
QUESTIONABLE: $2 - default false
PLAN_OUTPUT_DIRECTORY: `specs/`
PLAN_FILE: `PLAN_OUTPUT_DIRECTORY/<descriptive-kebab-name>.html`
IMAGES_OUTPUT_DIR: `PLAN_OUTPUT_DIRECTORY/<plan-name>/`
AI_DOCS: `AI_DOCS/`
APP_DOCS: `APP_DOCS/`
IDE: `code`
BROWSER: `chrome`

## Instructions

- IMPORTANT: If no `USER_PROMPT` is provided, stop and ask the user to provide it
- Carefully analyze the user's requirements provided in the `USER_PROMPT` variable
- Think deeply (ultrathink) about the best approach to implement the requested functionality or solve the problem
- Explore the codebase to understand existing patterns, documentation, previous specs and architecture
- The plan is **HTML-first**: produce a single self-contained `.html` document from the `## Plan Template` below
- The template uses `{{PLACEHOLDER}}` variables — replace EVERY `{{...}}` with real content. Do not leave any `{{}}` token in the final file
- Blocks marked with `<!-- repeat -->` are repeatable: duplicate them as many times as the plan needs (e.g. one block per phase, task, file, or Q&A entry) and delete the comment markers
- The **Database Models** section captures the database models (tables / schemas / ORM or Pydantic models / migrations) involved in this work — `Existing Models` that change or are depended on, and `New Models` to add. Be specific (model/table name + what changes or why it's needed). **Use the inline icons** (see *Inline icons* below): prefix every database **table** name with the table icon (`<svg class="ic"><use href="#ic-table"/></svg>`) and every table-backed **type/model** name — Pydantic/ORM model, DTO, Swift struct, enum — with the database-type combo icon (`#ic-dbtype`), so table-backed models vs pure DTOs (which use `#ic-type`) vs tables read at a glance. Put the icon **inside** the `<code>` pill it labels. An entry often names both: `<code><svg class="ic"><use href="#ic-table"/></svg> app_foo</code> / <code><svg class="ic"><use href="#ic-dbtype"/></svg> AppFoo</code>`. Columns/fields get no icon but must always be referenced with their table prefix as `<code>&lt;table_name&gt;.&lt;field_name&gt;</code>` (e.g. `<code>app_foo.bar_field</code>`) anywhere in the plan (including prose and checklist items) to ensure unambiguous referencing; HTTP routes get the http icon (see *Inline icons*). If no database models are involved in this work, leave both lists empty — an empty section is perfectly fine
- **Inline icons (file-type · table · type · db-type · agent · http).** To raise human scan-ability, plans carry a small inline-SVG icon set so a reader recognizes what each reference *is* at a glance. Source icons live in `.claude/skills/planf3/icons/*.svg`; they assemble into ONE self-contained sprite (`.claude/skills/planf3/icons/sprite.svg`) via `uv run .claude/skills/planf3/icons/build-sprite.py` (re-run after adding an icon). To use them in a plan: (1) **inline the full sprite** once at the top of the `<body>` — never link an external file; plans must stay self-contained; (2) add the CSS rule `.ic{display:inline-block;width:1.1em;height:1.1em;vertical-align:-0.18em;margin-right:.35em;flex:0 0 auto}` to the plan's `<style>`; (3) reference an icon by placing it **INSIDE** the `<code>`/badge pill it labels — `<code><svg class="ic"><use href="#ic-NAME"/></svg> the-reference</code>` — so the mark rides inside the pill, never floating beside it. Conventions: prefix **every** file path mentioned *anywhere* in the plan (including the **Relevant Files** list, but also in prose, checklist tasks, notes, back/forward refs) inside <code> tags with its language icon by extension — `.swift`→`ic-swift`, `.ts/.tsx`→`ic-typescript`, `.js/.mjs/.cjs`→`ic-javascript`, `.py`→`ic-python`, `.vue`→`ic-vue`, `.sql`→`ic-sql`, `.json`→`ic-json`, `.md`→`ic-markdown`, anything else→`ic-file` — so files are instantly recognizable wherever they are mentioned; in **Database Models** use `ic-table` for tables, `ic-dbtype` for table-backed types, and `ic-type` for pure DTOs/types; for any **HTTP route/endpoint** (e.g. `GET /v1/projects/{id}/edit-state`) use `ic-http`; and **anywhere a plan names an agent** (an owner like `local-app-agent`, or “the cutter agent”) use `ic-agent`. Language marks use their traditional brand logos (Python two-tone snakes, Swift bird, Vue chevron, TS/JS tiles). Add a new icon by dropping an SVG (any `viewBox` — the build preserves it) into `icons/` and re-running the build.
- **Phase summary (always).** Inside Implementation Phases, directly below its description paragraphs and directly above the Phase 1 block, include a `Phase Summary` table with one row per phase: the phase's linked name, its purpose, and what will be done when the phase completes. Keep each cell to one line — it is the fast scan of the whole build so a reader gets what will be done at a glance; the phase blocks below carry the detail.
- **Table of contents (always).** Every plan carries a `<nav id="toc">` directly below the hero figure and directly above the Purpose section. One clickable in-page link per section that actually exists in the plan, plus a nested list with one link per phase (`#phase-1`, `#phase-2`, …) so a reader can jump straight to the phase they are building. Rules: every link points at a real `id` in the same file — no dead anchors; drop the entry for any section you leave out (e.g. Questionables when `QUESTIONABLE` is false); one line per entry, no descriptions. Give every phase `<div class="phase">` an `id="phase-N"` so the phase links resolve. Add `scroll-behavior:smooth` on `html` and `scroll-margin-top:1rem` on `section,.phase` to the `<style>` block so a jump lands cleanly under the top of the viewport. When you add or remove a section or a phase, update the TOC in the same edit.
- **Readability scale.** Default the plan's core/body text to a comfortable reading size — about **1.25× the old 16px base (≈20px)** on `body`, scaling headings/spacing proportionally from there. Larger base text also gives the inline `.ic` icons (sized in `em`) more presence inside their pills.
- Keep the document self-contained: all CSS lives in the single `<style>` block; do not link external stylesheets or scripts
- Maintain a **synced visual identity** between the HTML styling and generated images. Encode the identity directly in self-contained CSS and generated visuals.
- **Default visual identity:** dark background (`#0a0a0c` / `#121214`), crisp white primary type (`#f7f7f2` / `#ffffff`), muted silver body copy (`#a0a0a6`), structural charcoal borders (`#27272a` / `#292929`), and warm yellow primary accent (`#facc15` / `#ffd83d`). Use bold condensed or geometric uppercase display headings, oversized section numerals or yellow accent markers, restrained glow, and squared or lightly rounded technical panels. Avoid generic blue-purple SaaS styling, pastel gradients, glassmorphism, and excessive rounded cards.
- The CSS custom properties in `:root` are the plan's source of visual truth. Every inline SVG and generated image must use the same dark palette, yellow accent, white text contrast, and clean technical typography.
- For every image created keep them professional and focused on one or two primary ideas. Keep text bloat down by minimizing the total number of sets of words requested in the image prompt under 10. The goal is to build images that aid the plan and convey the core information throughout the plan given the section the image was created for. 
- Build images for professional software engineers to convey exactly what is going to be built. Be sure to center and space images properly. 
- Embed images via the `{{...IMAGE}}` slots. During Create, leave them as commented placeholders noting the intended subject; the Image Generation workflow fills them later
- **SVG-or-image choice (every slot EXCEPT the hero):** for any non-hero visual slot you may substitute a hand-crafted inline `<svg>` in place of a generated image when an SVG is the better, simpler solution — i.e. structural visuals that don't need rich/photographic imagery: architecture diagrams, flowcharts, sequence/state diagrams, data models, dependency graphs, tables-as-diagrams. **Rule of thumb: if documenting information that is subject to change (schemas, state models, schedules, pipeline stages, APIs), prefer HTML or SVG over image generation so it remains clear, simple, concise, and easily adjustable. Prefer AI image generation primarily for high-level, abstract, or atmospheric concept explanations (like the hero).** The HERO is ALWAYS a generated image. **Hero images must be useful, informational, and tangible:** ground them in concrete engineering infrastructure (scheduler machines, clock dials, database cylinders, server boxes, git branch pipelines) rather than fantasy sci-fi, glowing reactor cores, or meaningless aesthetic tropes. A substituted SVG must obey the SAME rules a generated image would:
  - **Always check your work:** visually verify the rendered SVG in a browser to confirm layout, alignments, and contrast.
  - **Zero text overlap:** ensure generous padding and spacing between nodes and labels; text, labels, and connecting lines must never overlap or clip.
  - **Minimum text size 16px:** all text in SVGs must have a minimum `font-size` of 16px (e.g. 16px for secondary/sub labels, 18–20px for node titles, 22–26px for headers) for crisp terminal and browser readability.
  - Synced `:root` visual identity, professional/focused/minimal, one or two core ideas, under 10 words of text, properly centered and spaced. Embed it as inline `<svg>` inside the existing `<figure>` (keeping the `<figcaption>`) so the document stays self-contained
- Populate the metadata header (`created`, `modified`, `commits`, `agent`, `session`, back/forward references) — these are updatable across the plan's lifecycle. Every metadata field except `CREATED_ISO` is a comma-separated list that must only ever be appended to — never overwrite or remove existing entries
- **Granular status discipline (general practice):** status markers live at BOTH levels — every individual task/checklist box AND every phase header. When work completes, check off the SPECIFIC task boxes that landed (`[x]`), not just the phase header. A phase header is only `[x]` once every task + test box inside it is `[x]` (or `[f]`); never leave a phase `[x]` while it still holds unchecked boxes, and never check only the phase header while its tasks stay `[]`. This keeps the plan a fine-grained, trustworthy ledger of what is actually done.
- **Tree views (always) — Relevant Files and Database Models render as nested trees, never flat lists.** Relevant Files: `directory → file` — one `<li class="dir">` per directory (its `<code>` carries the path), each file a leaf that keeps its language icon + `existing`/`new` tag + description; a directory with a single file still nests. Database Models: `database → table → field` — the table node carries the tag, the `ic-table` icon, its table-backed type/model icons, and the table-level description; when multiple FIELDS of one table are referenced they nest as `<code>table.field</code>` leaves under it, each with its own note (no field floats free of its table; omit the field `<ul>` when no fields are called out). Both keep the **Existing / New split** as the two top-level trees and require the `.ftree` CSS (see the template `<style>` comment).
- If `QUESTIONABLE` is true, actively surface open questions/assumptions in the toggleable Q&A section rather than silently deciding
- Ensure the plan is detailed enough that another developer (or agent) could follow it to implement the solution
- Include code examples or pseudo-code where appropriate to clarify complex concepts
- Consider edge cases, error handling, and scalability concerns
- Save the complete plan to `PLAN_FILE` using a descriptive kebab-case filename

## Workflow

Based on the `USER_PROMPT`, select the single best-matching workflow below and read its file for the step-by-step instructions before acting.

| Workflow | When to call it | File to read |
| --- | --- | --- |
| Create Plan | The prompt asks to plan, spec, or design new work and no existing plan is referenced | `workflows/create-plan.md` |
| Update Plan | The prompt asks to change, extend, or revise the content of an existing plan | `workflows/update-plan.md` |
| Update References | The prompt asks to refresh plan metadata or back/forward references (created, modified, commits, agent, session) | `workflows/update-references.md` |
| Build Plan | The prompt asks to implement, execute, or carry out the work described in an existing plan | `workflows/build-plan.md` |

### Subworkflow

Called by other workflows rather than selected directly from the `USER_PROMPT`.

| Subworkflow | When it's called | File to read |
| --- | --- | --- |
| Image Generation | Invoked by other workflows (e.g. Create Plan) to generate, fill, or regenerate the embedded images in a plan | `workflows/image-generation.md` |

## Plan Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Plan: {{PLAN_TITLE}}</title>
<!-- In the plan's <style> block: use the default visual identity defined above (dark background, yellow accent, white text), default the
     core/body text to ~20px (1.25x readability bump), include the inline-icon rule:
     .ic{display:inline-block;width:1.1em;height:1.1em;vertical-align:-0.18em;margin-right:.35em;flex:0 0 auto}
     and make the TOC jumps land cleanly:
     html{scroll-behavior:smooth}  section,.phase{scroll-margin-top:1rem}
     and the tree lists used by Relevant Files + Database Models:
     .ftree,.ftree ul{list-style:none;margin:0;padding-left:1.15rem;border-left:1px solid #292929}
     .ftree{padding-left:0;border-left:none}
     .ftree li{margin:.35rem 0}
     .ftree .dir>code{font-weight:600} -->
</head>
<body>

<!-- ===== INLINE ICON SPRITE (self-contained; raises human scan-ability) =====
     Paste the FULL contents of .claude/skills/planf3/icons/sprite.svg here, verbatim.
     (Regenerate it with: uv run .claude/skills/planf3/icons/build-sprite.py)
     Reference an icon INSIDE the <code>/badge pill it labels: <code><svg class="ic"><use href="#ic-swift"/></svg> the-reference</code>
     Ids: ic-swift ic-typescript ic-javascript ic-python ic-vue ic-sql ic-json ic-markdown ic-table ic-type ic-dbtype ic-agent ic-http ic-file -->

<main>

  <!-- ===== HEADER + UPDATABLE METADATA ===== -->
  <header>
    <h1>Plan: {{PLAN_TITLE}}</h1>
    <details class="meta">
      <summary>Metadata</summary>
      <dl>
        <dt>created</dt>      <dd>{{CREATED_ISO}}</dd>
        <dt>modified</dt>     <dd>{{MODIFIED_ISO_LIST}}</dd>
        <dt>commits</dt>      <dd>{{COMMIT_SHA_LIST}}</dd>
        <dt>agent name</dt>        <dd>{{AGENT_NAME_LIST}}</dd>
        <dt>session id</dt>      <dd>{{SESSION_ID_LIST}}</dd>
        <dt>back refs</dt>    <dd>{{BACK_REFERENCES}}</dd>
        <dt>forward refs</dt> <dd>{{FORWARD_REFERENCES}}</dd>
      </dl>
    </details>
  </header>

  <!-- Hero image — ALWAYS a generated image (never an SVG), synced to the :root visual identity. Replace with <img> once generated. -->
  <figure>
    <!-- {{HERO_IMAGE: subject describing the plan at a glance}} -->
    <figcaption>{{HERO_IMAGE_CAPTION}}</figcaption>
  </figure>

  <!-- ===== TABLE OF CONTENTS =====
       ALWAYS present, directly below the hero and directly above Purpose.
       One entry per section that EXISTS in this plan (delete the Questionables line when
       QUESTIONABLE is false), plus one nested entry per phase. Every href must match a real
       id in this file. -->
  <nav id="toc" class="toc">
    <h2>Contents</h2>
    <ol>
      <li><a href="#purpose">Purpose</a></li>
      <li><a href="#problem">Problem</a></li>
      <li><a href="#solution">Solution</a></li>
      <li><a href="#files">Relevant Files</a></li>
      <li><a href="#database-models">Database Models</a></li>
      <li><a href="#phases">Implementation Phases</a>
        <ol>
          <li><a href="#phase-summary">Phase Summary</a></li>
          <!-- repeat: one per phase; href must match that phase div's id -->
          <li><a href="#phase-{{PHASE_NUMBER}}">Phase {{PHASE_NUMBER}}: {{PHASE_NAME}}</a></li>
        </ol>
      </li>
      <li><a href="#validation">Validation Commands</a></li>
      <li><a href="#questionables">Questionables</a></li>
      <li><a href="#notes">Notes</a></li>
      <li><a href="#amendments">Amendments</a></li>
    </ol>
  </nav>

  <!-- CONVENTION for every {{...IMAGE}} slot BELOW the hero: fill with a generated <img>
       OR a hand-crafted inline <svg> when an SVG is the better, simpler fit (architecture/
       flow/sequence/state/data-model diagrams). SVG must follow the same rules as a generated
       image (synced :root identity, professional/minimal, ≤10 words). See the Image Generation
       subworkflow. The hero above is the only slot that must stay a generated image. -->

  <!-- ===== PURPOSE / PROBLEM / SOLUTION ===== -->
  <section id="purpose">
    <h2>Purpose</h2>
    <p>{{PURPOSE}}</p>
  </section>

  <section id="problem">
    <h2>Problem</h2>
    <p>{{PROBLEM}}</p>
    <figure>
      <!-- {{PROBLEM_IMAGE: subject visualizing the problem this plan addresses}} -->
      <figcaption>{{PROBLEM_IMAGE_CAPTION}}</figcaption>
    </figure>
  </section>

  <section id="solution">
    <h2>Solution</h2>
    <p>{{SOLUTION}}</p>
    <figure>
      <!-- {{SOLUTION_IMAGE: subject visualizing the proposed solution}} -->
      <figcaption>{{SOLUTION_IMAGE_CAPTION}}</figcaption>
    </figure>
  </section>

  <!-- ===== RELEVANT FILES =====
       TREE VIEW (always): directory → file. One <li class="dir"> per directory (its <code>
       carries the path); each file is a LEAF keeping its language icon + existing/new tag +
       description. Group by directory — a single-file directory still nests. The Existing /
       New split stays as the two top-level trees. Requires the .ftree CSS (see <style>).
       Icon by extension INSIDE the <code>: .swift->ic-swift, .ts/.tsx->ic-typescript,
       .js->ic-javascript, .py->ic-python, .vue->ic-vue, .sql->ic-sql, .json->ic-json,
       .md->ic-markdown, else ic-file. -->
  <section id="files" class="files">
    <h2>Relevant Files</h2>

    <h3>Existing Files</h3>
    <ul class="ftree">
      <!-- repeat: one <li class="dir"> per directory; nest its files -->
      <li class="dir"><code>{{DIRECTORY_PATH}}/</code>
        <ul>
          <!-- repeat: one leaf per file in this directory -->
          <li><span class="tag existing">existing</span> <code><svg class="ic"><use href="#ic-{{LANG_ICON}}"/></svg> {{FILE_NAME}}</code> — {{WHY_RELEVANT}}</li>
        </ul>
      </li>
    </ul>

    <h3>New Files</h3>
    <ul class="ftree">
      <!-- repeat: one <li class="dir"> per directory; nest its files -->
      <li class="dir"><code>{{DIRECTORY_PATH}}/</code>
        <ul>
          <!-- repeat: one leaf per file in this directory -->
          <li><span class="tag new">new</span> <code><svg class="ic"><use href="#ic-{{LANG_ICON}}"/></svg> {{FILE_NAME}}</code> — {{WHY_NEEDED}}</li>
        </ul>
      </li>
    </ul>
  </section>

  <!-- ===== DATABASE MODELS ===== -->
  <!-- Database models (tables / schemas / ORM or Pydantic models / migrations) touched by this work.
       List EXISTING models that change or are depended on, and NEW models to add.
       ICON CONVENTION: prefix every database TABLE name with the table icon (ic-table) and every TYPE/model
       name (Pydantic/ORM model, DTO, Swift struct, enum) with the type icon (ic-type), placed INSIDE the
       <code> pill, so tables vs types read at a glance. An entry often names both; apply whichever icon matches
       each <code> reference — columns/fields get no icon; HTTP routes get ic-http.
       (Requires the inline icon sprite + .ic CSS — see the sprite block near <body>.)
       If no database models are involved in this work, leave both lists empty (this is fine). -->
  <section id="database-models" class="database-models">
    <h2>Database Models</h2>

    <!-- TREE VIEW (always): database → table → field. A table node carries the tag, the
         ic-table icon, its table-backed type/model icons (ic-dbtype; ic-type for pure DTOs),
         and the table-level description. When the plan references multiple FIELDS of one
         table they nest as <code>table.field</code> leaves under it, each with its own note —
         no field floats free of its table. Omit a table's field <ul> when no fields are
         called out. The Existing / New split stays as the two top-level trees. -->
    <h3>Existing Models</h3>
    <ul class="ftree">
      <!-- repeat: one <li class="dir"> per database/schema -->
      <li class="dir"><code>{{DATABASE_OR_SCHEMA_NAME}}</code>
        <ul>
          <!-- repeat: one <li class="dir"> per table -->
          <li class="dir"><span class="tag existing">existing</span> <code><svg class="ic"><use href="#ic-table"/></svg> {{EXISTING_TABLE_NAME}}</code> / <code><svg class="ic"><use href="#ic-dbtype"/></svg> {{EXISTING_TYPE_NAME}}</code> — {{CHANGE_OR_RELATION}}
            <ul>
              <!-- repeat: one leaf per referenced field; omit this <ul> when no fields are called out -->
              <li><code>{{EXISTING_TABLE_NAME}}.{{FIELD_NAME}}</code> — {{FIELD_NOTE}}</li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>

    <h3>New Models</h3>
    <ul class="ftree">
      <!-- repeat: one <li class="dir"> per database/schema -->
      <li class="dir"><code>{{DATABASE_OR_SCHEMA_NAME}}</code>
        <ul>
          <!-- repeat: one <li class="dir"> per table -->
          <li class="dir"><span class="tag new">new</span> <code><svg class="ic"><use href="#ic-table"/></svg> {{NEW_TABLE_NAME}}</code> / <code><svg class="ic"><use href="#ic-dbtype"/></svg> {{NEW_TYPE_NAME}}</code> — {{PURPOSE_AND_KEY_FIELDS}}
            <ul>
              <!-- repeat: one leaf per referenced field; omit this <ul> when no fields are called out -->
              <li><code>{{NEW_TABLE_NAME}}.{{FIELD_NAME}}</code> — {{FIELD_NOTE}}</li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>
  </section>

  <!-- ===== IMPLEMENTATION PHASES ===== -->
  <section id="phases">
    <h2>Implementation Phases</h2>
    <p><strong>IMPORTANT:</strong> Execute every phase and task step by step, in order, top to bottom.</p>
    <p>Status markers: <code>[]</code> idle · <code>[wip]</code> in progress · <code>[x]</code> complete · <code>[f]</code> failed. All start as <code>[]</code>; the Build Plan workflow updates them as it works. <strong>Check off work at BOTH levels:</strong> mark each individual task/checklist box <code>[x]</code> as it lands, and mark a phase <code>[x]</code> ONLY once every task + test inside it is <code>[x]</code> (or <code>[f]</code>). A phase header must never be <code>[x]</code> while it still contains unchecked boxes.</p>

    <!-- ===== PHASE SUMMARY (always) — one row per phase, below the description
         above and directly above Phase 1. The fast scan of the whole build: what
         each phase is for and what will be done when it completes. One line per
         cell; the .phase blocks below carry the detail. -->
    <h3 id="phase-summary">Phase Summary</h3>
    <table class="phase-summary">
      <thead><tr><th>Phase</th><th>Purpose</th><th>Done when</th></tr></thead>
      <tbody>
        <!-- repeat: one row per phase -->
        <tr>
          <td><a href="#phase-{{PHASE_NUMBER}}">{{PHASE_NUMBER}}. {{PHASE_NAME}}</a></td>
          <td>{{PHASE_PURPOSE: what this phase is for}}</td>
          <td>{{PHASE_DONE_WHEN: what will be done / true when this phase completes}}</td>
        </tr>
      </tbody>
    </table>

    <!-- repeat: one .phase block per phase. The id must match its TOC link (#phase-N). -->
    <div class="phase" id="phase-{{PHASE_NUMBER}}">
      <h3><code class="status">[]</code> Phase {{PHASE_NUMBER}}: {{PHASE_NAME}}</h3>
      <p>{{PHASE_DESCRIPTION}}</p>

      <!-- Optional focused image for this phase, synced to :root identity -->
      <figure>
        <!-- {{PHASE_IMAGE: subject describing this phase's architecture/flow}} -->
        <figcaption>{{PHASE_IMAGE_CAPTION}}</figcaption>
      </figure>

      <!-- repeat: one <h4> + checklist per task -->
      <h4>{{TASK_NUMBER}}. {{TASK_NAME}}</h4>
      <ul class="checklist">
        <!-- repeat -->
        <li><code class="status">[]</code> {{SPECIFIC_ACTION}}</li>
      </ul>

      <!-- Final task of every phase: Testing Strategy + validation loop -->
      <h4>{{LAST_TASK_NUMBER}}. Testing Strategy</h4>
      <p>{{TESTING_APPROACH: technology used to test/validate, including edge cases}}</p>
      <ul class="checklist">
        <!-- repeat -->
        <li><code class="status">[]</code> <code>{{VALIDATION_COMMAND}}</code> — {{WHAT_IT_PROVES}}</li>
      </ul>
      <div class="loop">
        🔁 <strong>Do not exit this phase until every box above is checked.</strong>
        If any command fails, fix the cause and re-run — loop until all pass.
      </div>
    </div>
  </section>

  <!-- ===== GLOBAL VALIDATION ===== -->
  <section id="validation">
    <h2>Validation Commands</h2>
    <p>Execute these commands to validate the entire plan is complete:</p>
    <ul class="checklist">
      <!-- repeat -->
      <li><code class="status">[]</code> <code>{{VALIDATION_COMMAND}}</code> — {{WHAT_IT_PROVES}}</li>
    </ul>
    <div class="loop">
      🔁 <strong>The plan is not complete until every box is checked and every command passes. If for some reason a step is not possible to complete, mark it with [f] and move on if possible.</strong>
    </div>
  </section>

  <!-- ===== QUESTIONABLES (only include this section if QUESTIONABLE is true) ===== -->
  <section id="questionables">
    <h2>Questionables</h2>
    <!-- Optional image for this section, synced to :root identity -->
    <figure>
      <!-- {{QUESTIONABLES_IMAGE: subject visualizing the key open question/risk}} -->
      <figcaption>{{QUESTIONABLES_IMAGE_CAPTION}}</figcaption>
    </figure>
    <!-- repeat: one <details> per questionable decision / assumption / risk -->
    <details>
      <summary>{{QUESTIONABLE}}</summary>
      <p class="qa-answer">{{ASSUMPTION_OR_RATIONALE}}</p>
    </details>
  </section>

  <!-- ===== NOTES ===== -->
  <!-- Open canvas — the planning agent runs free here. There is no fixed shape:
       use whatever HTML best serves the plan (prose, lists, tables, code blocks,
       diagrams, callouts, decision logs, alternatives considered, open threads,
       links, anything). Embed as many image slots as the plan benefits from. -->
  <section id="notes">
    <h2>Notes</h2>
    {{NOTES: free-form. Capture anything that helps the trifecta understand, build,
      or extend this plan — context, dependencies (new libraries via `uv add`),
      tradeoffs, rejected approaches, risks, future work, references. Author rich,
      bespoke HTML as needed.}}
    <!-- repeat: add as many of these image slots as the notes warrant including the image block below -->
    <figure>
      <!-- {{NOTES_IMAGE: subject for a note worth visualizing}} -->
      <figcaption>{{NOTES_IMAGE_CAPTION}}</figcaption>
    </figure>
  </section>

  <!-- ===== AMENDMENTS ===== -->
  <!-- Running history of changes made AFTER the plan was first executed. Append-only.
       Populated by the Update Plan and Update References workflows — never edited during Create. -->
  <section id="amendments">
    <h2>Amendments</h2>
    <!-- repeat: one entry per amendment, newest at the bottom -->
    <details>
      <summary>{{AMEND_ISO}} — {{AMEND_SUMMARY}}</summary>
      <p>{{AMEND_DETAIL: what changed and why}}</p>
    </details>
  </section>

</main>
</body>
</html>
```