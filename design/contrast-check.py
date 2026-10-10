"""WCAG AA contrast check for the E-learning design tokens.

Token values are the ones in docs/UX_PLAN.md section 1.2 (the owning document
for design tokens). The pair list mirrors UX_PLAN.md section 8.1 plus the
"on-*-subtle" text pairs that section 1.2 defines but 8.1 does not spell out.

Run:  py -3 design/contrast-check.py
Exits non-zero if any token pair drops below its threshold.
Thresholds: 4.5 = body text (WCAG 1.4.3), 3.0 = UI component boundary /
large text (WCAG 1.4.11, 1.4.3 large).

Colors may be written as "#RRGGBB" or as "rgba(r,g,b,a) over #RRGGBB" —
alpha colors are composited over their stated backdrop before the ratio is
computed, which is what the browser actually paints.
"""
import re
import sys

_RGBA = re.compile(
    r"rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)\s*over\s*(#[0-9A-Fa-f]{6})"
)


def _channels(color: str):
    """Return (r, g, b) 0-255 for a hex color or a composited rgba() string."""
    m = _RGBA.match(color.strip())
    if m:
        r, g, b, a = int(m[1]), int(m[2]), int(m[3]), float(m[4])
        br, bg, bb = _channels(m[5])
        return (
            a * r + (1 - a) * br,
            a * g + (1 - a) * bg,
            a * b + (1 - a) * bb,
        )
    h = color.lstrip("#")
    return tuple(float(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def _srgb(c: float) -> float:
    x = c / 255.0
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4


def luminance(color: str) -> float:
    r, g, b = _channels(color)
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def ratio(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


# (label, foreground, background, minimum ratio)
PAIRS = [
    # ---- light: surfaces & text ----
    ("L  foreground / background",            "#0F172A", "#F8FAFC", 4.5),
    ("L  foreground / card",                  "#0F172A", "#FFFFFF", 4.5),
    ("L  muted-foreground / background",      "#64748B", "#F8FAFC", 4.5),
    ("L  muted-foreground / card",            "#64748B", "#FFFFFF", 4.5),
    ("L  muted-foreground-strong / muted",    "#475569", "#F1F5F9", 4.5),
    # ---- light: brand & action ----
    ("L  primary-foreground / primary-strong", "#FFFFFF", "#0F766E", 4.5),
    ("L  primary-text / card",                "#0F766E", "#FFFFFF", 4.5),
    ("L  primary-text / background",          "#0F766E", "#F8FAFC", 4.5),
    ("L  on-primary-subtle / primary-subtle", "#0F766E", "#CCFBF1", 4.5),
    ("L  accent-foreground / accent",         "#431407", "#D97706", 4.5),
    # ---- light: semantic status ----
    ("L  destructive / card",                 "#DC2626", "#FFFFFF", 4.5),
    ("L  destructive-foreground / destructive", "#FFFFFF", "#DC2626", 4.5),
    ("L  on-destructive-subtle / destr-subtle", "#991B1B", "#FEE2E2", 4.5),
    ("L  success / card",                     "#15803D", "#FFFFFF", 4.5),
    ("L  on-success-subtle / success-subtle", "#166534", "#DCFCE7", 4.5),
    ("L  on-warning-subtle / warning-subtle", "#B45309", "#FEF3C7", 4.5),
    ("L  on-info-subtle / info-subtle",       "#075985", "#E0F2FE", 4.5),
    ("L  on-accent-subtle / accent-subtle",   "#431407", "#FEF3C7", 4.5),
    # ---- light: UI boundaries (3:1) ----
    ("L  ring / background",                  "#0D9488", "#F8FAFC", 3.0),
    ("L  input / card",                       "#64748B", "#FFFFFF", 3.0),
    ("L  input / background",                 "#64748B", "#F8FAFC", 3.0),
    ("L  accent star icon / card",            "#D97706", "#FFFFFF", 3.0),
    ("L  primary / background",               "#0D9488", "#F8FAFC", 3.0),
    # ---- light: pairs found rendered in the T4.13 sweep ----
    ("L  foreground / muted",                 "#0F172A", "#F1F5F9", 4.5),
    ("L  muted-foreground-strong / card",     "#475569", "#FFFFFF", 4.5),
    ("L  destructive (required *) / background", "#DC2626", "#F8FAFC", 4.5),
    ("L  foreground / current lesson row",
     "#0F172A", "rgba(204,251,241,0.6) over #FFFFFF", 4.5),
    ("L  muted-fg-strong / current lesson row",
     "#475569", "rgba(204,251,241,0.6) over #FFFFFF", 4.5),
    ("L  primary-text icon / current lesson row",
     "#0F766E", "rgba(204,251,241,0.6) over #FFFFFF", 3.0),
    # ---- light: hover states of solid buttons ----
    ("L  primary-foreground / primary-hover", "#FFFFFF", "#115E59", 4.5),
    ("L  accent-foreground / accent-hover",   "#431407", "#F59E0B", 4.5),
    ("L  destructive-fg / destructive-hover", "#FFFFFF", "#B91C1C", 4.5),
    # ---- video player chrome: bg-foreground (#0F172A) ----
    ("P  primary-foreground / foreground",    "#FFFFFF", "#0F172A", 4.5),
    ("P  white 80% / foreground",
     "rgba(255,255,255,0.8) over #0F172A", "#0F172A", 4.5),
    ("P  secondary (pressed, seek fill) / fg", "#2DD4BF", "#0F172A", 3.0),
    ("P  ring / foreground",                  "#0D9488", "#0F172A", 3.0),
    ("P  white 40% (seek track, select) / fg",
     "rgba(255,255,255,0.4) over #0F172A", "#0F172A", 3.0),
]

# Pairs UX_PLAN.md section 8.1 forbids. The script asserts they really do fail,
# so nobody "fixes" the palette back into them without the check going red.
FORBIDDEN = [
    ("white on primary (use primary-strong)",       "#FFFFFF", "#0D9488", 4.5),
    ("white on accent (use accent-foreground)",     "#FFFFFF", "#D97706", 4.5),
    ("secondary as text on card (use primary-text)", "#2DD4BF", "#FFFFFF", 4.5),
    # Fixed in T4.13; listed so they do not come back.
    ("accent-foreground on #B45309 (old accent-hover)", "#431407", "#B45309", 4.5),
    ("muted-foreground on current lesson row (use -strong)",
     "#64748B", "rgba(204,251,241,0.6) over #FFFFFF", 4.5),
    ("white 30% player border/track (use 40%)",
     "rgba(255,255,255,0.3) over #0F172A", "#0F172A", 3.0),
]


def main() -> int:
    failures = []
    for label, fg, bg, need in PAIRS:
        r = ratio(fg, bg)
        ok = r >= need
        if not ok:
            failures.append((label, fg, bg, r, need))
        print(f"{'PASS' if ok else 'FAIL'}  {r:5.2f}:1  (>={need})  {label:42s}")
    print(f"\n{len(PAIRS) - len(failures)}/{len(PAIRS)} pass")

    print("\nForbidden pairs (must stay below threshold):")
    for label, fg, bg, need in FORBIDDEN:
        r = ratio(fg, bg)
        ok = r < need
        if not ok:
            failures.append((label, fg, bg, r, need))
        print(f"{'OK  ' if ok else 'BAD '}  {r:5.2f}:1  (<{need})   {label}")

    for label, fg, bg, r, need in failures:
        print(f"  FAIL {label}: {fg} on {bg} is {r:.2f}:1, needs {need}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
