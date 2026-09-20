#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Assemble every icons/*.svg into one inline SVG <symbol> sprite (icons/sprite.svg).

The sprite is the paste-ready, self-contained block a planf3 plan embeds once at the
top of its <body>; each icon is then referenced with:

    <svg class="ic"><use href="#ic-<name>"/></svg>

Add a new icon by dropping a 0 0 24 24 viewBox SVG into this dir and re-running:

    uv run .claude/skills/planf3/icons/build-sprite.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ICONS_DIR = Path(__file__).parent
SPRITE = ICONS_DIR / "sprite.svg"
DEFAULT_VIEWBOX = "0 0 24 24"


def viewbox(svg_text: str) -> str:
    """Read the icon's own viewBox (so real brand logos can use their native coords);
    fall back to the 24x24 default when absent."""
    m = re.search(r'<svg\b[^>]*\bviewBox="([^"]+)"', svg_text)
    return m.group(1) if m else DEFAULT_VIEWBOX


def inner(svg_text: str) -> str:
    """Strip the outer <svg ...> … </svg>, keep the inner markup, normalize indent."""
    body = re.sub(r"(?s)^.*?<svg\b[^>]*>", "", svg_text)
    body = re.sub(r"(?s)</svg>\s*$", "", body)
    return "\n".join("    " + ln.strip() for ln in body.strip().splitlines() if ln.strip())


def main(argv: list[str]) -> int:
    icons = sorted(p for p in ICONS_DIR.glob("*.svg") if p.name != "sprite.svg")
    if not icons:
        print("no icons found", file=sys.stderr)
        return 1

    symbols = []
    for p in icons:
        name = p.stem
        svg = p.read_text()
        symbols.append(
            f'  <symbol id="ic-{name}" viewBox="{viewbox(svg)}">\n{inner(svg)}\n  </symbol>'
        )

    sprite = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" '
        'style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">\n'
        + "\n".join(symbols)
        + "\n</svg>\n"
    )
    SPRITE.write_text(sprite)

    ids = ", ".join(f"ic-{p.stem}" for p in icons)
    print(f"wrote {SPRITE.relative_to(ICONS_DIR.parent.parent.parent)} with {len(icons)} symbols")
    print(f"ids: {ids}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
