// ============================================================
// Товща води як купол, а не як стеля.
// ------------------------------------------------------------
// Перша редакція ставила поверхню ДИСКОМ високо вгорі. У диска є край,
// і коли камера підводилась, за тим краєм проглядало тло іншого
// кольору — власник побачив це першим: «видно небо шматками у верхній
// частині рифа». Двадцять чотири сегменти диска давали ще й рівні
// хорди, тобто «шматки» були буквально багатокутником.
//
// У купола краю немає з визначення. Він охоплює сцену цілком, а колір
// бере з ВИСОТИ: угорі — світло, що пробилось із поверхні, на рівні
// горизонту — той самий колір, яким працює туман, унизу — темніше.
// Збіг із туманом на горизонті обов'язковий: саме там у нього тане все
// далеке, і будь-яка різниця читалась би лінією.
// ============================================================
import { BufferAttribute, Color, SphereGeometry } from 'three';

/** Скільки сегментів має купол: його ніхто не роздивляється. */
const SEGMENTS = 24;
const RINGS = 16;

/**
 * Де закінчується «поверхня» і починається «горизонт», у частках висоти.
 *
 * Нижче цього рівня купол уже кольору туману. Вище — світлішає до
 * поверхні, і саме ця смуга й читається як вода над головою.
 */
const HORIZON = 0.52;

export interface ReefWaterDomeColours {
  /** Колір поверхні, якою її видно знизу. */
  ceiling: string;
  /** Колір товщі — той самий, що в тумані. */
  deep: string;
}

/**
 * Купол навколо всієї сцени з градієнтом по висоті.
 *
 * Малюється зсередини (`BackSide` вмикає сцена), без туману: він і є
 * тим, у що туман усе перетворює.
 */
export function buildReefWaterDome(radius: number, colours: ReefWaterDomeColours): SphereGeometry {
  const geometry = new SphereGeometry(radius, SEGMENTS, RINGS);
  const position = geometry.getAttribute('position');
  const ceiling = new Color(colours.ceiling);
  const deep = new Color(colours.deep);
  const tint = new Color();
  const values = new Float32Array(position.count * 3);

  for (let index = 0; index < position.count; index += 1) {
    // −1 на дні, +1 на маківці.
    const height = position.getY(index) / radius;
    const above = Math.max(0, (height - (HORIZON * 2 - 1)) / (1 - (HORIZON * 2 - 1)));
    // Квадрат: світло тримається біля самої поверхні й швидко гасне
    // вниз, як воно й буває в товщі.
    tint.copy(deep).lerp(ceiling, above * above);
    values[index * 3] = tint.r;
    values[index * 3 + 1] = tint.g;
    values[index * 3 + 2] = tint.b;
  }

  geometry.setAttribute('color', new BufferAttribute(values, 3));
  return geometry;
}
