#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "openai>=1.50.0",
#     "python-dotenv>=1.0.0",
# ]
# ///
"""
Edit existing images using OpenAI's gpt-image-2.5-sunburst (ChatGPT Images 2.5 Sunburst).

Pass one or more input images. With multiple inputs, the model composes them.

Usage:
    python edit_gpt_image.py input.png "edit instruction" output.png [options]
    python edit_gpt_image.py "Put cat on couch" result.png cat.png couch.png [options]

Examples:
    python edit_gpt_image.py photo.png "Add a rainbow in the sky" edited.png
    python edit_gpt_image.py "Make a group photo" group.png p1.png p2.png p3.png

Models:
    gpt-image-2.5-sunburst (default) - Highest precision for multi-turn edits and subject preservation
    gpt-image-2.5-flare              - 2x faster for quick iterations with identical token pricing

Environment:
    OPENAI_API_KEY - Required API key
"""

import argparse
import base64
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path.cwd() / ".env")


def backup_if_exists(output_path: str) -> None:
    """Copy an existing output file into ./backup/ before it gets overwritten.

    Edits often target a path that already holds an image (sometimes the input
    itself), so back the original up first — losing it to an edit is silent and
    unrecoverable. backup/ self-ignores via a backup/.gitignore of "*".
    """
    out = Path(output_path)
    if not out.exists():
        return
    backup_dir = Path.cwd() / "backup"
    backup_dir.mkdir(exist_ok=True)
    gitignore = backup_dir / ".gitignore"
    if not gitignore.exists():
        gitignore.write_text("*\n")
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = backup_dir / f"{out.stem}_{ts}{out.suffix}"
    counter = 1
    while dest.exists():
        dest = backup_dir / f"{out.stem}_{ts}_{counter}{out.suffix}"
        counter += 1
    shutil.copy2(out, dest)
    print(f"Backed up existing {output_path} -> {dest}")


VALID_QUALITY = ["auto", "low", "medium", "high", "xhigh", "max"]
VALID_FORMATS = ["png", "jpeg", "webp"]
VALID_BACKGROUNDS = ["auto", "transparent", "opaque"]


def edit_gpt_image(
    input_paths: list[str],
    instruction: str,
    output_path: str,
    model: str = "gpt-image-2.5-sunburst",
    size: str = "auto",
    quality: str = "high",
    output_format: str = "png",
    output_compression: int | None = None,
    mask_path: str | None = None,
    background: str | None = None,
) -> None:
    """Edit/compose images using gpt-image-2.5-sunburst or specified model."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY environment variable not set")

    for p in input_paths:
        if not os.path.exists(p):
            raise FileNotFoundError(f"Input image not found: {p}")

    client = OpenAI(api_key=api_key)

    image_files = [open(p, "rb") for p in input_paths]
    try:
        kwargs = {
            "model": model,
            "image": image_files if len(image_files) > 1 else image_files[0],
            "prompt": instruction,
            "size": size,
            "quality": quality,
            "output_format": output_format,
        }
        if background is not None:
            kwargs["background"] = background
        if output_compression is not None and output_format in {"jpeg", "webp"}:
            kwargs["output_compression"] = output_compression
        if mask_path:
            if not os.path.exists(mask_path):
                raise FileNotFoundError(f"Mask not found: {mask_path}")
            kwargs["mask"] = open(mask_path, "rb")

        print(f"Model:      {model}")
        print(f"Inputs:     {', '.join(input_paths)}")
        print(f"Size:       {size}")
        print(f"Quality:    {quality}")
        print(f"Format:     {output_format}")
        print(f"Prompt:     {instruction[:120]}{'...' if len(instruction) > 120 else ''}")
        print()
        print("Editing image...")

        result = client.images.edit(**kwargs)
    finally:
        for f in image_files:
            f.close()
        if mask_path and "mask" in kwargs:
            kwargs["mask"].close()

    item = result.data[0]
    backup_if_exists(output_path)
    Path(output_path).write_bytes(base64.b64decode(item.b64_json))
    print(f"Saved: {output_path}")

    if getattr(result, "usage", None):
        print(f"Usage: {result.usage}")


def main():
    parser = argparse.ArgumentParser(
        description="Edit/compose images using OpenAI gpt-image-2.5-sunburst (or gpt-image-2.5-flare)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("instruction", help="Edit/compose instruction")
    parser.add_argument("output", help="Output file path")
    parser.add_argument(
        "inputs",
        nargs="+",
        help="One or more input image paths (multiple = composition)",
    )
    parser.add_argument(
        "--model",
        "-m",
        default="gpt-image-2.5-sunburst",
        help="Model ID (default: gpt-image-2.5-sunburst; or gpt-image-2.5-flare, gpt-image-2)",
    )
    parser.add_argument(
        "--size",
        "-s",
        default="auto",
        help="Image size WxH (default: auto). E.g. 1024x1024, 1536x1024, 2048x2048.",
    )
    parser.add_argument(
        "--quality",
        "-q",
        default="high",
        choices=VALID_QUALITY,
        help="Quality tier (default: high; low, medium, high, xhigh, max)",
    )
    parser.add_argument(
        "--background",
        "-b",
        default=None,
        choices=VALID_BACKGROUNDS,
        help="Background transparency (transparent, opaque, auto)",
    )
    parser.add_argument(
        "--format",
        "-f",
        default="png",
        choices=VALID_FORMATS,
        help="Output format (default: png)",
    )
    parser.add_argument(
        "--compression",
        type=int,
        default=None,
        help="Output compression 0-100 (jpeg/webp only)",
    )
    parser.add_argument(
        "--mask",
        default=None,
        help="Optional mask PNG (transparent areas = regions to edit)",
    )

    args = parser.parse_args()

    try:
        edit_gpt_image(
            input_paths=args.inputs,
            instruction=args.instruction,
            output_path=args.output,
            model=args.model,
            size=args.size,
            quality=args.quality,
            output_format=args.format,
            output_compression=args.compression,
            mask_path=args.mask,
            background=args.background,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
