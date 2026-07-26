// ============================================================
// Тести власності матеріалу (Volume VI).
// ------------------------------------------------------------
// Перевіряють вимоги профілю CRYSTAL_ATTACHMENT_INTEGRITY §7:
//   `CAI-REQ-009` — матеріал дитини не проступає крізь чужу область;
//   `CAI-REQ-010` — перехід матеріалів живе ЛИШЕ в оголошеній смузі шва;
//   `V6-REQ-013`  — прив'язка тільки до зовнішніх регіонів і смуги шва;
//   `V6-REQ-014`  — зокрема й знизу;
//   `V6-REQ-015`  — власність регіонів не залежить від деталізації тіла.
// ============================================================
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildMass, SEEDS, toMaterialEntries } from './fixture';
import { MATERIAL_BLEND_RATIO } from '../../artifact/composition/attachment';
import { distanceOutsideHost } from '../geometry/hostBody';
import { worldVertices } from '../geometry/junctionTrim';
import { bindMaterialRegions, type MaterialRegion, type MaterialRegionStats } from '../material/crystalMaterial';
import { formatMaterialViolations, validateMaterialRegions } from '../material/validateMaterial';

describe('material regions — `V6-REQ-013` прив’язка', () => {
  it('зрізані грані не отримують матеріалу, вцілілі — отримують', () => {
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      const violations = validateMaterialRegions(toMaterialEntries(mass), mass.material);
      expect(formatMaterialViolations(violations.filter((v) => v.kind === 'unbound-material')), seed).toBe(
        'material regions: 0 порушень',
      );
    }
  });

  it('валідатор не вакуумний: підроблений колір на зрізаній вершині ловиться', () => {
    const mass = buildMass(SEEDS[0]);
    const entries = toMaterialEntries(mass);
    // Знаходимо тіло, у якого справді є зрізані (не згадані в індексі) вершини.
    const victim = entries.find((e) => {
      const regions = e.geometry.userData.materialRegions as MaterialRegion[];
      return regions.includes('unbound');
    })!;
    const regions = victim.geometry.userData.materialRegions as MaterialRegion[];
    const color = victim.geometry.getAttribute('color');
    color.setXYZ(regions.indexOf('unbound'), 0.9, 0.2, 0.2);
    const violations = validateMaterialRegions(entries, mass.material);
    expect(violations.some((v) => v.kind === 'unbound-material' && v.key === victim.branch.key)).toBe(true);
  });
});

describe('material regions — `CAI-REQ-010` смуга шва', () => {
  it('кожна вершина шва лежить у межах оголошеної смуги, і поза смугою колір чистий', () => {
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      const violations = validateMaterialRegions(toMaterialEntries(mass), mass.material).filter(
        (v) => v.kind === 'seam-outside-band' || v.kind === 'blend-outside-seam',
      );
      expect(formatMaterialViolations(violations), seed).toBe('material regions: 0 порушень');
    }
  });

  it('ширина смуги — політика Volume IV, а не число в рендерері', () => {
    const mass = buildMass(SEEDS[0]);
    for (const body of mass.bodies) {
      const stats = body.geometry.userData.materialStats as MaterialRegionStats;
      const expected = body.branch.hostKey === null ? 0 : body.solid.profile.r * MATERIAL_BLEND_RATIO;
      expect(stats.blendWidth, body.branch.key).toBeCloseTo(expected, 10);
    }
  });

  it('шов реально існує: у масі є вершини, позначені як шов', () => {
    let seam = 0;
    for (const seed of SEEDS) {
      for (const body of buildMass(seed).bodies) {
        seam += (body.geometry.userData.materialStats as MaterialRegionStats).seam;
      }
    }
    expect(seam).toBeGreaterThan(0);
  });

  it('валідатор не вакуумний: розмазаний за смугу колір ловиться', () => {
    const mass = buildMass(SEEDS[0]);
    const entries = toMaterialEntries(mass);
    // Фарбуємо ЗОВНІШНЮ вершину чужим тоном — рівно те, що сталося б, якби
    // смуга шва «протекла» за оголошені межі.
    const victim = entries.find((e) => {
      const regions = e.geometry.userData.materialRegions as MaterialRegion[];
      return e.branch.hostKey !== null && regions.includes('external');
    })!;
    const regions = victim.geometry.userData.materialRegions as MaterialRegion[];
    victim.geometry.getAttribute('color').setXYZ(regions.indexOf('external'), 0.1, 0.9, 0.4);
    const violations = validateMaterialRegions(entries, mass.material);
    expect(violations.some((v) => v.kind === 'blend-outside-seam' && v.key === victim.branch.key)).toBe(true);
  });

  it('валідатор не вакуумний: вершина шва поза смугою ловиться', () => {
    const mass = buildMass(SEEDS[0]);
    const entries = toMaterialEntries(mass);
    const victim = entries.find((e) => {
      const regions = e.geometry.userData.materialRegions as MaterialRegion[];
      return e.branch.hostKey !== null && regions.includes('external');
    })!;
    const regions = victim.geometry.userData.materialRegions as MaterialRegion[];
    // Оголошуємо швом вершину, що стоїть далеко від господаря.
    regions[regions.lastIndexOf('external')] = 'seam';
    const violations = validateMaterialRegions(entries, mass.material);
    expect(violations.some((v) => v.kind === 'seam-outside-band' && v.key === victim.branch.key)).toBe(true);
  });

  it('вершина далі за смугу від господаря НІКОЛИ не позначена швом', () => {
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      for (const body of mass.bodies) {
        if (body.branch.hostKey === null) continue;
        const host = mass.solids.get(body.branch.hostKey);
        if (host === undefined) continue;
        const stats = body.geometry.userData.materialStats as MaterialRegionStats;
        const regions = body.geometry.userData.materialRegions as MaterialRegion[];
        const world = worldVertices(body.geometry, body.solid);
        for (let v = 0; v < regions.length; v++) {
          if (regions[v] !== 'seam') continue;
          const d = distanceOutsideHost(world[v]!, host);
          expect(d, `${seed}/${body.branch.key}#${v}`).toBeGreaterThanOrEqual(0);
          expect(d, `${seed}/${body.branch.key}#${v}`).toBeLessThan(stats.blendWidth);
        }
      }
    }
  });
});

describe('material regions — `CAI-REQ-009` матеріал не проступає крізь чуже тіло', () => {
  // Вимога тримається доказом із двох частин (див. заголовок
  // validateMaterial.ts), бо пряма проба променем структурно вакуумна.
  // Частину 1 (геометрія поза всіма тілами) доводить geometry.test.ts;
  // частину 2 (матеріал лише на власних вцілілих гранях) — тут.
  it('кожна вціліла грань несе матеріал, і жодна зрізана його не отримала', () => {
    // Це ДРУГА половина доказу `CAI-REQ-009`: матеріал живе рівно на власних
    // вцілілих гранях тіла. Першу половину — що ці грані не лежать у чужому
    // об'ємі — доводить geometry.test.ts («hidden-face»), і повторювати її
    // тут означало б дублювати тест, а не підсилювати гарантію.
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      for (const body of mass.bodies) {
        const index = body.geometry.getIndex()!;
        const regions = body.geometry.userData.materialRegions as MaterialRegion[];
        const color = body.geometry.getAttribute('color');
        const referenced = new Set<number>();
        for (let i = 0; i < index.count; i++) referenced.add(index.getX(i));
        for (let v = 0; v < regions.length; v++) {
          const bound = regions[v] !== 'unbound';
          expect(bound, `${seed}/${body.branch.key}#${v}`).toBe(referenced.has(v));
          if (!bound) {
            expect(color.getX(v) + color.getY(v) + color.getZ(v), `${body.branch.key}#${v}`).toBe(0);
          }
        }
      }
    }
  });

  it('матеріал тіла не залежить від його дітей — фарбується лише сама дитина', () => {
    // Односторонність шва: дитина переймає колір господаря, господар свій
    // колір не змінює НІКОЛИ. Якщо змішування колись зроблять симетричним,
    // саме цей тест впаде першим.
    const mass = buildMass(SEEDS[0]);
    const hosts = new Set(mass.bodies.map((b) => b.branch.hostKey).filter((k): k is string => k !== null));
    expect(hosts.size).toBeGreaterThan(0);
    for (const body of mass.bodies) {
      if (!hosts.has(body.branch.key)) continue;
      const withoutHost = new THREE.BufferGeometry();
      withoutHost.setAttribute('position', body.geometry.getAttribute('position'));
      withoutHost.setIndex(body.geometry.getIndex());
      bindMaterialRegions(withoutHost, body.branch, body.solid, mass.material, undefined);
      const stats = body.geometry.userData.materialStats as MaterialRegionStats;
      // Тіло-господар саме може бути дитиною свого господаря — тоді в нього
      // законно є власний шов; порівнюємо лише зовнішні вершини.
      const regions = body.geometry.userData.materialRegions as MaterialRegion[];
      const a = body.geometry.getAttribute('color');
      const b = withoutHost.getAttribute('color');
      for (let v = 0; v < regions.length; v++) {
        if (regions[v] !== 'external') continue;
        expect(a.getX(v), `${body.branch.key}#${v} (seam=${stats.seam})`).toBeCloseTo(b.getX(v), 6);
      }
    }
  });
});

describe('material regions — детермінізм і `V6-REQ-015`', () => {
  it('та сама маса двічі → побайтово ті самі кольори й регіони', () => {
    for (const seed of SEEDS) {
      const a = buildMass(seed);
      const b = buildMass(seed);
      for (let i = 0; i < a.bodies.length; i++) {
        const x = a.bodies[i]!.geometry;
        const y = b.bodies[i]!.geometry;
        expect(Array.from(y.getAttribute('color').array as Float32Array)).toEqual(
          Array.from(x.getAttribute('color').array as Float32Array),
        );
        expect(y.userData.materialRegions).toEqual(x.userData.materialRegions);
        expect(y.userData.materialStats).toEqual(x.userData.materialStats);
      }
    }
  });

  it('дрібні тіла (4-6 граней) підпорядковані тим самим правилам, що великі', () => {
    let small = 0;
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      const smallEntries = toMaterialEntries(mass).filter((e) => e.solid.profile.segments <= 6);
      small += smallEntries.length;
      expect(formatMaterialViolations(validateMaterialRegions(smallEntries, mass.material)), seed).toBe(
        'material regions: 0 порушень',
      );
    }
    expect(small).toBeGreaterThan(10);
  });
});
