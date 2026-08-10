import * as THREE from 'three';

// ============================================================
// Тіло бажання — двовершинний гексагональний кристал.
// ------------------------------------------------------------
// Власник надіслав референс: класичний кварц із шестигранною призмою й
// пірамідальними вершинами з ОБОХ кінців, що висить у повітрі. Позичена
// донька монарха цього не давала — вона одновершинна й росте з каменю, тож
// у сцені читалась уламком, а не кристалом.
//
// Тому форма тут своя, і це не суперечить §29 («та сама мінеральна сім'я»):
// сім'ю задає огранка й матеріал, а не конкретне тіло. Донька росте з
// субстрату й має основу; бажання ні до чого не прикріплене — двовершинність
// і є те, що каже «воно висить».
//
// Пропорції зняті з референсу: призма й дві вершини у відношенні приблизно
// 1 : 0.62 : 0.62, ширина — 0.84 висоти призми. Разом дає силует близько
// 2.7 : 1, як на зображенні.
// ============================================================

const SIDES = 6;
/** Висота призми; повна висота тіла виходить 1 + 2 × TIP. */
const PRISM = 1;
const TIP = 0.62;
const RADIUS = 0.42;

/**
 * Будує тіло висотою рівно 1 з центром у початку координат.
 *
 * Нормалізована висота — щоб масштаб інстансу дорівнював бажаній висоті й
 * жодного перерахунку в компоненті не лишалось.
 */
export function buildWishCrystalGeometry(): THREE.BufferGeometry {
  const total = PRISM + TIP * 2;
  const scale = 1 / total;
  const half = (PRISM / 2) * scale;
  const apex = (PRISM / 2 + TIP) * scale;
  const radius = RADIUS * scale;

  const ring: THREE.Vector3[] = [];
  for (let index = 0; index < SIDES; index += 1) {
    // Півкроку зсуву, щоб плоска грань дивилась на глядача, а не ребро:
    // фото всередині читається на грані, а не на стику.
    const angle = ((index + 0.5) / SIDES) * Math.PI * 2;
    ring.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }

  const positions: number[] = [];
  const push = (point: THREE.Vector3, y: number) => {
    positions.push(point.x, y, point.z);
  };

  for (let index = 0; index < SIDES; index += 1) {
    const a = ring[index]!;
    const b = ring[(index + 1) % SIDES]!;

    // Бічна грань — два трикутники.
    push(a, -half); push(b, -half); push(b, half);
    push(a, -half); push(b, half); push(a, half);

    // Вершина згори й знизу.
    push(a, half); push(b, half); positions.push(0, apex, 0);
    push(b, -half); push(a, -half); positions.push(0, -apex, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // Плоскі нормалі: грань має читатись гранню, а згладжена огранка
  // перетворює кристал на камінець.
  geometry.computeVertexNormals();
  return geometry;
}
