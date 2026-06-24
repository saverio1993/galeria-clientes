"""Genera imágenes demo para probar la galería sin fotos reales.

Útil para previsualizar el diseño antes de tener fotos de verdad.

Uso:
    py -3 scripts/demo-imgs.py
"""
from PIL import Image, ImageDraw, ImageFont
import os
import random

OUT = r"C:\Users\saverio\Desktop\academia-jrubio\galeria-fotos\images"
os.makedirs(OUT, exist_ok=True)
random.seed(42)
COLORS = [
    (255, 99, 99), (99, 255, 99), (99, 99, 255), (255, 200, 99),
    (255, 99, 200), (99, 255, 200), (200, 99, 255), (180, 180, 100),
]


def get_font(size):
    for cand in ["arial.ttf", "C:\\Windows\\Fonts\\arial.ttf", "C:\\Windows\\Fonts\\segoeui.ttf"]:
        try:
            return ImageFont.truetype(cand, size)
        except Exception:
            continue
    return ImageFont.load_default()


def main():
    for i in range(1, 9):
        w, h = 1200, 1500
        img = Image.new("RGB", (w, h), COLORS[i - 1])
        d = ImageDraw.Draw(img)
        for y in range(h):
            t = y / h
            r = int(COLORS[i - 1][0] * (1 - t * 0.4) + 20)
            g = int(COLORS[i - 1][1] * (1 - t * 0.4) + 20)
            b = int(COLORS[i - 1][2] * (1 - t * 0.4) + 20)
            d.line([(0, y), (w, y)], fill=(r, g, b))
        label = f"DEMO {i:02d}"
        font = get_font(180)
        bbox = d.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text(((w - tw) // 2, (h - th) // 2 - 60), label, fill=(255, 255, 255), font=font)
        sub = "1200 x 1500   ·   f/2.8   ·   ISO 400"
        sub_font = get_font(48)
        sb = d.textbbox((0, 0), sub, font=sub_font)
        sw = sb[2] - sb[0]
        d.text(((w - sw) // 2, (h - th) // 2 + 160), sub, fill=(240, 240, 240), font=sub_font)
        out_path = os.path.join(OUT, f"demo-{i:02d}.jpg")
        img.save(out_path, "JPEG", quality=82, optimize=True, progressive=True)
        print(f"  {out_path}")

    imgs = sorted(f for f in os.listdir(OUT) if f.endswith(".jpg"))
    manifest = os.path.join(OUT, "manifest.json")
    with open(manifest, "w", encoding="utf-8") as f:
        f.write("{\n  \"images\": [\n    " + ",\n    ".join(f'"{n}"' for n in imgs) + "\n  ]\n}\n")
    print(f"manifest.json con {len(imgs)} imagenes -> {manifest}")
    print()
    print("Para regenerar con tus fotos reales:")
    print("  1. Borra estos demo o déjalos (el script convertir.py los borra solo)")
    print("  2. Pon tus ARW/JPG en images-origen/")
    print("  3. Ejecuta:  py -3 scripts/convertir.py")


if __name__ == "__main__":
    main()
