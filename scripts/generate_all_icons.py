import colorsys
import os
import shutil
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
ICONS_DIR = BASE_DIR / "icons"
RES_DIR = BASE_DIR / "android-build" / "res"
RES_PLAYERS_DIR = BASE_DIR / "android-build" / "res_players"

orig_path = ICONS_DIR / "icon-512.png"
if not orig_path.exists():
    orig_path = ICONS_DIR / "icon-192.png"

im = Image.open(orig_path).convert("RGBA")
w, h = im.size

def transform_to_yellow(src_im):
    out = Image.new("RGBA", (w, h))
    pin = src_im.load()
    pout = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pin[x, y]
            if a == 0:
                pout[x, y] = (r, g, b, 0)
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hue, sat, val = colorsys.rgb_to_hsv(rf, gf, bf)
            if 0.18 <= hue <= 0.54 and sat > 0.25 and val > 0.20:
                t = (hue - 0.18) / (0.54 - 0.18)
                new_hue = 0.11 + t * 0.045
                new_sat = min(1.0, sat * 1.05)
                new_val = min(1.0, val * 1.02)
                nr, ng, nb = colorsys.hsv_to_rgb(new_hue, new_sat, new_val)
                pout[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
            else:
                pout[x, y] = (r, g, b, a)
    return out

def transform_to_blue(src_im):
    out = Image.new("RGBA", (w, h))
    pin = src_im.load()
    pout = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pin[x, y]
            if a == 0:
                pout[x, y] = (r, g, b, 0)
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hue, sat, val = colorsys.rgb_to_hsv(rf, gf, bf)
            if 0.18 <= hue <= 0.54 and sat > 0.25 and val > 0.20:
                t = (hue - 0.18) / (0.54 - 0.18)
                new_hue = 0.62 - t * 0.06
                new_sat = min(1.0, sat * 1.0)
                new_val = min(1.0, val * 1.0)
                nr, ng, nb = colorsys.hsv_to_rgb(new_hue, new_sat, new_val)
                pout[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
            else:
                pout[x, y] = (r, g, b, a)
    return out

yellow_192 = transform_to_yellow(im)
yellow_512 = yellow_192.resize((512, 512), Image.Resampling.LANCZOS)

blue_192 = transform_to_blue(im)
blue_512 = blue_192.resize((512, 512), Image.Resampling.LANCZOS)

# Save tracker yellow icons
yellow_192.save(ICONS_DIR / "icon-tracker-192.png", "PNG")
yellow_512.save(ICONS_DIR / "icon-tracker-512.png", "PNG")
yellow_192.save(ICONS_DIR / "icon-tracker.png", "PNG")
print("Saved tracker yellow icons.")

# Save player blue icons
blue_192.save(ICONS_DIR / "icon-player-192.png", "PNG")
blue_512.save(ICONS_DIR / "icon-player-512.png", "PNG")
blue_192.save(ICONS_DIR / "icon-player.png", "PNG")
print("Saved player blue icons.")

# Prepare android-build/res_players
if RES_PLAYERS_DIR.exists():
    shutil.rmtree(RES_PLAYERS_DIR)
shutil.copytree(RES_DIR, RES_PLAYERS_DIR)

# Densities for Android
densities = {
    "drawable": (192, 192),
    "mipmap-mdpi": (48, 48),
    "mipmap-hdpi": (72, 72),
    "mipmap-xhdpi": (96, 96),
    "mipmap-xxhdpi": (144, 144),
    "mipmap-xxxhdpi": (192, 192),
}

for folder, (size_w, size_h) in densities.items():
    target_dir = RES_PLAYERS_DIR / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    resized = blue_192.resize((size_w, size_h), Image.Resampling.LANCZOS)
    resized.save(target_dir / "ic_launcher.png", "PNG")
    if folder.startswith("mipmap"):
        resized.save(target_dir / "ic_launcher_round.png", "PNG")

print("Created android-build/res_players with blue icons.")
