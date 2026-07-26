// ============================================================
// Батчинг тіл за матеріалом — draw calls.
// ------------------------------------------------------------
// Вузьке місце кристала на мобільному GPU — не трикутники (їх ~1800 після
// зрізу), а кількість викликів рендера: до батчингу кожне тіло було
// окремим мешем. Тести фіксують і сам виграш, і те, що він не куплений
// ціною змішування різних матеріалів в один батч.
// ============================================================
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBranches, SEEDS } from './fixture';
import { publishCrystal } from '../crystalPublication';
import { bodyMaterialProps, materialSignature } from '../material/bodyMaterial';
import { bodyMatrix, buildBodyBatches, disposeBatches } from '../render/batchedBodies';

describe('батчинг — draw calls', () => {
  it('кожне видиме тіло потрапляє рівно в один батч', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const p = publishCrystal(branches, material);
      const batches = buildBodyBatches(p.renderable, material);
      const seen = new Set<string>();
      for (const batch of batches) {
        for (const body of batch.bodies) {
          expect(seen.has(body.branch.key), `${seed}: ${body.branch.key} у двох батчах`).toBe(false);
          seen.add(body.branch.key);
        }
      }
      expect(seen.size, seed).toBe(p.renderable.length);
      disposeBatches(batches);
    }
  });

  it('батчів помітно менше, ніж тіл — інакше вся затія марна', () => {
    const summary: string[] = [];
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const p = publishCrystal(branches, material);
      const batches = buildBodyBatches(p.renderable, material);
      summary.push(`${seed}: ${p.renderable.length}→${batches.length}`);
      // Виміряно 27-35 тіл → 6-7 батчів. Стеля з запасом: якщо колись
      // з'явиться десяток нових наборів матеріалу, тест це помітить.
      expect(batches.length, summary.join(' ')).toBeLessThanOrEqual(10);
      expect(batches.length).toBeLessThan(p.renderable.length / 2);
      disposeBatches(batches);
    }
  });

  it('в один батч потрапляють ЛИШЕ тіла з ідентичним матеріалом', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const p = publishCrystal(branches, material);
      for (const batch of buildBodyBatches(p.renderable, material)) {
        for (const body of batch.bodies) {
          expect(materialSignature(bodyMaterialProps(body.branch, material)), `${seed}/${body.branch.key}`).toBe(
            batch.signature,
          );
        }
      }
    }
  });

  it('матриця екземпляра відтворює позицію, оберт і подих тіла', () => {
    // Подих переїхав із `mesh.scale.y` у матрицю екземпляра — тут
    // перевіряється, що переїзд нічого не змінив по суті.
    const { branches, material } = buildBranches(SEEDS[0]);
    const p = publishCrystal(branches, material);
    const body = p.renderable[0]!;
    const scale = 1.018;
    const m = bodyMatrix(body, scale).clone();

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    m.decompose(pos, quat, scl);

    const b = body.branch;
    expect(pos.x).toBeCloseTo(b.posX, 10);
    expect(pos.y).toBeCloseTo(b.posY, 10);
    expect(pos.z).toBeCloseTo(b.posZ, 10);
    expect(Math.abs(quat.dot(new THREE.Quaternion(b.quatX, b.quatY, b.quatZ, b.quatW)))).toBeCloseTo(1, 10);
    expect(scl.x).toBeCloseTo(1, 10);
    expect(scl.y).toBeCloseTo(scale, 10);
    expect(scl.z).toBeCloseTo(1, 10);
  });

  it('батч рейкаститься — тап по кристалу відкриває модалку', () => {
    // Клік по тілу тепер іде через `BatchedMesh.raycast`, а не через
    // окремий меш. Цілимось у ВЛАСНУ вісь кожного тіла: промінь у центр
    // обмежувальної сфери батча нічого не доводить — там може бути
    // порожнеча між шпилями віяла (на це я вже наступив).
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const p = publishCrystal(branches, material);
      const batches = buildBodyBatches(p.renderable, material);
      let aimed = 0;
      let hit = 0;
      for (const batch of batches) {
        batch.mesh.updateMatrixWorld(true);
        let batchHits = 0;
        for (const body of batch.bodies) {
          const b = body.branch;
          const mid = new THREE.Vector3(0, body.solid.profile.h * 0.45, 0)
            .applyQuaternion(new THREE.Quaternion(b.quatX, b.quatY, b.quatZ, b.quatW))
            .add(new THREE.Vector3(b.posX, b.posY, b.posZ));
          const hits = new THREE.Raycaster(
            mid.clone().add(new THREE.Vector3(0, 0, 8)),
            new THREE.Vector3(0, 0, -1),
          ).intersectObject(batch.mesh, false);
          aimed++;
          if (hits.length > 0) {
            batchHits++;
            hit++;
            // batchId каже, у яке саме тіло влучили — без нього рендерер
            // не зміг би відрізнити тіла всередині батча.
            expect(typeof hits[0]!.batchId).toBe('number');
          }
        }
        // Окреме тіло промінь може й проминути: зріз лишає в оболонці
        // дірки там, де грані сховані в сусідах, тож влучання в КОЖНЕ не
        // гарантоване. А от батч, у який не влучити взагалі, означав би
        // втрачений тап.
        expect(batchHits, `${seed}: батч ${batch.signature.slice(0, 40)} не рейкаститься`).toBeGreaterThan(0);
      }
      // На рівні всієї маси промахи мають лишатись поодинокими.
      expect(hit / aimed, `${seed}: влучань ${hit}/${aimed}`).toBeGreaterThan(0.7);
      disposeBatches(batches);
    }
  });
});
