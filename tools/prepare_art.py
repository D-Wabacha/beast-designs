"""Turns the raw card artwork (WhatsApp exports) into the 2:3 backgrounds used by image templates.

Each source image is cropped, padded to 2:3 with a soft blurred extension where cropping alone
would cut off part of the design, cleaned of any sample text baked into the artwork, and saved
as assets/templates/<id>.jpg at 1000 × 1500 px.

    python3 tools/prepare_art.py "/path/to/unzipped/images"

Needs Pillow (pip install pillow). Only used when adding or changing artwork, never by the site.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT_W, OUT_H = 1000, 1500
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "templates"

# id -> (source file, crop box as fractions (left, top, right, bottom), clean-ups)
# Clean-ups: ("rect", l, t, r, b[, "v"]) blends sample text away using the colours around it;
# ("ellipse", cx, cy, rx, ry, colour) fills a photo placeholder. All in fractions of the source.
ART = {
    "success-laurel": ("WhatsApp Image 2026-10- at 20.52.20.jpeg", (0, 0.03, 1, 0.99), []),
    "success-graduate": ("WhatsApp Image 2026-10-27 at 20.518.jpeg", (0, 0.02, 1, 0.99), [("rect", 0.27, 0.118, 0.76, 0.162)]),
    "success-trophy": ("WhatsApp Image 2026-10-27 at 20.52.15.jpeg", (0, 0.07, 1, 0.985), []),
    "success-stairs": ("WhatsApp Image 2026-10-27 at 20.52.16.jpeg", (0, 0, 1, 1), []),
    "besties-4-ever": ("WhatsApp Image 2026-10-27 at 20.52.18.jpeg", (0, 0.02, 1, 0.84), []),
    "birthday-my-king": ("WhatsApp Image 2026-10-27 at 20.52.19.jpeg", (0, 0.13, 1, 0.985), []),
    "love-gilded-frame": ("WhatsApp Image 2026-10-27 at 20.52.8.jpeg", (0, 0.02, 1, 0.95), []),
    "anniversary-rose-parchment": ("WhatsApp Image 2026-10-27 at 202.19.jpeg", (0, 0.03, 1, 0.975), []),
    "thank-you-tulips": ("WhatsApp Image 2026-10-27 at 22.04.57.jpeg", (0, 0.03, 1, 0.99), [("rect", 0.5, 0.33, 0.95, 0.415)]),
    "anniversary-golden-scroll": ("WhatsApp Image 2026-10-27 at 22.50.16.jpeg", (0, 0.04, 1, 0.96), []),
    "black-gold-celebration": ("WhatsApp Image 2026-10-27 at 22.50.17rr.jpeg", (0, 0.06, 1, 0.94), []),
    "neon-rose-frame": ("WhatsApp Image 2026-10-27 at 22.50.18.jpeg", (0, 0.03, 1, 0.95), []),
    "royal-blue-envelope": ("WhatsApp Image 2026-10-27 at 22.50.18rrr.jpeg", (0, 0.03, 1, 0.93), []),
    "emerald-pearl-blooms": ("WhatsApp Image 2026-10-27 at 22.50.19.jpeg", (0, 0.02, 0.88, 0.98), []),
    "birthday-gold-splash": ("WhatsApp Image 2026-10-27 at 22.50.52.jpeg", (0, 0, 1, 1), []),
    "birthday-black-cake": ("WhatsApp Image 2026-10-27 at 22.50.53.jpeg", (0, 0.04, 1, 1), []),
    "midnight-gifts": ("WhatsApp Image 2026-10-27 at 22.50.53fff.jpeg", (0, 0.02, 1, 0.98),
                       [("ellipse", 0.265, 0.151, 0.196, 0.111, "#0b1220")]),
    "calla-lily-black": ("WhatsApp Image 2026-10-27 at 22.50.54.jpeg", (0, 0.06, 1, 0.93), []),
    "pink-noir-butterflies": ("WhatsApp Image 2026-10-27 at 22.50.54frf.jpeg", (0, 0.05, 1, 0.95), []),
    "noir-emerald-blooms": ("WhatsApp Image 2026-10-27 at 22.50.55.jpeg", (0, 0, 1, 1), []),
    "winter-frost": ("WhatsApp Image 2026-10-27 at 22.50.56.jpeg", (0, 0.04, 1, 0.97), []),
    "graduation-cap-blooms": ("WhatsApp Image 2026-10-27 at 22.50.56nn.jpeg", (0, 0.03, 1, 0.98), []),
    "super-mom": ("WhatsApp Image 2026-10-27 at 22.52.06.jpeg", (0.04, 0, 0.96, 1), []),
    "rose-heart": ("WhatsApp Image 2026-10-27 at 22.52.07.jpeg", (0, 0.05, 1, 0.95), []),
    "butterfly-roses": ("WhatsApp Image 2026-10-27 at 22.52.07mn.jpeg", (0, 0.04, 1, 0.96), []),
    "gentlemans-watch": ("WhatsApp Image 2026-10-27 at 22.52.08.jpeg", (0.03, 0.075, 0.97, 0.82), []),
    "best-dad-ever": ("WhatsApp Image 2026-10-27 at 22.52.08k.jpeg", (0, 0, 1, 1), []),
    "emerald-silver-balloons": ("WhatsApp Image 2026-10-27 at 22.52.08km.jpeg", (0, 0.08, 1, 0.92), []),
    "royal-navy-crown": ("WhatsApp Image 2026-10-27 at 22.52.09km.jpeg", (0, 0.02, 1, 0.98), []),
    "mothers-day-watercolour": ("WhatsApp Image 2026-10-27 at 22.52.10.jpeg", (0, 0.03, 1, 0.97), []),
    "violet-butterfly-wreath": ("WhatsApp Image 2026-10-27 at 22.53.08.jpeg", (0, 0, 1, 1), []),
    "besties-blush": ("WhatsApp Image 2026-10-27 at 22.53.08m.jpeg", (0, 0.02, 1, 1), []),
    "rose-scroll": ("WhatsApp Image 2026-10-27 at 22.53.09.jpeg", (0, 0, 1, 1), []),
    "lilac-letter": ("WhatsApp Image 2026-10-27 at 22.53.09kk.jpeg", (0.055, 0, 0.945, 1), []),
    "lavender-tag": ("WhatsApp Image 2026-10-27 at 22.53.10.jpeg", (0, 0, 1, 1), []),
    "sunflower-ribbon": ("WhatsApp Image 2026-10-27 at 22.53.10jkj.jpeg", (0, 0, 1, 1), []),
    "sunflower-lace": ("WhatsApp Image 2026-10-27 at 22.53.10lm.jpeg", (0, 0, 1, 1), []),
    "festive-parchment": ("WhatsApp Image 2026-10-27 at 22.53.11.jpeg", (0, 0.03, 1, 0.97), []),
    "baroque-rose-bow": ("WhatsApp Image 2026-10-27 at 22.53.11mkm.jpeg", (0, 0.03, 1, 0.97), []),
    "violet-satin-roses": ("WhatsApp Image 2026-10-27 at 22.53.12.jpeg", (0, 0, 1, 1), []),
    "memorial-candles": ("WhatsApp Image 2026-10-27 at 22.55.21.jpeg", (0, 0.035, 1, 0.965),
                         [("rect", 0.08, 0.575, 0.92, 0.715, "v"), ("rect", 0.25, 0.70, 0.75, 0.795, "v"), ("ellipse", 0.5, 0.354, 0.252, 0.182, "#262626")]),
    "easter-lily-wreath": ("WhatsApp Image 2026-10-27 at 22.55.22.jpeg", (0, 0.075, 1, 0.92), []),
    "guitar-sunset-letter": ("WhatsApp Image 2026-10-27 at 22.55.23,l.jpeg", (0, 0, 1, 1), []),
    "guitar-melody": ("WhatsApp Image 2026-10-27 at 22.55.24.jpeg", (0, 0.02, 1, 0.98), []),
    "vintage-hearts": ("WhatsApp Image 2026-10-27 at 22.55.25.jpeg", (0, 0.02, 1, 0.98), []),
    "paper-roses-noir": ("WhatsApp Image 2026-10-27 at 22.55.26.jpeg", (0, 0, 1, 1), []),
    "anniversary-ruby-frame": ("WhatsApp Image 2026-10-27 at 2cr2.50.17.jpeg", (0.06, 0, 0.94, 1), []),
    "wedding-emerald": ("WhatsApp Image 2026-10-27 atc 22.04.56.jpeg", (0, 0, 1, 1), [("rect", 0.12, 0.745, 0.86, 0.885, "v")]),
    "wedding-crimson": ("WhatsApp Image 2026-10-27 frat 22.04.57.jpeg", (0, 0, 1, 1), [("rect", 0.14, 0.745, 0.86, 0.885, "v")]),
    "race-day": ("WhatsApp Image 2026-10-27 at 22.53.12mml.jpeg", (0, 0.03, 1, 0.97), []),
    "porsche-drive-letter": ("WhatsApp Image 2026-10-27 at 22.55.24mkm.jpeg", (0, 0, 1, 1), []),
    "anniversary-sapphire-scroll": ("WhatsApp Image 2026-10cr-27 at 22.50.16.jpeg", (0, 0.04, 1, 0.96), []),
}


def erase_rect(im, l, t, r, b, mode="hv"):
    """Replace a rectangle with a smooth blend of the pixels just outside it, plus a little grain.
    mode "v" blends only between the rows above and below (use when the sides touch other artwork)."""
    W, H = im.size
    box = (round(l * W), round(t * H), round(r * W), round(b * H))
    w, h = box[2] - box[0], box[3] - box[1]
    m = 6

    def strip(region, size):
        # Average the strip just outside the box, then smooth it along its length so the fill
        # becomes a soft gradient instead of streaks.
        small = im.crop(region).resize(size, Image.BOX)
        coarse = small.resize((max(1, size[0] // 24), max(1, size[1] // 24)), Image.BOX)
        return coarse.resize(size, Image.BILINEAR).load()

    lp = strip((box[0] - m, box[1], box[0], box[3]), (1, h))
    rp = strip((box[2], box[1], box[2] + m, box[3]), (1, h))
    tp = strip((box[0], box[1] - m, box[2], box[1]), (w, 1))
    bp = strip((box[0], box[3], box[2], box[3] + m), (w, 1))
    horiz = Image.new("RGB", (w, h))
    vert = Image.new("RGB", (w, h))
    hp, vp = horiz.load(), vert.load()
    for y in range(h):
        for x in range(w):
            a, c = x / max(1, w - 1), y / max(1, h - 1)
            hp[x, y] = tuple(round(lp[0, y][i] * (1 - a) + rp[0, y][i] * a) for i in range(3))
            vp[x, y] = tuple(round(tp[x, 0][i] * (1 - c) + bp[x, 0][i] * c) for i in range(3))
    patch = (vert if mode == "v" else Image.blend(horiz, vert, 0.5)).filter(ImageFilter.GaussianBlur(6))
    grain = Image.effect_noise((w, h), 10).convert("RGB")
    patch = Image.blend(patch, ImageChops.overlay(patch, grain), 0.25)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rectangle((8, 8, w - 9, h - 9), fill=255)
    im.paste(patch, box[:2], mask.filter(ImageFilter.GaussianBlur(6)))


def fill_ellipse(im, cx, cy, rx, ry, colour):
    """Covers a transparent-checkerboard photo placeholder with a soft vignette."""
    W, H = im.size
    box = (round((cx - rx) * W), round((cy - ry) * H), round((cx + rx) * W), round((cy + ry) * H))
    w, h = box[2] - box[0], box[3] - box[1]
    base = Image.new("RGB", (w, h), colour)
    light = Image.new("L", (w, h), 0)
    ImageDraw.Draw(light).ellipse((w * 0.2, h * 0.15, w * 0.8, h * 0.75), fill=40)
    base.paste(Image.new("RGB", (w, h), "#ffffff"), (0, 0), light.filter(ImageFilter.GaussianBlur(w / 6)))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, w - 1, h - 1), fill=255)
    im.paste(base, box[:2], mask.filter(ImageFilter.GaussianBlur(2)))


def fit_two_by_three(im):
    """Pads the short side with a blurred, feathered extension of the image itself."""
    W, H = im.size
    if abs(H / W - 1.5) < 0.004:
        return im.resize((OUT_W, OUT_H), Image.LANCZOS)
    tw, th = (round(H / 1.5), H) if H / W > 1.5 else (W, round(W * 1.5))
    scale = max(tw / W, th / H)
    bg = im.resize((round(W * scale) + 2, round(H * scale) + 2), Image.LANCZOS)
    bg = bg.crop(((bg.width - tw) // 2, (bg.height - th) // 2, (bg.width - tw) // 2 + tw, (bg.height - th) // 2 + th))
    bg = bg.filter(ImageFilter.GaussianBlur(max(tw, th) / 40))
    mask = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(mask)
    f = max(6, min(40, max(tw - W, th - H) // 2))
    for i in range(f):
        v = round(255 * (i + 1) / f)
        if tw > W:
            d.line((i, 0, i, H), fill=v); d.line((W - 1 - i, 0, W - 1 - i, H), fill=v)
        else:
            d.line((0, i, W, i), fill=v); d.line((0, H - 1 - i, W, H - 1 - i), fill=v)
    bg.paste(im, ((tw - W) // 2, (th - H) // 2), mask)
    return bg.resize((OUT_W, OUT_H), Image.LANCZOS)


def main(src_dir):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for art_id, (name, crop, fixes) in ART.items():
        im = Image.open(Path(src_dir) / name).convert("RGB")
        for fix in fixes:
            if fix[0] == "rect":
                erase_rect(im, *fix[1:])
            else:
                fill_ellipse(im, *fix[1:])
        W, H = im.size
        im = im.crop((round(crop[0] * W), round(crop[1] * H), round(crop[2] * W), round(crop[3] * H)))
        fit_two_by_three(im).save(OUT_DIR / f"{art_id}.jpg", quality=84, optimize=True, progressive=True)
        print("wrote", art_id)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
