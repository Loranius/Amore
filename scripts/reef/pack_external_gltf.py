#!/usr/bin/env python3
import json, mimetypes, struct, sys
from pathlib import Path
from urllib.parse import unquote

src = Path(sys.argv[1]).resolve()
dst = Path(sys.argv[2]).resolve()
root = src.parent
j = json.loads(src.read_text(encoding='utf-8'))
if len(j.get('buffers', [])) != 1 or 'uri' not in j['buffers'][0]:
    raise SystemExit('Expected one external glTF buffer')

buf_path = root / unquote(j['buffers'][0]['uri'])
out = bytearray(buf_path.read_bytes())
views = j.setdefault('bufferViews', [])

def align4():
    while len(out) % 4:
        out.append(0)

def mime_for(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if mime in {'image/png', 'image/jpeg', 'image/webp'}:
        return mime
    if path.suffix.lower() in {'.jpg', '.jpeg'}:
        return 'image/jpeg'
    if path.suffix.lower() == '.png':
        return 'image/png'
    if path.suffix.lower() == '.webp':
        return 'image/webp'
    raise ValueError(f'Unsupported image type: {path}')

for image in j.get('images', []):
    uri = image.pop('uri', None)
    if not uri:
        continue
    path = root / unquote(uri)
    payload = path.read_bytes()
    align4()
    offset = len(out)
    out.extend(payload)
    view = len(views)
    views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(payload)})
    image['bufferView'] = view
    image['mimeType'] = mime_for(path)

j['buffers'] = [{'byteLength': len(out)}]
json_bytes = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
while len(json_bytes) % 4:
    json_bytes += b' '
while len(out) % 4:
    out.append(0)

total = 12 + 8 + len(json_bytes) + 8 + len(out)
blob = bytearray(struct.pack('<4sII', b'glTF', 2, total))
blob += struct.pack('<II', len(json_bytes), 0x4E4F534A) + json_bytes
blob += struct.pack('<II', len(out), 0x004E4942) + out
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_bytes(blob)
print(f'packed {src} -> {dst} ({len(blob)} bytes)')
