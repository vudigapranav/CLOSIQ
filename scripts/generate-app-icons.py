"""
Generates the CLOSIQ app icons from the OFFICIAL logo (public/brand/closiq-logo.png).

The wide wordmark can't be an app icon (Apple/Google need a square), so the
icon is the brain-Q mark taken from that same artwork — cropped, not redrawn.
The mark is flat two-tone, so it is enlarged cleanly: its ink coverage is
upsampled and the edge re-sharpened with a smooth threshold, giving crisp
anti-aliased edges at 1024 px without changing the shape.

    python3 scripts/generate-app-icons.py

Writes:
  mobile/assets/app-icon.png               1024x1024, opaque (iOS + Expo icon)
  mobile/assets/adaptive-icon-foreground.png 1024x1024, transparent (Android)
  mobile/assets/adaptive-icon-monochrome.png 1024x1024, white mark (Android 13 themed)
  public/apple-touch-icon.png              180x180 (iPhone "Add to Home Screen")
  public/brand/closiq-app-icon-512.png     512x512 (web manifest / sharing)
  public/favicon-32.png                    32x32 (browser tab)
Requires Pillow.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, 'public', 'brand', 'closiq-logo.png')

INK = (42, 47, 53)        # the logo's own charcoal
IVORY = (247, 242, 233)   # app canvas, --color-bg (#F7F2E9)
SIZE = 1024


def find_q_box(gray):
    """Bounding box of the last ink glyph (the Q) in the wordmark."""
    w, h = gray.size
    px = gray.load()
    cols = [x for x in range(w) if any(px[x, y] < 120 for y in range(h))]
    start = prev = cols[0]
    runs = []
    for x in cols[1:]:
        if x != prev + 1:
            runs.append((start, prev))
            start = x
        prev = x
    runs.append((start, prev))
    x0, x1 = runs[-1]
    rows = [y for y in range(h) if any(px[x, y] < 120 for x in range(x0, x1 + 1))]
    return x0, min(rows), x1 + 1, max(rows) + 1


def ink_mask(gray, box, pad=6):
    """0-255 ink coverage of the Q, from the logo's own background/ink levels."""
    x0, y0, x1, y1 = box
    crop = gray.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    bg, ink = 244.0, 45.0
    return crop.point(lambda v: int(max(0.0, min(1.0, (bg - v) / (bg - ink))) * 255))


def enlarge(mask, height):
    """Upsample the coverage and re-sharpen the edge (smoothstep 0.4-0.6)."""
    w, h = mask.size
    width = round(w * height / h)
    big = mask.resize((width, height), Image.LANCZOS)

    def curve(v):
        t = max(0.0, min(1.0, (v / 255.0 - 0.4) / 0.2))
        return int(t * t * (3 - 2 * t) * 255)

    return big.point(curve)


def place(mask, canvas_size, fill, background):
    canvas = Image.new('RGBA', (canvas_size, canvas_size), background)
    layer = Image.new('RGBA', mask.size, fill + (255,))
    layer.putalpha(mask)
    canvas.alpha_composite(layer, ((canvas_size - mask.size[0]) // 2, (canvas_size - mask.size[1]) // 2))
    return canvas


def main():
    gray = Image.open(LOGO).convert('L')
    mask = ink_mask(gray, find_q_box(gray))

    # iOS / Expo icon: opaque, mark at ~60% of the tile (iOS rounds the corners).
    icon = place(enlarge(mask, 620), SIZE, INK, IVORY + (255,)).convert('RGB')
    icon.save(os.path.join(ROOT, 'mobile', 'assets', 'app-icon.png'))

    # Android adaptive: mark inside the 66% safe zone; background colour set in app.json.
    fg_mask = enlarge(mask, 470)
    place(fg_mask, SIZE, INK, (0, 0, 0, 0)).save(os.path.join(ROOT, 'mobile', 'assets', 'adaptive-icon-foreground.png'))
    place(fg_mask, SIZE, (255, 255, 255), (0, 0, 0, 0)).save(os.path.join(ROOT, 'mobile', 'assets', 'adaptive-icon-monochrome.png'))

    # Web.
    icon.resize((180, 180), Image.LANCZOS).save(os.path.join(ROOT, 'public', 'apple-touch-icon.png'))
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, 'public', 'brand', 'closiq-app-icon-512.png'))
    icon.resize((32, 32), Image.LANCZOS).save(os.path.join(ROOT, 'public', 'favicon-32.png'))
    print('App icons written.')


if __name__ == '__main__':
    main()
