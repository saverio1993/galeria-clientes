"""
Recomprime todas las JPGs de images/ con calidad 92 y max-width 3200,
luego las sube de vuelta al repo via GitHub Contents API.

Uso:
    py -3 scripts/recompress_and_upload.py --token ghp_xxx
"""
import argparse
import base64
import io
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

try:
    from PIL import Image
except ImportError:
    print("[ERROR] Falta Pillow. pip install Pillow", file=sys.stderr)
    sys.exit(1)


REPO = "saverio1993/galeria-clientes"
BRANCH = "main"
API = f"https://api.github.com/repos/{REPO}"
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/images"
QUALITY = 92
MAX_WIDTH = 3200


def api(method, path, token, body=None):
    url = path if path.startswith("http") else API + path
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mavis-recompress",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[HTTP {e.code}] {method} {path}: {body[:300]}", file=sys.stderr)
        raise


def list_images(token):
    """Lista SOLO archivos JPG/JPEG."""
    data = api("GET", f"/contents/images?ref={BRANCH}&per_page=100", token)
    return [
        f for f in data
        if f["type"] == "file" and f["name"].lower().endswith((".jpg", ".jpeg"))
    ]


def download(name):
    url = f"{RAW}/{urllib.parse.quote(name)}"
    with urllib.request.urlopen(url) as r:
        return r.read()


def compress(raw_bytes):
    img = Image.open(io.BytesIO(raw_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    if w > MAX_WIDTH:
        ratio = MAX_WIDTH / w
        new_size = (MAX_WIDTH, int(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)
        print(f"    resize {w}x{h} -> {new_size[0]}x{new_size[1]}")
    else:
        print(f"    no resize ({w}x{h} ya <= {MAX_WIDTH})")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


def upload(name, data, sha, token):
    body = {
        "message": f"admin: recomprimir {name} a q{QUALITY} max{MAX_WIDTH}",
        "content": base64.b64encode(data).decode(),
        "branch": BRANCH,
        "sha": sha,
    }
    return api("PUT", f"/contents/images/{urllib.parse.quote(name)}", token, body)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--token", required=True)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    images = list_images(args.token)
    print(f"[INFO] {len(images)} JPGs encontradas en images/")

    saved_bytes = 0
    for meta in images:
        name = meta["name"]
        print(f"\n[FETCH] {name} ({meta['size']:,} bytes)")
        raw = download(name)
        print(f"    downloaded {len(raw):,} bytes")
        compressed = compress(raw)
        delta = len(raw) - len(compressed)
        saved_bytes += delta
        print(f"    compressed {len(compressed):,} bytes (saved {delta:,} = {delta / len(raw) * 100:.0f}%)")
        if args.dry_run:
            print("    [DRY RUN] no se sube")
            continue
        upload(name, compressed, meta["sha"], args.token)
        print(f"    uploaded OK")

    print(f"\n[OK] Total saved: {saved_bytes:,} bytes ({saved_bytes / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
