// ============================================================
// SwipeCardView — картка на framer-motion (заміна pointer-events swipe.js)
// ------------------------------------------------------------
// Драг через framer-motion замість ручних touch/mouse-обробників.
// Напрям визначається за офсетом/швидкістю; логіка та пороги — як у
// старому attachTouch: вертикаль домінує над горизонталлю, тап без руху
// відкриває деталі.
//
// Що саме означає кожен напрям — НЕ тут. Підпис, значок і колір усіх
// чотирьох живуть у `swipeDirections.ts`, а сила заливки рахується в
// `swipeFeedback.ts`. Доки опис був у трьох місцях (тут, у кнопках
// колоди і в CSS), вони встигли розійтись: картка казала одне, кнопка
// під нею — інше.
// ============================================================
import { useState } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { SWIPE_VERDICTS } from './swipeDirections';
import { verdictTint } from './swipeFeedback';
import type { SwipeCard, SwipeDirection } from '@/types';

const OFFSET_T = 80; // поріг зриву (px), як старий T
const VELOCITY_T = 500; // або достатня швидкість флику

interface SwipeCardViewProps {
  card: SwipeCard;
  /** true лише для верхньої (інтерактивної) картки. */
  active: boolean;
  /** Позиція від верху (0 = верхня) — для масштабу/зсуву в стеку. */
  depth: number;
  onSwipe: (card: SwipeCard, dir: SwipeDirection) => void;
  onTap: (card: SwipeCard) => void;
}

export function SwipeCardView({ card, active, depth, onSwipe, onTap }: SwipeCardViewProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [leaving, setLeaving] = useState(false);

  // Оберт залежить від горизонтального зсуву (лише коли горизонталь домінує).
  const rotate = useTransform<number, number>([x, y], ([lx, ly]) =>
    Math.abs(ly ?? 0) > Math.abs(lx ?? 0) ? 0 : (lx ?? 0) * 0.06,
  );

  /*
   * Заливка картки за напрямом.
   *
   * Рахується з ОБОХ осей разом (`verdictTint`), а не з проєкції на одну.
   * Раніше кожен оверлей дивився на свою вісь незалежно, і рух під 45°
   * підсвічував два вердикти різними кольорами водночас — хоча
   * відпускання пальця дає рівно один. Тепер підказка обіцяє саме те,
   * що станеться.
   */
  const upTint = useTransform<number, number>([x, y], ([lx, ly]) => verdictTint(lx ?? 0, ly ?? 0, 'up'));
  const downTint = useTransform<number, number>([x, y], ([lx, ly]) => verdictTint(lx ?? 0, ly ?? 0, 'down'));
  const leftTint = useTransform<number, number>([x, y], ([lx, ly]) => verdictTint(lx ?? 0, ly ?? 0, 'left'));
  const rightTint = useTransform<number, number>([x, y], ([lx, ly]) => verdictTint(lx ?? 0, ly ?? 0, 'right'));
  const tintByDirection: Record<SwipeDirection, typeof upTint> = {
    up: upTint,
    down: downTint,
    left: leftTint,
    right: rightTint,
  };

  const flyOut = (dir: SwipeDirection) => {
    setLeaving(true);
    const target =
      dir === 'up'
        ? { x: 0, y: -window.innerHeight }
        : dir === 'down'
          ? { x: 0, y: window.innerHeight }
          : dir === 'left'
            ? { x: -window.innerWidth, y: 0 }
            : { x: window.innerWidth, y: 0 };
    animate(x, target.x, { duration: 0.35 });
    animate(y, target.y, { duration: 0.35 }).then(() => onSwipe(card, dir));
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const horiz = Math.abs(offset.x) > Math.abs(offset.y);
    let dir: SwipeDirection | null = null;
    if (horiz) {
      if (offset.x < -OFFSET_T || velocity.x < -VELOCITY_T) dir = 'left';
      else if (offset.x > OFFSET_T || velocity.x > VELOCITY_T) dir = 'right';
    } else {
      if (offset.y < -OFFSET_T || velocity.y < -VELOCITY_T) dir = 'up';
      else if (offset.y > OFFSET_T || velocity.y > VELOCITY_T) dir = 'down';
    }
    if (dir) flyOut(dir);
    else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  // Картки за верхньою — злегка зменшені й зсунуті вниз.
  const stackStyle =
    depth === 0
      ? {}
      : { scale: 1 - depth * 0.05, y: depth * 10, transition: 'transform 0.3s ease' };

  return (
    <motion.div
      className="swipe-card"
      style={{ x, y, rotate, zIndex: 10 - depth, ...(active ? {} : stackStyle) }}
      drag={active && !leaving}
      dragSnapToOrigin={false}
      dragElastic={0.6}
      {...(active ? { onDragEnd } : {})}
      onClick={() => {
        // Клік без перетягування (x≈0) → деталі.
        if (active && Math.abs(x.get()) < 6 && Math.abs(y.get()) < 6) onTap(card);
      }}
    >
      {card.poster_path ? (
        <img className="swipe-poster" src={card.poster_path} alt="" loading="lazy" draggable={false} />
      ) : (
        <div className="swipe-poster-placeholder">🎬</div>
      )}
      <div className="swipe-card-gradient" />
      <div className="swipe-card-info">
        <p className="swipe-card-title">{card.title}</p>
        <div className="swipe-card-meta">
          {card.year && <span>{card.year}</span>}
          {card.rating && <span>★ {card.rating}</span>}
        </div>
      </div>

      {/* Вердикт заливає КАРТКУ ЦІЛКОМ, а підпис стоїть у її центрі.
          Пара дивиться на постер, тобто в середину, — і саме там мусить
          з'явитись відповідь на «що буде, якщо відпустити». */}
      {active && SWIPE_VERDICTS.map((verdict) => (
        <motion.div
          key={verdict.direction}
          className={`swipe-verdict swipe-verdict--${verdict.direction}`}
          style={{ opacity: tintByDirection[verdict.direction] }}
          aria-hidden="true"
        >
          <span className="swipe-verdict-badge">
            <span className="swipe-verdict-glyph">{verdict.glyph}</span>
            {verdict.label}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}
