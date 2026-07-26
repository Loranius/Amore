#!/usr/bin/env python3
from pathlib import Path
import re, sys, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
errors = []

# Amore adaptation: this validator ships with the standalone SAS pack, which has
# no vendored code. Inside the app repo it must only inspect project-authored
# markdown — never dependencies or build output.
SKIP_DIRS = {'node_modules', 'dist', '.git', 'coverage', '.vite', 'build'}


def iter_docs():
    for path in ROOT.rglob('*.md'):
        if SKIP_DIRS.isdisjoint(path.relative_to(ROOT).parts):
            yield path

required = [
    'CLAUDE.md','README.md','INDEX.md',
    'docs/01_CONTRACTS/DETERMINISM_STANDARD.md',
    'docs/01_CONTRACTS/TESTING_VALIDATION_STRATEGY.md',
    'docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md',
    'docs/04_PROMPTS/05_AMORE_CRYSTAL_INTEGRITY_PROMPT.md',
]
required += [f'docs/02_VOLUMES/Volume_{i:02d}_' for i in range(1,8)]

for item in required:
    if item.endswith('_'):
        if not list(ROOT.glob(item + '*.md')):
            errors.append(f'Missing volume matching {item}*.md')
    elif not (ROOT/item).exists():
        errors.append(f'Missing required file: {item}')

for p in iter_docs():
    text=p.read_text(encoding='utf-8')
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', text):
        if '://' in target or target.startswith('#'):
            continue
        candidate=(p.parent/target.split('#')[0]).resolve()
        if not candidate.exists():
            errors.append(f'Broken link: {p.relative_to(ROOT)} -> {target}')

all_text='\n'.join(p.read_text(encoding='utf-8') for p in iter_docs())
ids=re.findall(r'\bV[1-7]-REQ-\d{3}\b', all_text)
for vid in range(1,8):
    expected={f'V{vid}-REQ-{i:03d}' for i in range(1,13)}
    present=set(x for x in ids if x.startswith(f'V{vid}-'))
    missing=expected-present
    if missing: errors.append(f'Missing requirement IDs for V{vid}: {sorted(missing)}')

extra_expected = {
    3: range(13,16),
    4: range(13,16),
    5: range(13,17),
    6: range(13,16),
}
for vid, nums in extra_expected.items():
    for i in nums:
        rid=f'V{vid}-REQ-{i:03d}'
        if rid not in all_text:
            errors.append(f'Missing crystal integrity requirement ID: {rid}')

for i in range(1,13):
    rid=f'CAI-REQ-{i:03d}'
    if rid not in all_text:
        errors.append(f'Missing crystal attachment integrity requirement ID: {rid}')

for bad in ['Species State', 'Species Profile or Species State']:
    if bad in all_text:
        errors.append(f'Forbidden ambiguous term remains: {bad}')

scope_markers = [
    'Do not create parallel replacements',
    'Product reaction integration is deferred',
    'Raw overlap of independently closed crystal meshes is not an acceptable final junction strategy',
    'strict underside',
    'child base cap',
]
master=(ROOT/'docs/00_GOVERNANCE/MASTER_BUILD_PROMPT.md').read_text(encoding='utf-8')
profile=(ROOT/'docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md').read_text(encoding='utf-8')
combined=master+'\n'+profile
for marker in scope_markers:
    if marker.lower() not in combined.lower():
        errors.append(f'Missing required scope/integrity marker: {marker}')

manifest_path=ROOT/'manifest.json'
if manifest_path.exists():
    try:
        manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
        listed={entry['path']: entry for entry in manifest.get('files', [])}
        actual=[]
        for p in sorted(ROOT.rglob('*')):
            if p.is_file() and p.relative_to(ROOT).as_posix() != 'manifest.json':
                actual.append(p.relative_to(ROOT).as_posix())
        expected_count=len(actual)+1
        if manifest.get('fileCount') != expected_count:
            errors.append(f"Manifest fileCount {manifest.get('fileCount')} != actual {expected_count}")
        for rel in actual:
            entry=listed.get(rel)
            if not entry:
                errors.append(f'Manifest missing file: {rel}')
                continue
            data=(ROOT/rel).read_bytes()
            sha=hashlib.sha256(data).hexdigest()
            if entry.get('sha256') != sha:
                errors.append(f'Manifest hash mismatch: {rel}')
            if entry.get('bytes') != len(data):
                errors.append(f'Manifest byte count mismatch: {rel}')
        extra=set(listed)-set(actual)-{'manifest.json'}
        for rel in sorted(extra):
            errors.append(f'Manifest lists missing file: {rel}')
    except Exception as exc:
        errors.append(f'Invalid manifest: {exc}')

if errors:
    print('Documentation validation FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('Documentation validation PASSED')
