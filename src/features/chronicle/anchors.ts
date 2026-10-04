// ============================================================
// Опорні точки хроніки (ADR-0238): куди веде камеру запис пари.
// ------------------------------------------------------------
// Кожен запис показує ТУ частину, яку він справді виростив за таблицею
// ADR-0237 §3. Точки беруться з тих самих функцій геометрії, що малюють
// об'єкт, а не вгадуються з екрана: квітка бажання — там, де квітка,
// тріщина лави плану — там, де вона на схилі.
//
// Одиниці: `object` — одиниці моделі виду, від землі під об'єктом (сцена
// множить на масштаб кадру); `island` — частки радіуса острова (друзи
// кристала лежать на плитах острова, а не на кристалі).
// ============================================================
import type { ActivityKind, CrystalV2Model } from '@/engine/species/crystalV2/model';
import type { ChronicleTrace } from '@/engine/species/grammar/chronicle';
import { treeV2Ornaments, treeV2Roots, treeV2Skeleton, type TreeForm } from '@/engine/species/treeV2/geometry';
import type { TreeV2Model } from '@/engine/species/treeV2/model';
import { volcanoOrnaments, volcanoPlacements } from '@/engine/species/volcano/geometry';
import { volcanoSlopeRadius, type VolcanoModel } from '@/engine/species/volcano/model';
import { druseAt } from '@/features/home/crystal3d/v2/crystalIsland';

export type V3 = [number, number, number];

export interface ChronicleAnchor {
  point: V3;
  space: 'object' | 'island';
  /** Наскільки близько підійти: частка відстані звичайного кадру. */
  zoom: number;
  /**
   * Якщо частини ще немає (план до першого конуса) — чесна примітка, куди
   * саме камера дивиться замість неї.
   */
  note?: string;
}

/** Що хроніка знає про об'єкт: модель виду на показану дату. */
export type ChronicleSubject =
  | { species: 'crystal'; model: CrystalV2Model }
  | { species: 'tree'; model: TreeV2Model; form: TreeForm }
  | { species: 'reef'; model: VolcanoModel };

const CLOSE = 0.5;
const WHOLE = 0.78;

const at = (point: V3, zoom = CLOSE, space: ChronicleAnchor['space'] = 'object', note?: string): ChronicleAnchor =>
  (note ? { point, space, zoom, note } : { point, space, zoom });

// ── Кристал ───────────────────────────────────────────────
function crystalChild(model: CrystalV2Model, year: number): V3 | null {
  const child = model.children.find((c) => c.year === year);
  if (!child) return null;
  const az = (child.azimuth * Math.PI) / 180;
  const lean = (child.lean * Math.PI) / 180;
  const reach = child.distance + Math.sin(lean) * child.height * 0.6;
  return [Math.cos(az) * reach, Math.cos(lean) * child.height * 0.6, Math.sin(az) * reach];
}

function crystalAnchor(model: CrystalV2Model, trace: ChronicleTrace): ChronicleAnchor {
  const m = model.monarch;
  const H = m.height;
  switch (trace.kind) {
    case 'memories': return at([0, H * 0.45, 0], 0.62);
    case 'plans': return at([m.apex[0] * 4, H * 0.95, m.apex[1] * 4]);
    case 'wishes': return at([0, H * 0.55, 0], WHOLE);
    case 'media': return at([0, H * 0.35, 0], 0.62);
    case 'daysOff': return at(druseAt(model.startDate, 1, trace.index), CLOSE, 'island');
    case 'milestones':
    case 'places':
    case 'events': {
      const child = crystalChild(model, trace.year);
      return child ? at(child) : at([0, H * 0.5, 0], WHOLE, 'object', 'Кристал цього року ще росте');
    }
  }
}

// ── Дерево ────────────────────────────────────────────────
function treeAnchor(model: TreeV2Model, form: TreeForm, trace: ChronicleTrace): ChronicleAnchor {
  const { branches, clusters } = treeV2Skeleton(model, form);
  const orn = treeV2Ornaments(model, clusters);
  const crown: V3 = [0, model.height * 0.8, 0];
  const yearBranch = (year: number): V3 | null => {
    const b = branches.find((x) => x.key === `y${year}`);
    return b ? b.end : null;
  };
  switch (trace.kind) {
    case 'wishes': {
      const k = model.blossoms.findIndex((b) => b.id === trace.id);
      const blossom = k >= 0 ? orn.blossoms[k] : undefined;
      return blossom ? at(blossom.position, 0.42) : at(crown, WHOLE, 'object', 'Квітка цього бажання вже серед найновіших у кроні');
    }
    case 'plans': {
      const limbs = branches.filter((b) => /^c\d+$/.test(b.key));
      const limb = limbs[trace.index % Math.max(1, limbs.length)];
      return limb ? at(limb.end) : at(crown, WHOLE);
    }
    case 'milestones': {
      const fruit = orn.fruits[trace.index];
      return fruit ? at(fruit, 0.42) : at(crown, WHOLE, 'object', 'Плодів — не більше дванадцяти; цей серед них');
    }
    case 'places': {
      const roots = treeV2Roots(model).filter((r) => r.key.endsWith('b'));
      const root = roots[trace.index % Math.max(1, roots.length)];
      return root ? at(root.end, 0.55) : at([0, 0, 0], 0.6);
    }
    case 'media': return at(crown, WHOLE);
    case 'daysOff': {
      const flower = orn.flowers[trace.index];
      return flower ? at(flower.position, 0.55) : at([0, 0, 0], 0.7);
    }
    case 'memories':
    case 'events': {
      const end = yearBranch(trace.year);
      return end ? at(end) : at(crown, WHOLE);
    }
  }
}

// ── Вулкан ────────────────────────────────────────────────
function volcanoAnchor(model: VolcanoModel, trace: ChronicleTrace): ChronicleAnchor {
  const orn = volcanoOrnaments(model);
  const crater: V3 = [0, model.height, 0];
  const onSlope = (azDeg: number, y: number): V3 => {
    const a = (azDeg * Math.PI) / 180;
    const r = volcanoSlopeRadius(model, y);
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  switch (trace.kind) {
    case 'wishes': {
      const k = model.life.anemones.findIndex((a) => a.id === trace.id);
      const anemone = k >= 0 ? orn.anemones[k] : undefined;
      return anemone ? at(anemone.position, 0.45) : at(crater, WHOLE, 'object', 'Актинія цього бажання вже серед найновіших');
    }
    case 'plans': {
      const vent = model.vents[trace.index % Math.max(1, model.vents.length)];
      if (!vent) return at(crater, 0.6, 'object', 'Тріщина лави з\'явиться на третьому виконаному плані');
      return at(onSlope(vent.azimuth, vent.at * model.height + vent.size * 0.6));
    }
    case 'memories': {
      const colony = volcanoPlacements(model).find((p) => p.colony.year === trace.year);
      return colony ? at(colony.base, 0.45) : at(crater, WHOLE);
    }
    case 'milestones': {
      const clam = orn.clams[trace.index];
      return clam ? at(clam, 0.45) : at(crater, WHOLE, 'object', 'Мушель — не більше восьми; ця серед них');
    }
    case 'places': {
      const star = orn.starfish[trace.index % Math.max(1, orn.starfish.length)];
      return star ? at(star.position, 0.5) : at(crater, WHOLE);
    }
    case 'media': {
      const fish = orn.fish[trace.index % Math.max(1, orn.fish.length)];
      return fish ? at([fish.orbit, fish.height, 0], 0.7) : at(crater, WHOLE);
    }
    case 'daysOff': {
      const grass = orn.seagrass[trace.index % Math.max(1, orn.seagrass.length)];
      return grass ? at(grass, 0.55) : at(crater, WHOLE);
    }
    case 'events': {
      const layer = model.layers.find((l) => l.year === trace.year);
      if (!layer) return at(crater, WHOLE);
      return at(onSlope((trace.year * 137.5) % 360, layer.to), 0.55);
    }
  }
}

export function chronicleAnchor(subject: ChronicleSubject, trace: ChronicleTrace): ChronicleAnchor {
  if (subject.species === 'crystal') return crystalAnchor(subject.model, trace);
  if (subject.species === 'tree') return treeAnchor(subject.model, subject.form, trace);
  return volcanoAnchor(subject.model, trace);
}

/**
 * Що ростить модуль у виді (ADR-0237 §3) — підпис над списком записів.
 * Таблицею, рукою: видів три, модулів вісім, і кожен рядок має бути
 * правдою про свій вид.
 */
export const MODULE_TRACE: Record<'crystal' | 'tree' | 'reef', Record<ActivityKind, string>> = {
  crystal: {
    memories: 'Спогади роблять головний кристал ширшим',
    plans: 'Виконані плани додають граней його вершині',
    wishes: 'Виконані бажання фарбують усю колонію',
    milestones: 'Віхи — іскри в кристалі свого року',
    events: 'Події живлять кристал свого року',
    places: 'Місця нахиляють кристал свого року назовні',
    media: 'Переглянуте — внутрішнє сяйво',
    daysOff: 'Спільні вихідні — друзи-самоцвіти на острові',
  },
  tree: {
    memories: 'Спогади — пишність крони на гілці свого року',
    plans: 'Виконані плани — гілки верхівки',
    wishes: 'Виконані бажання — квіти в кроні, колір — хто виконав',
    milestones: 'Віхи — золоті плоди',
    events: 'Події живлять гілку свого року',
    places: 'Місця — коріння',
    media: 'Переглянуте — світлячки довкола крони',
    daysOff: 'Спільні вихідні — польові квіти на лузі',
  },
  reef: {
    memories: 'Спогади — корали колонії свого року',
    plans: 'Виконані плани — тріщини лави на схилі',
    wishes: 'Виконані бажання — актинії, колір — хто виконав',
    milestones: 'Віхи — мушлі з перлиною',
    events: 'Події живлять шар свого року',
    places: 'Місця — морські зірки',
    media: 'Переглянуте — риби в зграї',
    daysOff: 'Спільні вихідні — морська трава',
  },
};

export const MODULE_TITLE: Record<ActivityKind, string> = {
  memories: 'Спогади',
  plans: 'Плани',
  wishes: 'Бажання',
  milestones: 'Віхи',
  events: 'Події',
  places: 'Місця',
  media: 'Переглянуте',
  daysOff: 'Вихідні',
};
