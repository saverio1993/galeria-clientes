#!/usr/bin/env python3
"""
Convierte imágenes ARW (Sony RAW) y JPG/JPEG a JPG optimizado para web.

Uso:
    py -3 scripts/convertir.py                       # convierte todo en images-origen/
    py -3 scripts/convertir.py --input mi-carpeta    # convierte desde otra carpeta
    py -3 scripts/convertir.py --quality 85          # calidad JPG (1-100, default 88)

Salida:
    images/  (las JPGs listas para subir a GitHub Pages)

Requisitos:
    pip install rawpy Pillow
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    import rawpy
except ImportError:
    print("[ERROR] Falta rawpy. Instala con:  pip install rawpy", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("[ERROR] Falta Pillow. Instala con:  pip install Pillow", file=sys.stderr)
    sys.exit(1)

RAW_EXTENSIONS = {".arw", ".cr2", ".cr3", ".nef", ".dng", ".raf", ".orf"}
JPG_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
ALL_EXTENSIONS = RAW_EXTENSIONS | JPG_EXTENSIONS


def convert_raw(src: Path, dest: Path, quality: int) -> None:
    """Convierte un archivo RAW a JPG usando rawpy."""
    with rawpy.imread(str(src)) as raw:
        # postprocess usa ajustes por defecto de dcraw (balance, exposición)
        rgb = raw.postprocess(
            use_camera_wb=True,
            no_auto_bright=False,
            output_bps=8,
        )
    image = Image.fromarray(rgb)
    convert_in_place(image, dest, quality)


def normalize_jpg(src: Path, dest: Path, quality: int) -> None:
    """Normaliza un JPG/PNG/WEB ya existente a JPG optimizado."""
    image = Image.open(src)
    if image.mode in ("RGBA", "LA", "P"):
        # JPG no soporta alfa → fondo blanco
        bg = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode == "P":
            image = image.convert("RGBA")
        bg.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
        image = bg
    elif image.mode != "RGB":
        image = image.convert("RGB")
    convert_in_place(image, dest, quality)


def convert_in_place(image: Image.Image, dest: Path, quality: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # optimize=True + progressive mejora el tamaño final para web
    image.save(
        dest,
            "JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Convierte ARW/RAW/JPG → JPG web")
    parser.add_argument(
        "--input",
        "-i",
        default="images-origen",
        help="Carpeta con las imágenes originales (default: images-origen)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="images",
        help="Carpeta de salida (default: images)",
    )
    parser.add_argument(
        "--quality",
        "-q",
        type=int,
        default=92,
        help="Calidad JPG 1-100 (default: 92 — alta, casi imperceptible)",
    )
    parser.add_argument(
        "--max-width",
        type=int,
        default=3200,
        help="Ancho máximo en píxeles (default: 3200, escalado si es mayor)",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    src_dir = (root / args.input).resolve() if not Path(args.input).is_absolute() else Path(args.input)
    out_dir = (root / args.output).resolve() if not Path(args.output).is_absolute() else Path(args.output)

    if not src_dir.exists():
        print(f"[ERROR] No existe la carpeta: {src_dir}", file=sys.stderr)
        return 1

    files = [p for p in src_dir.iterdir() if p.is_file() and p.suffix.lower() in ALL_EXTENSIONS]
    if not files:
        print(f"[AVISO] No hay imágenes en {src_dir}")
        print(f"        Extensiones soportadas: {', '.join(sorted(ALL_EXTENSIONS))}")
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    # limpiar carpeta de salida para evitar archivos viejos
    for old in out_dir.iterdir():
        if old.is_file():
            old.unlink()

    print(f"[INFO] {len(files)} imágenes encontradas en {src_dir}")
    print(f"[INFO] Salida: {out_dir}")
    print(f"[INFO] Calidad: {args.quality} | Ancho máx: {args.max_width}px")
    print()

    ok = 0
    fail = 0
    for i, src in enumerate(sorted(files), 1):
        # nombre estable basado en el nombre original (sin extensión)
        dest_name = src.stem + ".jpg"
        dest = out_dir / dest_name
        try:
            if src.suffix.lower() in RAW_EXTENSIONS:
                convert_raw(src, dest, args.quality)
            else:
                normalize_jpg(src, dest, args.quality)

            # escalar si excede max-width
            with Image.open(dest) as img:
                if img.width > args.max_width:
                    ratio = args.max_width / img.width
                    new_size = (args.max_width, int(img.height * ratio))
                    img2 = img.resize(new_size, Image.LANCZOS)
                    if img2.mode != "RGB":
                        img2 = img2.convert("RGB")
                    img2.save(dest, "JPEG", quality=args.quality, optimize=True, progressive=True)
                    print(f"  [{i}/{len(files)}] {src.name} → {dest_name}  (escalado a {new_size[0]}x{new_size[1]})")
                else:
                    print(f"  [{i}/{len(files)}] {src.name} → {dest_name}  ({img.width}x{img.height})")
            ok += 1
        except Exception as e:
            print(f"  [{i}/{len(files)}] {src.name} → [FALLO] {e}", file=sys.stderr)
            fail += 1

    # Generar manifest.json con la lista de imágenes (lo lee la galería)
    manifest = out_dir / "manifest.json"
    images_list = sorted([p.name for p in out_dir.iterdir() if p.suffix.lower() == ".jpg"])
    manifest.write_text(
        '{\n  "images": [\n    '
        + ',\n    '.join(f'"{name}"' for name in images_list)
        + '\n  ]\n}\n',
        encoding="utf-8",
    )
    print()
    print(f"[OK] {ok} convertidas | {fail} fallidas | manifest.json con {len(images_list)} entradas")
    print()
    print("Próximo paso:")
    print(f"  1. Revisa las JPGs en {out_dir}")
    print("  2. git add images/ && git commit -m 'agregar galería' && git push")
    print("  3. GitHub Pages servirá la galería automáticamente")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
