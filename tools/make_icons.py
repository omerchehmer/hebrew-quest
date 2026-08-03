#!/usr/bin/env python3
"""מייצר את אייקוני האפליקציה כ-PNG בלי תלות בספריות חיצוניות.
הרצה:  python3 tools/make_icons.py
"""
import struct, zlib, os

ART = [
    "................",
    "................",
    "......GGGG......",
    ".....GTTTTG.....",
    "....GTTTTTTG....",
    "...GTTTTTTTTG...",
    "...GtTTTTTTtG...",
    "....GtTTTTtG....",
    ".....GtTTtG.....",
    "......GttG......",
    ".......GG.......",
    "................",
    "..W....W.....W..",
    "................",
    "................",
    "................",
]

PALETTE = {
    ".": (0x12, 0x16, 0x1F),
    "T": (0x2D, 0xD4, 0xA8),
    "t": (0x17, 0x9E, 0x7C),
    "G": (0xF5, 0xA5, 0x24),
    "W": (0xE9, 0xEE, 0xFB),
}


def render(size):
    n = len(ART)
    scale = size // n
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter byte
        ay = min(y // scale, n - 1)
        for x in range(size):
            ax = min(x // scale, n - 1)
            r, g, b = PALETTE[ART[ay][ax]]
            row += bytes((r, g, b, 255))
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, size):
    raw = render(size)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print(f"{path}  ({size}×{size}, {len(png)} bytes)")


if __name__ == "__main__":
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, "assets")
    os.makedirs(out, exist_ok=True)
    for s in (180, 192, 512):
        write_png(os.path.join(out, f"icon-{s}.png"), s)
