#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "openai>=1.50.0",
#     "python-dotenv>=1.0.0",
# ]
# ///
"""
Generate images using OpenAI's gpt-image-2.5-sunburst (ChatGPT Images 2.5 Sunburst).

Usage:
    python generate_gpt_image.py "prompt" output.png [options]

Examples:
    python generate_gpt_image.py "A sunset over mountains" sunset.png
    python generate_gpt_image.py "Company logo" logo.png --size 1024x1024 --quality high
    python generate_gpt_image.py "Icon with transparent background" icon.png --background transparent
    python generate_gpt_image.py "Wide cinematic shot" wide.png --size 2048x1152
    python generate_gpt_image.py "Fast generation" fast.png --model gpt-image-2.5-flare

Models:
    gpt-image-2.5-sunburst (default) - Highest precision for detailed work and multi-turn edits (~30s)
    gpt-image-2.5-flare              - 2x faster (~14s) for everyday one-shot generation with same token cost

Environment:
    OPENAI_API_KEY - Required API key
"""

import argparse
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path.cwd() / ".env")


VALID_QUALITY = ["auto", "low", "medium", "high", "xhigh", "max"]
VALID_FORMATS = ["png", "jpeg", "webp"]
VALID_MODERATION = ["auto", "low"]
VALID_BACKGROUNDS = ["auto", "transparent", "opaque"]

# Popular sizes — GPT Image models also accept any custom size meeting:
#   max edge ≤ 3840, both edges multiples of 16, aspect ≤ 3:1, 655360–8294400 total px
POPULAR_SIZES = [
    "auto",
    "1024x1024",
    "1536x1024",
    "1024x1536",
    "2048x2048",
    "2048x1152",
    "1152x2048",
    "3840x2160",
    "2160x3840",
]


def generate_gpt_image(
    prompt: str,
    output_path: str,
    model: str = "gpt-image-2.5-sunburst",
    size: str = "auto",
    quality: str = "high",
    n: int = 1,
    output_format: str = "png",
    output_compression: int | None = None,
    moderation: str = "auto",
    background: str | None = None,
) -> None:
    """Generate one or more images using gpt-image-2.5-sunburst or specified model."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY environment variable not set")

    client = OpenAI(api_key=api_key)

    kwargs = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "quality": quality,
        "n": n,
        "output_format": output_format,
        "moderation": moderation,
    }
    if background is not None:
        kwargs["background"] = background
    if output_compression is not None and output_format in {"jpeg", "webp"}:
        kwargs["output_compression"] = output_compression

    print(f"Model:      {model}")
    print(f"Size:       {size}")
    print(f"Quality:    {quality}")
    print(f"Format:     {output_format}")
    if background is not None:
        print(f"Background: {background}")
    print(f"Count:      {n}")
    print(f"Prompt:     {prompt[:120]}{'...' if len(prompt) > 120 else ''}")
    print()
    print("Generating image...")

    result = client.images.generate(**kwargs)

    out = Path(output_path)
    for i, item in enumerate(result.data):
        if n == 1:
            target = out
        else:
            target = out.with_name(f"{out.stem}_{i + 1}{out.suffix}")
        target.write_bytes(base64.b64decode(item.b64_json))
        print(f"Saved: {target}")

    if getattr(result, "usage", None):
        print(f"Usage: {result.usage}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using OpenAI gpt-image-2.5-sunburst (or gpt-image-2.5-flare)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("prompt", help="Text prompt describing the image")
    parser.add_argument("output", help="Output file path (e.g., output.png)")
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
        help=(
            "Image size WxH (default: auto). Popular: "
            + ", ".join(POPULAR_SIZES)
            + ". Custom sizes allowed: max edge ≤3840, multiples of 16, aspect ≤3:1."
        ),
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
        "--count",
        "-n",
        type=int,
        default=1,
        help="Number of images to generate (default: 1; suffixes _1, _2, ... when >1)",
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
        "--moderation",
        default="auto",
        choices=VALID_MODERATION,
        help="Moderation strictness (default: auto)",
    )

    args = parser.parse_args()

    try:
        generate_gpt_image(
            prompt=args.prompt,
            output_path=args.output,
            model=args.model,
            size=args.size,
            quality=args.quality,
            n=args.count,
            output_format=args.format,
            output_compression=args.compression,
            moderation=args.moderation,
            background=args.background,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
