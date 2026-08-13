#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUNDLE="$ROOT/scripts/reef/materializer.tgz.b64"
OUT="${1:-$ROOT/public/models/school_of_fish_reef.glb}"
SOURCE_COMMIT="e8af97a4d3d81047b7132a957a23f66f4d1bc4d0"
SOURCE_REPO="https://github.com/wlaszkiewicz/manatee-game.git"
B64_SHA="7e52bd222fc9dd34fad30ece1badca617ba381aea250279fbf2670ccd6523b5e"
TGZ_SHA="892e83f996723349258b76388a2ad5a622ad85dbdd707d16ffdf66b45e7f2563"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

printf '%s  %s\n' "$B64_SHA" "$BUNDLE" | sha256sum -c -
base64 -d "$BUNDLE" > "$WORK/materializer.tgz"
printf '%s  %s\n' "$TGZ_SHA" "$WORK/materializer.tgz" | sha256sum -c -
mkdir -p "$WORK/tools"
tar -xzf "$WORK/materializer.tgz" -C "$WORK/tools"

python3 -m venv "$WORK/venv"
"$WORK/venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir numpy==2.2.6 pillow==11.3.0
PY="$WORK/venv/bin/python"

git init -q "$WORK/source"
git -C "$WORK/source" remote add origin "$SOURCE_REPO"
git -C "$WORK/source" config core.sparseCheckout true
git -C "$WORK/source" config extensions.partialClone origin
git -C "$WORK/source" config remote.origin.promisor true
git -C "$WORK/source" config remote.origin.partialCloneFilter blob:none
mkdir -p "$WORK/source/.git/info"
printf '/Assets/Objects/school_of_fish/\n' > "$WORK/source/.git/info/sparse-checkout"
git -C "$WORK/source" fetch --depth=1 --filter=blob:none origin "$SOURCE_COMMIT"
git -C "$WORK/source" checkout --detach FETCH_HEAD

SOURCE="$WORK/source/Assets/Objects/school_of_fish"
grep -F '25494f5c4ead471ab8205aadfbfec0bc' "$SOURCE/license.txt"
grep -F 'Titanas YT' "$SOURCE/license.txt"
grep -F 'CC-BY-4.0' "$SOURCE/license.txt"

"$PY" "$WORK/tools/pack_external_gltf.py" "$SOURCE/scene.gltf" "$WORK/source.glb"
"$PY" "$WORK/tools/optimize_school_fish_ci.py" "$WORK/source.glb" "$WORK/optimized.glb" "$WORK/report.json"
mkdir -p "$(dirname "$OUT")"
"$PY" "$WORK/tools/repack_school_fish_textures_ci.py" "$WORK/optimized.glb" "$OUT"
rm -f "$OUT.gz"

# Normalize the authored school into the reef's open-water volume while keeping
# every animated bone/key unchanged. The runtime renderer still owns the final
# tiny world scale; this adjusts only the source root matrix so the fish do not
# spend their full loop hidden inside the central reef mass.
"$PY" - "$OUT" <<'PY'
import json
import struct
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = path.read_bytes()
magic, version, _ = struct.unpack_from('<III', data, 0)
json_len, json_type = struct.unpack_from('<II', data, 12)
if magic != 0x46546C67 or version != 2 or json_type != 0x4E4F534A:
    raise SystemExit('unexpected GLB header')

doc = json.loads(data[20:20 + json_len].decode('utf-8').rstrip(' \x00'))
bin_header = 20 + json_len
bin_len, bin_type = struct.unpack_from('<II', data, bin_header)
if bin_type != 0x004E4942:
    raise SystemExit('expected GLB BIN chunk')
binary = bytearray(data[bin_header + 8:bin_header + 8 + bin_len])

scene = doc['scenes'][doc.get('scene', 0)]
root = doc['nodes'][scene['nodes'][0]]
matrix = list(root.get('matrix', []))
if len(matrix) != 16:
    raise SystemExit('expected Sketchfab root matrix')

runtime_scale = 0.00058
desired_scale = 0.00072
ratio = desired_scale / runtime_scale
for column in range(3):
    for row in range(3):
        index = column * 4 + row
        matrix[index] *= ratio
matrix[12] += 0.0
matrix[13] += (1.25 - 0.55) / runtime_scale
matrix[14] += (1.0 - 0.15) / runtime_scale
root['matrix'] = matrix

json_bytes = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
while len(json_bytes) % 4:
    json_bytes += b' '
while len(binary) % 4:
    binary.append(0)

total = 12 + 8 + len(json_bytes) + 8 + len(binary)
out = bytearray(struct.pack('<III', magic, version, total))
out += struct.pack('<II', len(json_bytes), 0x4E4F534A) + json_bytes
out += struct.pack('<II', len(binary), 0x004E4942) + binary
path.write_bytes(out)
PY

"$PY" "$WORK/tools/validate_school_fish.py" "$OUT"
sha256sum "$OUT"
